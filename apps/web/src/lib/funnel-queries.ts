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
  medianSecondsToConvert: number | null
}

export interface FunnelData {
  generatedAt: string
  windowDays: number
  events: Record<EventName, FunnelEventCounts>
  daily: FunnelDailyPoint[]
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

    // Compose the 4 conversions.
    const conversions: FunnelConversion[] = FUNNEL_TRANSITIONS.map(
      (t, idx) => {
        const fromUniques = stageUniques[t.from]
        const toUniques = stageUniques[t.to]
        const rate = fromUniques > 0 ? toUniques / fromUniques : null
        const ttcRow = timeToConvertResults[idx]?.[0] ?? []
        const seconds = ttcRow.length > 0 ? asNumber(ttcRow[0]) : 0
        const medianSecondsToConvert = seconds > 0 ? seconds : null
        return {
          fromStage: t.from,
          toStage: t.to,
          fromUniques,
          toUniques,
          rate,
          medianSecondsToConvert,
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

    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      events,
      daily,
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
