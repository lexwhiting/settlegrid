/**
 * P5.K1 — Admin GET /api/admin/kernel-health.
 *
 * Aggregates kernel_telemetry rows for the /admin/kernel-health
 * dashboard. Same auth pattern as /api/admin/funnel: rate-limited
 * by IP, then requireDeveloper, then ADMIN_EMAILS allowlist.
 *
 * Query params:
 *   - `view=overview` (default) — top-level aggregates
 *   - `view=adapter&id=<adapter>` — per-adapter drill-down
 *   - `view=rails` — rail-fee accumulation
 *   - `windowDays=7` (default; clamped 1..90)
 *
 * Hostile invariants:
 *   - Result rows are LIMITed (≤ 500 recent errors / event rows) so
 *     the dashboard cannot OOM under deep history.
 *   - Adapter id and view are validated against allow-shaped enums
 *     before reaching the SQL builder.
 *   - 5-minute revalidate cache keeps dashboard polling cheap.
 */
import { NextRequest } from 'next/server'
import { sql, and, eq, desc, gte } from 'drizzle-orm'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { kernelTelemetry } from '@/lib/db/schema'

export const maxDuration = 30
export const revalidate = 300

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

const ENUM_LIKE_RE = /^[a-z0-9][a-z0-9._-]*$/i
const RECENT_ERRORS_LIMIT = 500

interface OverviewLatencyRow {
  adapter: string
  total: number
  successes: number
  errors: number
  /** Error rate over the window: errors / total (0 when total = 0). */
  errorRate: number
  p50: number
  p95: number
  p99: number
}

export interface KernelHealthOverview {
  view: 'overview'
  generatedAt: string
  windowDays: number
  totalEvents: number
  /**
   * Current queries-per-second over the last 60 seconds. Spec §P5.K1
   * top-level dashboard requires "current QPS" alongside p50/p95/p99
   * latency. Computed from the count of `kernel.adapter_latency_ms`
   * events in the last 60s (the canonical "request happened" event)
   * divided by 60.
   */
  currentQps: number
  perAdapter: OverviewLatencyRow[]
}

export interface KernelHealthAdapterDrill {
  view: 'adapter'
  generatedAt: string
  windowDays: number
  adapter: string
  total: number
  successes: number
  errors: number
  p50: number
  p95: number
  p99: number
  latencyHistogram: { bucketMs: number; count: number }[]
  recentErrors: {
    occurredAt: string
    errorClass: string | null
    errorMessage: string | null
  }[]
}

