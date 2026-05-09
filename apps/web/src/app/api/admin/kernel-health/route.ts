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
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
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
  p50: number
  p95: number
  p99: number
}

export interface KernelHealthOverview {
  view: 'overview'
  generatedAt: string
  windowDays: number
  totalEvents: number
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
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
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
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int)::text AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int)::text AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int)::text AS p99
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND occurred_at >= ${cutoff}
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
    WHERE occurred_at >= ${cutoff}
  `)) as unknown as Array<{ total: string }>

  return {
    view: 'overview',
    generatedAt: new Date().toISOString(),
    windowDays,
    totalEvents: Number(totalResult[0]?.total ?? 0),
    perAdapter: rowsResult.map((r) => ({
      adapter: r.adapter,
      total: Number(r.total),
      successes: Number(r.successes),
      errors: Number(r.errors),
      p50: Number(r.p50),
      p95: Number(r.p95),
      p99: Number(r.p99),
    })),
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
      coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int), 0)::text AS p50,
      coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int), 0)::text AS p95,
      coalesce(percentile_cont(0.99) WITHIN GROUP (ORDER BY (props ->> 'latencyMs')::int), 0)::text AS p99
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND adapter = ${adapter}
      AND occurred_at >= ${cutoff}
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
        WHEN (props ->> 'latencyMs')::int < 1000
          THEN ((props ->> 'latencyMs')::int / 50) * 50
        WHEN (props ->> 'latencyMs')::int < 5000
          THEN 1000 + (((props ->> 'latencyMs')::int - 1000) / 250) * 250
        ELSE 5000
      END::text AS bucket_ms,
      count(*)::text AS count
    FROM kernel_telemetry
    WHERE event_name = 'kernel.adapter_latency_ms'
      AND adapter = ${adapter}
      AND occurred_at >= ${cutoff}
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
        errorClass: typeof p.errorClass === 'string' ? p.errorClass : null,
        errorMessage:
          typeof p.errorMessage === 'string' ? p.errorMessage : null,
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
      coalesce(sum((props ->> 'amountCents')::bigint), 0)::text AS amount_cents_total,
      coalesce(sum((props ->> 'takeCents')::bigint), 0)::text AS take_cents_total
    FROM kernel_telemetry
    WHERE event_name = 'kernel.invocation_settled'
      AND occurred_at >= ${cutoff}
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
  }
}
