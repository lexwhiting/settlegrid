import { getRedis, tryRedis } from './redis'
import { logger } from './logger'

export interface FraudCheckResult {
  flagged: boolean
  reasons: string[]
  riskScore: number // 0-100
}

// In-memory fallback counters (used when Redis is unavailable)
const memoryCounters = new Map<string, { count: number; resetAt: number }>()
const memoryDuplicates = new Map<string, number>()


function incrMemoryCount(key: string, windowMs: number): number {
  const now = Date.now()
  const entry = memoryCounters.get(key)
  if (!entry || entry.resetAt <= now) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowMs })
    return 1
  }
  entry.count += 1
  return entry.count
}

function checkMemoryDuplicate(key: string, windowMs: number): boolean {
  const now = Date.now()
  const lastSeen = memoryDuplicates.get(key)
  memoryDuplicates.set(key, now)
  if (lastSeen && now - lastSeen < windowMs) {
    return true
  }
  return false
}

/**
 * Detect potential fraud in metering requests.
 *
 * Check 1: Rate spike — >50 invocations in 60s from same consumer
 * Check 2: New key high value — key <24h old + single invocation >$10 (1000 cents)
 * Check 3: Rapid duplicate — same consumer+tool+cost within 2 seconds
 *
 * Returns risk score 0-100 and list of reasons.
 */
export async function detectFraud(
  consumerId: string,
  toolId: string,
  costCents: number,
  ip: string,
  keyCreatedAt?: Date
): Promise<FraudCheckResult> {
  const reasons: string[] = []
  let riskScore = 0

  try {
    const redis = getRedis()

    // ── Check 1: Rate spike (>50 invocations in 60s) ──────────────────────────
    const rateKey = `fraud:rate:${consumerId}`
    const rateCount = await tryRedis(async () => {
      const pipeline = redis.pipeline()
      pipeline.incr(rateKey)
      pipeline.expire(rateKey, 60)
      const results = await pipeline.exec()
      return (results?.[0] as number) ?? null
    })

    const effectiveRate = rateCount ?? incrMemoryCount(rateKey, 60_000)

    if (effectiveRate > 50) {
      reasons.push(`Rate spike: ${effectiveRate} invocations in 60s (threshold: 50)`)
      riskScore += 50
    } else if (effectiveRate > 30) {
      riskScore += 15 // Elevated but not flagged
    }

    // ── Check 2: New key high value ───────────────────────────────────────────
    if (keyCreatedAt) {
      const keyAgeMs = Date.now() - keyCreatedAt.getTime()
      const isNewKey = keyAgeMs < 24 * 60 * 60 * 1000 // <24h
      if (isNewKey && costCents > 1000) {
        reasons.push(`New key high value: key age ${Math.floor(keyAgeMs / 3600000)}h, cost ${costCents} cents (threshold: 1000)`)
        riskScore += 40
      }
    }

    // ── Check 3: Rapid duplicate (same consumer+tool+cost in 2s) ──────────────
    const dupeKey = `fraud:dupe:${consumerId}:${toolId}:${costCents}`
    const dupeResult = await tryRedis(async () => {
      const existing = await redis.get<string>(dupeKey)
      await redis.set(dupeKey, '1', { ex: 2 })
      return existing !== null
    })

    const isDuplicate = dupeResult ?? checkMemoryDuplicate(dupeKey, 2000)

    if (isDuplicate) {
      reasons.push(`Rapid duplicate: same consumer+tool+cost within 2 seconds`)
      riskScore += 30
    }
  } catch {
    // If fraud detection itself fails, log and allow the request through
    logger.warn('fraud.detection_error', { consumerId, toolId, costCents, ip })
    return { flagged: false, reasons: [], riskScore: 0 }
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100)

  return {
    flagged: riskScore >= 50,
    reasons,
    riskScore,
  }
}

/**
 * Clean up stale in-memory entries (call periodically or on timer).
 * Prevents unbounded memory growth.
 */
export function cleanupMemoryCounters(): void {
  const now = Date.now()
  for (const [key, entry] of memoryCounters) {
    if (entry.resetAt <= now) memoryCounters.delete(key)
  }
  // Duplicates older than 10s are safe to prune
  for (const [key, ts] of memoryDuplicates) {
    if (now - ts > 10_000) memoryDuplicates.delete(key)
  }
}