export interface KernelHealthRails {
  view: 'rails'
  generatedAt: string
  windowDays: number
  perRail: {
    rail: string
    settledCount: number
    amountCentsTotal: number
    takeCentsTotal: number
  }[]
  /**
   * Spec §P5.K1 — "rail-fee accumulation, payout schedule status".
   * Surfaces the platform-level payout pipeline so an admin can
   * answer "are accumulated fees flowing out to developers as
   * expected?" at a glance.
   *
   * - `mode` is the platform-level payout schedule. Currently
   *   "manual" per the 2026-04 ops decision (see memory
   *   `settlegrid-progress.md`); the daily cron triggers, but
   *   each batch is operator-confirmed.
   * - `cronSchedule` is the cron expression for the processor.
   * - `nextCronRun` is the next 12:00 UTC instant.
   * - `lastSuccess` is the most recent payout with status='success'.
   * - `pending` aggregates rows in pending/processing state — the
   *   amount waiting to flow and the count of developers in that
   *   queue.
   * - `failed24h` flags any failures in the last 24h.
   */
  payoutStatus: {
    mode: 'manual' | 'auto'
    cronSchedule: string
    nextCronRun: string
    lastSuccess: {
      occurredAt: string | null
      amountCents: number
    }
    pending: {
      count: number
      amountCentsTotal: number
    }
    failed24h: number
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rate = await checkRateLimit(apiLimiter, `admin-kernel-health:${ip}`)
  if (!rate.success) {
    return errorResponse('Rate limited.', 429, 'RATE_LIMITED')
  }

  let auth
  try {
    auth = await requireDeveloper(request)
  } catch {
    // requireDeveloper throws AuthenticationError → return 404 to
    // avoid leaking the surface to non-admins.
    return errorResponse('Not Found.', 404, 'NOT_FOUND')
  }
  if (!ADMIN_EMAILS.includes(auth.email)) {
    return errorResponse('Not Found.', 404, 'NOT_FOUND')
  }

  const sp = request.nextUrl.searchParams
  const view = sp.get('view') ?? 'overview'
  const windowDays = clampWindow(sp.get('windowDays'))
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  try {
    if (view === 'overview') {
      return successResponse(await loadOverview(cutoff, windowDays))
    }
    if (view === 'adapter') {
      const id = sp.get('id') ?? ''
      if (!id || !ENUM_LIKE_RE.test(id) || id.length > 64) {
        return errorResponse('Invalid adapter id.', 400, 'INVALID_ID')
      }
      return successResponse(await loadAdapter(id, cutoff, windowDays))
    }
    if (view === 'rails') {
      return successResponse(await loadRails(cutoff, windowDays))
    }
    return errorResponse('Unknown view.', 400, 'INVALID_VIEW')
  } catch (err) {
    logger.error('admin_kernel_health.query_failed', {
      view,
      error: err instanceof Error ? err.message : String(err),
    })
    return internalErrorResponse(
      err instanceof Error ? err : new Error('Query failed.'),
    )
  }
}

function clampWindow(raw: string | null): number {
  const n = raw === null ? 7 : Number(raw)
  if (!Number.isInteger(n) || n < 1) return 7
  if (n > 90) return 90
  return n
}

async function loadOverview(
  cutoff: Date,
  windowDays: number,
): Promise<KernelHealthOverview> {
  // Aggregate latency events (`kernel.adapter_latency_ms`) by
  // adapter. Use jsonb operators on `props` for latency_ms +
  // success — denormalizing those into columns would cost a wider
  // schema for marginal index benefit.
  const rowsResult = (await db.execute(sql`
    SELECT
      adapter,
      count(*)::text AS total,
      count(*) FILTER (WHERE (props ->> 'success')::boolean = true)::text AS successes,
      count(*) FILTER (WHERE (props ->> 'success')::boolean = false)::text AS errors,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int)::text AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int)::text AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int)::text AS p99
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND occurred_at >= ${cutoff.toISOString()}
    GROUP BY adapter
    ORDER BY total DESC
    LIMIT 50
  `)) as unknown as Array<{
    adapter: string
    total: string
    successes: string
    errors: string
    p50: string
    p95: string
    p99: string
  }>

  const totalResult = (await db.execute(sql`
    SELECT count(*)::text AS total
    FROM kernel_telemetry
    WHERE occurred_at >= ${cutoff.toISOString()}
  `)) as unknown as Array<{ total: string }>

  // Spec §P5.K1 — current QPS. Last-60-second count of latency events
  // (the canonical "request happened" event) ÷ 60. We use a separate
  // query rather than re-scoping the per-adapter aggregate because
  // QPS is a sliding 60s window, while the per-adapter table is over
  // the dashboard's selected window (default 7 days). Joining the two
  // would skew either signal.
  const qpsResult = (await db.execute(sql`
    SELECT count(*)::text AS recent
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND occurred_at >= now() - INTERVAL '60 seconds'
  `)) as unknown as Array<{ recent: string }>
  const currentQps = Number(qpsResult[0]?.recent ?? 0) / 60

  return {
    view: 'overview',
    generatedAt: new Date().toISOString(),
    windowDays,
    totalEvents: Number(totalResult[0]?.total ?? 0),
    currentQps,
    perAdapter: rowsResult.map((r) => {
      const total = Number(r.total)
      const errors = Number(r.errors)
      return {
        adapter: r.adapter,
        total,
        successes: Number(r.successes),
        errors,
        errorRate: total === 0 ? 0 : errors / total,
        p50: Number(r.p50),
        p95: Number(r.p95),
        p99: Number(r.p99),
      }
    }),
  }
}

async function loadAdapter(
  adapter: string,
  cutoff: Date,
  windowDays: number,
): Promise<KernelHealthAdapterDrill> {
  const summaryResult = (await db.execute(sql`
    SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE (props ->> 'success')::boolean = true)::text AS successes,
      count(*) FILTER (WHERE (props ->> 'success')::boolean = false)::text AS errors,
      coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int), 0)::text AS p50,
      coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int), 0)::text AS p95,
      coalesce(percentile_cont(0.99) WITHIN GROUP (ORDER BY (props ->> 'latency_ms')::int), 0)::text AS p99
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND adapter = ${adapter}
      AND occurred_at >= ${cutoff.toISOString()}
  `)) as unknown as Array<{
    total: string
    successes: string
    errors: string
    p50: string
    p95: string
    p99: string
  }>
  const summary = summaryResult[0] ?? {
    total: '0',
    successes: '0',
    errors: '0',
    p50: '0',
    p95: '0',
    p99: '0',
  }

  // Latency histogram, bucketed 50ms wide up to 1s, then 250ms wide
  // up to 5s, then a single >5s bucket. Fixed buckets keep the
  // dashboard predictable; histograms-on-quantiles aren't necessary
  // for the visual signal.
  const histResult = (await db.execute(sql`
    SELECT
      CASE
        WHEN (props ->> 'latency_ms')::int < 1000
          THEN ((props ->> 'latency_ms')::int / 50) * 50
        WHEN (props ->> 'latency_ms')::int < 5000
          THEN 1000 + (((props ->> 'latency_ms')::int - 1000) / 250) * 250
        ELSE 5000
      END::text AS bucket_ms,
      count(*)::text AS count
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND adapter = ${adapter}
      AND occurred_at >= ${cutoff.toISOString()}
    GROUP BY bucket_ms
    ORDER BY bucket_ms ASC
  `)) as unknown as Array<{ bucket_ms: string; count: string }>

  const errorRows = await db
    .select({
      occurredAt: kernelTelemetry.occurredAt,
      props: kernelTelemetry.props,
    })
    .from(kernelTelemetry)
    .where(
      and(
        eq(kernelTelemetry.eventName, 'kernel.adapter_error'),
        eq(kernelTelemetry.adapter, adapter),
        gte(kernelTelemetry.occurredAt, cutoff),
      ),
    )
    .orderBy(desc(kernelTelemetry.occurredAt))
    .limit(RECENT_ERRORS_LIMIT)

  return {
    view: 'adapter',
    generatedAt: new Date().toISOString(),
    windowDays,
    adapter,
    total: Number(summary.total),
    successes: Number(summary.successes),
    errors: Number(summary.errors),
    p50: Number(summary.p50),
    p95: Number(summary.p95),
    p99: Number(summary.p99),
    latencyHistogram: histResult.map((r) => ({
      bucketMs: Number(r.bucket_ms),
      count: Number(r.count),
    })),
    recentErrors: errorRows.map((r) => {
      const p = r.props as Record<string, unknown>
      return {
        occurredAt:
          r.occurredAt instanceof Date
            ? r.occurredAt.toISOString()
            : String(r.occurredAt),
        errorClass: typeof p.error_class === 'string' ? p.error_class : null,
        errorMessage:
          typeof p.error_message === 'string' ? p.error_message : null,
      }
    }),
  }
}

async function loadRails(
  cutoff: Date,
  windowDays: number,
): Promise<KernelHealthRails> {
  const result = (await db.execute(sql`
    SELECT
      rail,
      count(*)::text AS settled_count,
      coalesce(sum((props ->> 'amount_cents')::bigint), 0)::text AS amount_cents_total,
      coalesce(sum((props ->> 'take_cents')::bigint), 0)::text AS take_cents_total
    FROM kernel_telemetry
    WHERE event_name = 'kernel.invocation_settled'
      AND occurred_at >= ${cutoff.toISOString()}
      AND rail IS NOT NULL
    GROUP BY rail
    ORDER BY take_cents_total DESC
    LIMIT 50
  `)) as unknown as Array<{
    rail: string
    settled_count: string
    amount_cents_total: string
    take_cents_total: string
  }>
  // Spec §P5.K1 — payout schedule status. Three queries: pending
  // aggregate, last successful payout, last 24h failure count. Each
  // hits the existing `payouts_status_idx` so even a deep payout
  // history doesn't slow this query down.
  const pendingResult = (await db.execute(sql`
    SELECT
      count(*)::text AS pending_count,
      coalesce(sum(amount_cents), 0)::text AS pending_amount_cents
    FROM payouts
    WHERE status IN ('pending', 'processing')
  `)) as unknown as Array<{
    pending_count: string
    pending_amount_cents: string
  }>
  // Production payout success states. Writers in lib/payouts/process.ts
  // and the Stripe webhook handler use 'completed' for the
  // CAS-completed Stripe transfer, 'paid' / 'reconciled' for the
  // post-webhook reconciled state, and (legacy) 'unknown' is a
  // reconciling state — explicitly NOT a success. Spec'd as a stable
  // set so the dashboard can't drift from the writer side; if this
  // list ever grows, update it here.
  const lastSuccessResult = (await db.execute(sql`
    SELECT created_at, amount_cents
    FROM payouts
    WHERE status IN ('completed', 'paid', 'reconciled')
    ORDER BY created_at DESC
    LIMIT 1
  `)) as unknown as Array<{ created_at: string | Date; amount_cents: number }>
  const failedResult = (await db.execute(sql`
    SELECT count(*)::text AS failed_count
    FROM payouts
    WHERE status = 'failed'
      AND created_at >= now() - INTERVAL '24 hours'
  `)) as unknown as Array<{ failed_count: string }>

  const lastSuccessRow = lastSuccessResult[0]
  const lastOccurredAt = lastSuccessRow?.created_at
    ? lastSuccessRow.created_at instanceof Date
      ? lastSuccessRow.created_at.toISOString()
      : new Date(lastSuccessRow.created_at).toISOString()
    : null

  return {
    view: 'rails',
    generatedAt: new Date().toISOString(),
    windowDays,
    perRail: result.map((r) => ({
      rail: r.rail,
      settledCount: Number(r.settled_count),
      amountCentsTotal: Number(r.amount_cents_total),
      takeCentsTotal: Number(r.take_cents_total),
    })),
    payoutStatus: {
      mode: 'manual' as const,
      cronSchedule: '0 12 * * *',
      nextCronRun: nextDailyCronRunAt12Utc().toISOString(),
      lastSuccess: {
        occurredAt: lastOccurredAt,
        amountCents: Number(lastSuccessRow?.amount_cents ?? 0),
      },
      pending: {
        count: Number(pendingResult[0]?.pending_count ?? 0),
        amountCentsTotal: Number(pendingResult[0]?.pending_amount_cents ?? 0),
      },
      failed24h: Number(failedResult[0]?.failed_count ?? 0),
    },
  }
}

/**
 * Compute the next daily 12:00 UTC instant from "now". Used to surface
 * the next scheduled payout cron run on the rails dashboard. Pure (no
 * side effects, takes "now" implicitly via Date.now()).
 */
function nextDailyCronRunAt12Utc(): Date {
  const now = new Date()
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      12,
      0,
      0,
      0,
    ),
  )
  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }
  return candidate
}
