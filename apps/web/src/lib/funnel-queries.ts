/**
 * P5.1 — Shared funnel-analysis query engine.
 *
 * Single source of truth for:
 *   - The 5-stage funnel definition (subset of the 8 P4.1 canonical events).
 *   - HogQL query strings + result shapes.
 *   - The `runFunnelQueries()` entry point used by both
 *     `scripts/funnel-analysis.ts` (CLI memo generator) and
 *     `apps/web/src/app/api/admin/funnel/route.ts` (admin dashboard
 *     backend).
 *
 * Returns `null` when `POSTHOG_PERSONAL_API_KEY` or `POSTHOG_PROJECT_ID`
 * are unset, so the script and dashboard can render a "not configured"
 * empty state instead of throwing.
 *
 * Conversion semantics: "any-time" (a user counts as having converted
 * if they fired both events anywhere in the window). PostHog's native
 * funnel insight enforces strict ordering; that's a useful refinement
 * for v2, but for the day-60 memo "any-time" is the standard pragmatic
 * approximation. Time-to-conversion (median seconds) DOES enforce
 * ordering — it's only computed on users who fired the prior stage
 * before the next.
 *
 * @packageDocumentation
 */
import { EVENT_NAMES, type EventName } from './posthog'

// ─── Funnel definition ──────────────────────────────────────────────────────

/**
 * The 5 funnel stages, in order. A subset of the 8 canonical events;
 * `shadow_directory_viewed`, `scaffold_failed`, and `sdk_first_init`
 * are observability events that don't gate progression and are surfaced
 * separately (top errors, supplementary counts) rather than as funnel
 * stages.
 */
export const FUNNEL_STAGES = [
  'gallery_viewed',
  'template_detail_viewed',
  'cli_install_started',
  'scaffold_success',
  'first_billed_call',
] as const satisfies readonly EventName[]

export type FunnelStage = (typeof FUNNEL_STAGES)[number]

/** The 4 stage-to-stage transitions surfaced as conversion rates. */
export const FUNNEL_TRANSITIONS: ReadonlyArray<{
  from: FunnelStage
  to: FunnelStage
}> = [
  { from: 'gallery_viewed', to: 'template_detail_viewed' },
  { from: 'template_detail_viewed', to: 'cli_install_started' },
  { from: 'cli_install_started', to: 'scaffold_success' },
  { from: 'scaffold_success', to: 'first_billed_call' },
] as const

// ─── Result types ───────────────────────────────────────────────────────────

export interface FunnelEventCounts {
  total: number
  unique: number
}

export interface FunnelDailyPoint {
  day: string
  event: EventName
  count: number
}

export interface FunnelConversion {
  fromStage: FunnelStage
  toStage: FunnelStage
  fromUniques: number
  toUniques: number
  rate: number | null
  /**
   * Median time between fromStage's first occurrence and toStage's
   * first occurrence, per user, in minutes (rounded to 1 decimal).
   * Null when no users completed both in order.
   *
   * Spec D9 calls for minutes as the canonical unit. The HogQL query
   * computes seconds via toUnixTimestamp arithmetic; we divide by 60
   * here so consumers (script markdown, dashboard, JSON sidecar) all
   * see the same minute-denominated number.
   */
  medianMinutesToConvert: number | null
}

/** Per-event aggregate stats over the daily breakdown. */
export interface DailyStats {
  /** Sum of daily counts (== total in window). */
  total: number
  /** Number of days the event appeared at all (count > 0). */
  activeDays: number
  /** Smallest non-zero daily count, or 0 if no active days. */
  minNonZero: number
  /** Median of non-zero daily counts, or 0 if no active days. */
  median: number
  /** Largest daily count. */
  max: number
  /** ISO date (YYYY-MM-DD) of the peak day, or null if no events. */
  peakDay: string | null
  /**
   * Spike ratio: max / median when median > 0, null otherwise.
   * Useful for surfacing "one anomalous day drove most of the volume."
   */
  spikeRatio: number | null
}

/** Hour-of-day clustering (UTC) for top-of-funnel volume. */
export interface HourBucket {
  hourUtc: number
  count: number
}

