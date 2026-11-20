import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { denseDailyCents } from '@/lib/revenue-forecast'

export const maxDuration = 60

const TREND_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000


/** GET /api/dashboard/developer/stats/analytics — detailed analytics for developer */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-analytics:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-analytics:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    // Empty defaults
    const emptyResult = {
      methodBreakdown: [],
      topConsumers: [],
      hourlyDistribution: [],
      latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
      errorRate: 0,
      revenueTrend: [],
    }

    if (toolIds.length === 0) {
      return successResponse(emptyResult)
    }

    const toolFilter = inArray(invocations.toolId, toolIds)

    // ── Method Breakdown ────────────────────────────────────────────────────────
    const methodBreakdown = await db
      .select({
        method: invocations.method,
        count: sql<number>`count(*)::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
        errorRate: sql<number>`round(100.0 * count(*) filter (where ${invocations.status} != 'success') / greatest(count(*), 1), 2)::float`,
      })
      .from(invocations)
      .where(toolFilter)
      .groupBy(invocations.method)
      .orderBy(sql`count(*) desc`)
      .limit(50)

    // ── Top Consumers (top 10 by spend) ─────────────────────────────────────────
    const topConsumers = await db
      .select({
        consumerId: invocations.consumerId,
        totalSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocationCount: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(toolFilter)
      .groupBy(invocations.consumerId)
      .orderBy(sql`sum(${invocations.costCents}) desc`)
      .limit(10)

    // ── Hourly Distribution (last 7 days, UTC hour of day) ──────────────────────
    const utcHourOfDay = sql`extract(hour from ${invocations.createdAt} at time zone 'UTC')`
    const sevenDaysAgoDate = new Date()
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7)
    const hourlyDistribution = await db
      .select({
        hour: sql<number>`${utcHourOfDay}::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(
        and(
          toolFilter,
          gte(invocations.createdAt, sql`${sevenDaysAgoDate.toISOString()}::timestamptz`)
        )
      )
      .groupBy(utcHourOfDay)
      .orderBy(utcHourOfDay)
      .limit(24)

    // ── Latency Percentiles ─────────────────────────────────────────────────────
    const [percentiles] = await db
      .select({
        p50: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.latencyMs}), 0)::int`,
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${invocations.latencyMs}), 0)::int`,
        p99: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${invocations.latencyMs}), 0)::int`,
      })
      .from(invocations)
      .where(and(toolFilter, sql`${invocations.latencyMs} is not null`))

    const latencyPercentiles = percentiles ?? { p50: 0, p95: 0, p99: 0 }

    // ── Overall Error Rate ──────────────────────────────────────────────────────
    const [errorStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${invocations.status} != 'success')::int`,
      })
      .from(invocations)
      .where(toolFilter)

    const errorRate = errorStats && errorStats.total > 0
      ? Math.round((errorStats.errors / errorStats.total) * 10000) / 100
      : 0

    // ── Revenue Trend (last 30 UTC days, today included) ────────────────────────
    // Starting 29 days before today and stopping at tomorrow keeps the window at
    // 30 dates, so the limit can never drop today.
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const trendStart = new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS)
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS)
    const utcDay = sql`(${invocations.createdAt} at time zone 'UTC')::date`
    const trendRows = await db
      .select({
        date: sql<string>`to_char(${utcDay}, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          toolFilter,
          gte(invocations.createdAt, sql`${trendStart.toISOString()}::timestamptz`),
          sql`${invocations.createdAt} < ${tomorrowStart.toISOString()}::timestamptz`
        )
      )
      .groupBy(utcDay)
      .orderBy(utcDay)
      .limit(TREND_DAYS)
    // Every day of the window, days without calls as 0, so the chart's spacing is calendar time.
    const revenueTrend = trendRows.length === 0
      ? []
      : denseDailyCents(trendRows, trendStart, TREND_DAYS).map((revenueCents, i) => ({
          date: new Date(trendStart.getTime() + i * DAY_MS).toISOString().slice(0, 10),
          revenueCents,
        }))

    return successResponse({
      methodBreakdown,
      topConsumers,
      hourlyDistribution,
      latencyPercentiles,
      errorRate,
      revenueTrend,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
