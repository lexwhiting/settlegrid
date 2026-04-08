/**
 * Indexer → cron interop helpers.
 *
 * The Indexer agent (in the separate settlegrid-agents repo) publishes
 * per-source quality weights to Redis once per week. The claim-outreach
 * cron reads these weights to bias its rotation toward sources that
 * convert better.
 *
 * These helpers are pure (no I/O dependencies in pure functions, the
 * read function is the only side-effecting call) so they can be unit
 * tested without spinning up Redis. The cron route imports them and
 * wires them into its query.
 */
import { getRedis, tryRedis } from './redis'

/**
 * Stable Redis key the Indexer agent writes its per-source quality scores to.
 * 30-day TTL — if the Indexer is silent for over a month, the cron falls
 * back to default uniform weights so it keeps working.
 */
export const INDEXER_QUALITY_KEY = 'indexer:source-quality:v1'

/** Quality score record published by the Indexer agent. */
export interface IndexerQualityScores {
  weights: Record<string, number>
  computedAt: string
}

/**
 * Read the latest per-source quality weights from Redis. Returns null on
 * any failure (key absent, malformed JSON, Redis unreachable, schema
 * mismatch). Callers fall back to uniform weights of 1.0.
 *
 * The cron does NOT depend on the Indexer being healthy — if scores are
 * missing, the rotation degrades gracefully to its hardcoded form.
 *
 * SECURITY: validates the parsed shape at runtime since TypeScript types
 * don't enforce after JSON parse. A malformed Mem0 record cannot inject
 * non-numeric weights into the SQL query downstream.
 */
export async function readIndexerQualityScores(): Promise<IndexerQualityScores | null> {
  return tryRedis(async () => {
    const redis = getRedis()
    const raw = await redis.get<string | IndexerQualityScores>(INDEXER_QUALITY_KEY)
    return parseIndexerQualityScores(raw)
  })
}

/**
 * Pure parser/validator extracted for unit testing. Accepts the raw value
 * returned by the Upstash JS client (which may be either a parsed object
 * or a JSON string depending on what was stored).
 */
export function parseIndexerQualityScores(raw: unknown): IndexerQualityScores | null {
  if (raw === null || raw === undefined) return null

  let parsed: unknown
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  } else if (typeof raw === 'object') {
    parsed = raw
  } else {
    return null
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('weights' in parsed) ||
    !('computedAt' in parsed)
  ) {
    return null
  }
  const candidate = parsed as { weights: unknown; computedAt: unknown }
  if (
    typeof candidate.weights !== 'object' ||
    candidate.weights === null ||
    Array.isArray(candidate.weights) ||
    typeof candidate.computedAt !== 'string'
  ) {
    return null
  }

  // Coerce all weight values to finite numbers; drop any that fail.
  const sanitizedWeights: Record<string, number> = {}
  for (const [key, value] of Object.entries(candidate.weights as Record<string, unknown>)) {
    const numeric = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      sanitizedWeights[key] = numeric
    }
  }
  return {
    weights: sanitizedWeights,
    computedAt: candidate.computedAt,
  }
}

/**
 * Compute the per-ecosystem priority used in the ORDER BY CASE expression.
 * Lower numbers sort first. Quality weights from the Indexer agent
 * MULTIPLY the rotation priority — higher weight → smaller priority →
 * earlier sort position. weight=1.0 leaves the priority unchanged.
 *
 * SAFETY: weight comes from Redis JSON which is technically untrusted at
 * runtime. We coerce to a number, reject NaN/non-finite, and clamp to
 * [0.1, 5] before any division.
 */
export function computeWeightedPriority(
  basePosition: number,
  rotation: number,
  weight: number,
): number {
  const numericWeight = typeof weight === 'number' ? weight : Number(weight)
  const safeWeight =
    Number.isFinite(numericWeight) && numericWeight > 0
      ? Math.min(Math.max(numericWeight, 0.1), 5)
      : 1
  // Base position rotated by day-of-year, then divided by weight
  const rotatedBase = (basePosition + 5 - rotation) % 5
  return rotatedBase / safeWeight
}