export interface FunnelData {
  generatedAt: string
  windowDays: number
  events: Record<EventName, FunnelEventCounts>
  daily: FunnelDailyPoint[]
  /** Per-event aggregate stats derived from `daily`. Surfaces spikes/dips. */
  dailyStats: Record<EventName, DailyStats>
  /** Hour-of-day distribution (UTC) for `gallery_viewed` — top of funnel. */
  hourClusters: HourBucket[]
  conversions: FunnelConversion[]
  topTemplates: Array<{ slug: string; successes: number }>
  topErrors: Array<{ code: string; failures: number }>
  geoBreakdown: Array<{ country: string; events: number }>
}

// ─── PostHog query plumbing ─────────────────────────────────────────────────

const DEFAULT_HOST = 'https://us.i.posthog.com'
const DEFAULT_TIMEOUT_MS = 15_000

interface PostHogConfig {
  host: string
  apiKey: string
  projectId: string
}

function readConfig(): PostHogConfig | null {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST
  if (!apiKey || !projectId) return null
  return { apiKey, projectId, host }
}

async function runHogQL(
  cfg: PostHogConfig,
  query: string,
  signal?: AbortSignal,
): Promise<unknown[][]> {
  const url = `${cfg.host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(cfg.projectId)}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    signal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostHog HogQL ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results?: unknown[][] }
  return data.results ?? []
}

// ─── Number coercion (HogQL JSON returns numbers as JSON numbers, but
//     wider types occasionally arrive as strings) ────────────────────────────

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function asStringOrEmpty(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  return String(v)
}

// ─── Query builders ─────────────────────────────────────────────────────────

/**
 * Per-event counts + uniques. One round-trip; 16 columns (8 events × 2).
 * Returns a single row.
 */
function buildCountsQuery(days: number): string {
  // Outer WHERE bounds the event-table scan to the window; countIf/uniqIf
  // then just discriminate by event name. Without the outer WHERE,
  // PostHog scans the whole events table and the conditions get applied
  // post-scan — orders of magnitude slower at scale.
  const cols = EVENT_NAMES.flatMap((e) => [
    `countIf(event = '${e}') AS ${e}_count`,
    `uniqIf(distinct_id, event = '${e}') AS ${e}_unique`,
  ]).join(',\n  ')
  return `
    SELECT
      ${cols}
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
  `.trim()
}

/**
 * Daily breakdown for the 8 canonical events. Up to 8 × days rows.
 */
function buildDailyQuery(days: number): string {
  const inList = EVENT_NAMES.map((e) => `'${e}'`).join(', ')
  return `
    SELECT toDate(timestamp) AS day, event, count() AS cnt
    FROM events
    WHERE event IN (${inList})
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY day, event
    ORDER BY day ASC, event ASC
  `.trim()
}

/**
 * Per-stage uniques for the 5 funnel stages. Stage N counts unique
 * users who fired stage N's event AND also fired stage N-1's event in
 * the window (any-time semantics — see file header).
 */
function buildFunnelQuery(days: number): string {
  // Outer WHERE bounds the scan; subqueries also need their own time
  // bound (PostHog's HogQL doesn't push the outer down into IN-subqueries).
  const stageCols = FUNNEL_STAGES.map((stage, i) => {
    if (i === 0) {
      return `uniqIf(distinct_id, event = '${stage}') AS s${i + 1}`
    }
    const prior = FUNNEL_STAGES[i - 1]
    return `uniqIf(distinct_id, event = '${stage}' AND distinct_id IN (SELECT distinct_id FROM events WHERE event = '${prior}' AND timestamp > now() - INTERVAL ${days} DAY)) AS s${i + 1}`
  }).join(',\n  ')
  return `
    SELECT
      ${stageCols}
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
  `.trim()
}

/**
 * Median time-to-convert for each transition. Order is enforced
 * (`t_to > t_from` filter), so a user who fired the to-event before
 * the from-event is not counted.
 *
 * Returns `medianSecondsToConvert` per transition. Null when no users
 * fired both in order.
 *
 * One sub-query per transition because each needs its own per-user
 * aggregation. 4 round-trips.
 */
function buildTimeToConvertQuery(
  fromStage: FunnelStage,
  toStage: FunnelStage,
  days: number,
): string {
  return `
    SELECT quantile(0.5)(toUnixTimestamp(t_to) - toUnixTimestamp(t_from)) AS median_seconds
    FROM (
      SELECT
        distinct_id,
        minIf(timestamp, event = '${fromStage}') AS t_from,
        minIf(timestamp, event = '${toStage}') AS t_to
      FROM events
      WHERE event IN ('${fromStage}', '${toStage}')
        AND timestamp > now() - INTERVAL ${days} DAY
      GROUP BY distinct_id
    )
    WHERE t_to > t_from AND t_from IS NOT NULL AND t_to IS NOT NULL
  `.trim()
}

function buildTopTemplatesQuery(days: number): string {
  return `
    SELECT properties.template_slug AS slug, count() AS successes
    FROM events
    WHERE event = 'scaffold_success'
      AND timestamp > now() - INTERVAL ${days} DAY
      AND properties.template_slug IS NOT NULL
    GROUP BY slug
    ORDER BY successes DESC
    LIMIT 10
  `.trim()
}

function buildTopErrorsQuery(days: number): string {
  return `
    SELECT properties.error_code AS code, count() AS failures
    FROM events
    WHERE event = 'scaffold_failed'
      AND timestamp > now() - INTERVAL ${days} DAY
      AND properties.error_code IS NOT NULL
    GROUP BY code
    ORDER BY failures DESC
    LIMIT 10
  `.trim()
}

function buildGeoQuery(days: number): string {
  return `
    SELECT properties.ip_country AS country, count() AS events_count
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
      AND properties.ip_country IS NOT NULL
      AND properties.ip_country != 'XX'
    GROUP BY country
    ORDER BY events_count DESC
    LIMIT 20
  `.trim()
}

/**
 * Hour-of-day clustering (UTC) for `gallery_viewed`. Surfaces timezone
 * effects — a strong cluster around a specific UTC hour usually means
 * a single geography is dominating top-of-funnel volume. The dashboard
 * pairs this with the geo breakdown for cross-reference.
 */
function buildHourQuery(days: number): string {
  return `
    SELECT toHour(timestamp) AS hour_utc, count() AS cnt
    FROM events
    WHERE event = 'gallery_viewed'
      AND timestamp > now() - INTERVAL ${days} DAY
    GROUP BY hour_utc
    ORDER BY hour_utc ASC
  `.trim()
}

// ─── Anomaly aggregations (computed in TS from `daily` rows) ────────────────

/**
 * Compute per-event daily aggregates from the daily breakdown rows.
 * Done in TS rather than HogQL because the daily-rows query already
 * pulls the full per-day-per-event grid; re-querying for aggregates
 * would double the round-trip count for no extra precision.
 *
 * Exported for testing — internal callers use `runFunnelQueries`.
 */
export function computeDailyStats(daily: FunnelDailyPoint[]): Record<EventName, DailyStats> {
  const out = {} as Record<EventName, DailyStats>
  for (const event of EVENT_NAMES) {
    const points = daily.filter((p) => p.event === event)
    if (points.length === 0) {
      out[event] = {
        total: 0,
        activeDays: 0,
        minNonZero: 0,
        median: 0,
        max: 0,
        peakDay: null,
        spikeRatio: null,
      }
      continue
    }
    const counts = points.map((p) => p.count).filter((c) => c > 0)
    const total = points.reduce((acc, p) => acc + p.count, 0)
    const max = points.reduce(
      (best, p) => (p.count > best.count ? p : best),
      points[0],
    )
    const sortedNonZero = [...counts].sort((a, b) => a - b)
    const median =
      sortedNonZero.length === 0
        ? 0
        : sortedNonZero.length % 2 === 1
          ? sortedNonZero[(sortedNonZero.length - 1) / 2]
          : (sortedNonZero[sortedNonZero.length / 2 - 1] +
              sortedNonZero[sortedNonZero.length / 2]) /
            2
    out[event] = {
      total,
      activeDays: counts.length,
      minNonZero: sortedNonZero[0] ?? 0,
      median,
      max: max.count,
      peakDay: max.count > 0 ? max.day : null,
      spikeRatio: median > 0 ? max.count / median : null,
    }
  }
  return out
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function runFunnelQueries(
  opts: { days?: number; signal?: AbortSignal } = {},
): Promise<FunnelData | null> {
  const cfg = readConfig()
  if (!cfg) return null

  const days = opts.days ?? 30
  const externalSignal = opts.signal

  // Compose an internal AbortController so we can apply our own
  // timeout while still respecting the caller's signal if provided.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  externalSignal?.addEventListener('abort', onAbort)

  try {
    const [
      countsRows,
      dailyRows,
      funnelRows,
      timeToConvertResults,
      topTemplatesRows,
      topErrorsRows,
      geoRows,
      hourRows,
    ] = await Promise.all([
      runHogQL(cfg, buildCountsQuery(days), controller.signal),
      runHogQL(cfg, buildDailyQuery(days), controller.signal),
      runHogQL(cfg, buildFunnelQuery(days), controller.signal),
      Promise.all(
        FUNNEL_TRANSITIONS.map((t) =>
          runHogQL(
            cfg,
            buildTimeToConvertQuery(t.from, t.to, days),
            controller.signal,
          ),
        ),
      ),
      runHogQL(cfg, buildTopTemplatesQuery(days), controller.signal),
      runHogQL(cfg, buildTopErrorsQuery(days), controller.signal),
      runHogQL(cfg, buildGeoQuery(days), controller.signal),
      runHogQL(cfg, buildHourQuery(days), controller.signal),
    ])

    // Parse counts (one row, 16 columns in EVENT_NAMES order).
    const countsRow = countsRows[0] ?? []
    const events = {} as Record<EventName, FunnelEventCounts>
    EVENT_NAMES.forEach((e, i) => {
      events[e] = {
        total: asNumber(countsRow[i * 2]),
        unique: asNumber(countsRow[i * 2 + 1]),
      }
    })

    // Parse daily rows.
    const daily: FunnelDailyPoint[] = dailyRows.map((row) => ({
      day: asStringOrEmpty(row[0]).slice(0, 10),
      event: asStringOrEmpty(row[1]) as EventName,
      count: asNumber(row[2]),
    }))

    // Parse 5-stage funnel uniques (one row, 5 cols).
    const funnelRow = funnelRows[0] ?? []
    const stageUniques: Record<FunnelStage, number> = {} as Record<
      FunnelStage,
      number
    >
    FUNNEL_STAGES.forEach((stage, i) => {
      stageUniques[stage] = asNumber(funnelRow[i])
    })

    // Compose the 4 conversions. Spec D9 requires minutes as the
    // canonical time-to-convert unit; HogQL returns seconds via
    // toUnixTimestamp arithmetic, so we divide by 60 here (rounded
    // to 1 decimal) and surface as `medianMinutesToConvert`.
    const conversions: FunnelConversion[] = FUNNEL_TRANSITIONS.map(
      (t, idx) => {
        const fromUniques = stageUniques[t.from]
        const toUniques = stageUniques[t.to]
        const rate = fromUniques > 0 ? toUniques / fromUniques : null
        const ttcRow = timeToConvertResults[idx]?.[0] ?? []
        const seconds = ttcRow.length > 0 ? asNumber(ttcRow[0]) : 0
        const medianMinutesToConvert =
          seconds > 0 ? Math.round((seconds / 60) * 10) / 10 : null
        return {
          fromStage: t.from,
          toStage: t.to,
          fromUniques,
          toUniques,
          rate,
          medianMinutesToConvert,
        }
      },
    )

    const topTemplates = topTemplatesRows.map((row) => ({
      slug: asStringOrEmpty(row[0]),
      successes: asNumber(row[1]),
    }))
    const topErrors = topErrorsRows.map((row) => ({
      code: asStringOrEmpty(row[0]),
      failures: asNumber(row[1]),
    }))
    const geoBreakdown = geoRows.map((row) => ({
      country: asStringOrEmpty(row[0]),
      events: asNumber(row[1]),
    }))
    const hourClusters: HourBucket[] = hourRows.map((row) => ({
      hourUtc: Math.max(0, Math.min(23, Math.round(asNumber(row[0])))),
      count: asNumber(row[1]),
    }))
    const dailyStats = computeDailyStats(daily)

    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      events,
      daily,
      dailyStats,
      hourClusters,
      conversions,
      topTemplates,
      topErrors,
      geoBreakdown,
    }
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onAbort)
  }
}
