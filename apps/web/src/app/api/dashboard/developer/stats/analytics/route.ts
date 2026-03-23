import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/dashboard/developer/stats/analytics — detailed analytics for developer */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-analytics:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

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

    // ── Hourly Distribution (last 7 days) ───────────────────────────────────────
    const sevenDaysAgoDate = new Date()
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7)
    const sevenDaysAgo = sevenDaysAgoDate.toISOString()

    const hourlyDistribution = await db
      .select({
        hour: sql<number>`extract(hour from ${invocations.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(
        and(
          toolFilter,
          gte(invocations.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`extract(hour from ${invocations.createdAt})`)
      .orderBy(sql`extract(hour from ${invocations.createdAt})`)
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

    // ── Revenue Trend (last 30 days) ────────────────────────────────────────────
    const thirtyDaysAgoDate = new Date()
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30)
    const thirtyDaysAgo = thirtyDaysAgoDate.toISOString()

    const revenueTrend = await db
      .select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          toolFilter,
          gte(invocations.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`${invocations.createdAt}::date`)
      .orderBy(sql`${invocations.createdAt}::date`)
      .limit(30)

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
