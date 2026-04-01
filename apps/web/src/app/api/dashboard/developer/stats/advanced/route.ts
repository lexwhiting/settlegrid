import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueTrendPoint {
  date: string
  revenueCents: number
  invocations: number
  previousRevenueCents: number
  previousInvocations: number
}

interface CohortMetrics {
  totalConsumers: number
  newConsumers: number
  returningConsumers: number
  retentionRate: number
  avgRevenuePerConsumer: number
}

interface LatencyBreakdown {
  toolId: string
  toolName: string
  p50: number
  p95: number
  p99: number
  sampleSize: number
}

interface ErrorTrendPoint {
  date: string
  totalCount: number
  errorCount: number
  errorRate: number
}

interface TopConsumerRow {
  consumerId: string
  totalSpendCents: number
  invocationCount: number
  avgCostCents: number
  firstSeen: string
  lastSeen: string
}

interface MethodRow {
  method: string
  count: number
  totalRevenueCents: number
  avgLatencyMs: number
  errorRate: number
  avgCostCents: number
}

interface HourlyHeatmapPoint {
  dayOfWeek: number
  hour: number
  count: number
}

interface CostEfficiencyPoint {
  date: string
  revenueCents: number
  invocations: number
  revenuePerInvocationCents: number
}

interface ReferralRow {
  referralCode: string
  invocations: number
  revenueCents: number
  uniqueConsumers: number
}

interface AdvancedAnalytics {
  revenueTrend: RevenueTrendPoint[]
  cohortMetrics: CohortMetrics
  latencyByTool: LatencyBreakdown[]
  errorTrend: ErrorTrendPoint[]
  topConsumers: TopConsumerRow[]
  methodBreakdown: MethodRow[]
  hourlyHeatmap: HourlyHeatmapPoint[]
  costEfficiency: CostEfficiencyPoint[]
  referralAttribution: ReferralRow[]
  periodDays: number
}

// Advanced analytics tier check now uses centralized tier-config

/** GET /api/dashboard/developer/stats/advanced — advanced analytics (Scale+) */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-advanced-analytics:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // ── Tier gate (fail-closed) ─────────────────────────────────────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'advanced_analytics', developer.isFoundingMember)) {
      return errorResponse(
        'Advanced Analytics is available on the Scale plan ($79/mo) and above. Upgrade to unlock period-over-period comparisons, consumer cohort analysis, latency percentiles per tool, error trend tracking, referral attribution, and more.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'scale', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    // ── Parse period ────────────────────────────────────────────────────────
    const periodParam = request.nextUrl.searchParams.get('period')
    const VALID_PERIODS = new Set(['7', '30', '90'])
    const periodDays = VALID_PERIODS.has(periodParam ?? '') ? Number(periodParam) : 30

    // ── Get developer's tool IDs ────────────────────────────────────────────
    const developerTools = await db
      .select({ id: tools.id, name: tools.name })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)
    const toolNameMap = new Map(developerTools.map((t) => [t.id, t.name]))

    // ── Empty defaults ──────────────────────────────────────────────────────
    const emptyResult: AdvancedAnalytics = {
      revenueTrend: [],
      cohortMetrics: { totalConsumers: 0, newConsumers: 0, returningConsumers: 0, retentionRate: 0, avgRevenuePerConsumer: 0 },
      latencyByTool: [],
      errorTrend: [],
      topConsumers: [],
      methodBreakdown: [],
      hourlyHeatmap: [],
      costEfficiency: [],
      referralAttribution: [],
      periodDays,
    }

    if (toolIds.length === 0) {
      return successResponse(emptyResult)
    }

    const toolFilter = inArray(invocations.toolId, toolIds)
    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - periodDays)
    const previousPeriodStart = new Date(periodStart)
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays)

    const periodStartSql = sql`${periodStart.toISOString()}::timestamptz`
    const previousPeriodStartSql = sql`${previousPeriodStart.toISOString()}::timestamptz`
    const periodEndSql = sql`${periodStart.toISOString()}::timestamptz`

    // Run all queries in parallel for performance
    const [
      revenueTrendRows,
      previousRevenueTrendRows,
      cohortRows,
      previousCohortRows,
      latencyRows,
      errorTrendRows,
      topConsumerRows,
      methodRows,
      heatmapRows,
      costRows,
      referralRows,
    ] = await Promise.all([
      // ── 1. Revenue trend (current period) ─────────────────────────────────
      db.select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocations: sql<number>`count(*)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(sql`${invocations.createdAt}::date`)
        .orderBy(sql`${invocations.createdAt}::date`)
        .limit(90),

      // ── 2. Revenue trend (previous period for comparison) ─────────────────
      db.select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocations: sql<number>`count(*)::int`,
      })
        .from(invocations)
        .where(and(
          toolFilter,
          gte(invocations.createdAt, previousPeriodStartSql),
          lte(invocations.createdAt, periodEndSql),
        ))
        .groupBy(sql`${invocations.createdAt}::date`)
        .orderBy(sql`${invocations.createdAt}::date`)
        .limit(90),

      // ── 3. Consumer cohort (current period) ───────────────────────────────
      db.select({
        totalConsumers: sql<number>`count(distinct ${invocations.consumerId})::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql))),

      // ── 4. Consumer cohort (previous period — to find returning) ──────────
      db.select({
        consumerId: invocations.consumerId,
      })
        .from(invocations)
        .where(and(
          toolFilter,
          gte(invocations.createdAt, previousPeriodStartSql),
          lte(invocations.createdAt, periodEndSql),
        ))
        .groupBy(invocations.consumerId)
        .limit(10000),

      // ── 5. Latency percentiles per tool ───────────────────────────────────
      db.select({
        toolId: invocations.toolId,
        p50: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.latencyMs}), 0)::int`,
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${invocations.latencyMs}), 0)::int`,
        p99: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${invocations.latencyMs}), 0)::int`,
        sampleSize: sql<number>`count(*)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql), sql`${invocations.latencyMs} is not null`))
        .groupBy(invocations.toolId)
        .orderBy(sql`count(*) desc`)
        .limit(50),

      // ── 6. Error trend (daily) ────────────────────────────────────────────
      db.select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        totalCount: sql<number>`count(*)::int`,
        errorCount: sql<number>`count(*) filter (where ${invocations.status} != 'success')::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(sql`${invocations.createdAt}::date`)
        .orderBy(sql`${invocations.createdAt}::date`)
        .limit(90),

      // ── 7. Top consumers ──────────────────────────────────────────────────
      db.select({
        consumerId: invocations.consumerId,
        totalSpendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocationCount: sql<number>`count(*)::int`,
        avgCostCents: sql<number>`coalesce(avg(${invocations.costCents}), 0)::int`,
        firstSeen: sql<string>`to_char(min(${invocations.createdAt}), 'YYYY-MM-DD')`,
        lastSeen: sql<string>`to_char(max(${invocations.createdAt}), 'YYYY-MM-DD')`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(invocations.consumerId)
        .orderBy(sql`sum(${invocations.costCents}) desc`)
        .limit(20),

      // ── 8. Method breakdown ───────────────────────────────────────────────
      db.select({
        method: invocations.method,
        count: sql<number>`count(*)::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
        errorRate: sql<number>`round(100.0 * count(*) filter (where ${invocations.status} != 'success') / greatest(count(*), 1), 2)::float`,
        avgCostCents: sql<number>`coalesce(avg(${invocations.costCents}), 0)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(invocations.method)
        .orderBy(sql`count(*) desc`)
        .limit(50),

      // ── 9. Hourly heatmap (day-of-week x hour-of-day) ────────────────────
      db.select({
        dayOfWeek: sql<number>`extract(isodow from ${invocations.createdAt})::int`,
        hour: sql<number>`extract(hour from ${invocations.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(sql`extract(isodow from ${invocations.createdAt})`, sql`extract(hour from ${invocations.createdAt})`)
        .orderBy(sql`extract(isodow from ${invocations.createdAt})`, sql`extract(hour from ${invocations.createdAt})`)
        .limit(168), // 7 days * 24 hours

      // ── 10. Cost efficiency (daily) ───────────────────────────────────────
      db.select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocations: sql<number>`count(*)::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(sql`${invocations.createdAt}::date`)
        .orderBy(sql`${invocations.createdAt}::date`)
        .limit(90),

      // ── 11. Referral attribution ──────────────────────────────────────────
      db.select({
        referralCode: sql<string>`coalesce(${invocations.referralCode}, 'direct')`,
        invocations: sql<number>`count(*)::int`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        uniqueConsumers: sql<number>`count(distinct ${invocations.consumerId})::int`,
      })
        .from(invocations)
        .where(and(toolFilter, gte(invocations.createdAt, periodStartSql)))
        .groupBy(sql`coalesce(${invocations.referralCode}, 'direct')`)
        .orderBy(sql`sum(${invocations.costCents}) desc`)
        .limit(50),
    ])

    // ── Assemble revenue trend with previous period ─────────────────────────
    const prevByOffset = new Map<number, { revenueCents: number; invocations: number }>()
    previousRevenueTrendRows.forEach((row, idx) => {
      prevByOffset.set(idx, { revenueCents: row.revenueCents, invocations: row.invocations })
    })

    const revenueTrend: RevenueTrendPoint[] = revenueTrendRows.map((row, idx) => {
      const prev = prevByOffset.get(idx)
      return {
        date: row.date,
        revenueCents: row.revenueCents,
        invocations: row.invocations,
        previousRevenueCents: prev?.revenueCents ?? 0,
        previousInvocations: prev?.invocations ?? 0,
      }
    })

    // ── Assemble cohort metrics ─────────────────────────────────────────────
    const currentCohort = cohortRows[0]
    const totalConsumers = currentCohort?.totalConsumers ?? 0
    const totalRevenue = currentCohort?.totalRevenueCents ?? 0
    const previousConsumerIds = new Set(previousCohortRows.map((r) => r.consumerId))

    // Count current-period consumers who also appeared in previous period
    const currentConsumerIds = new Set(topConsumerRows.map((r) => r.consumerId))
    let returningCount = 0
    for (const id of currentConsumerIds) {
      if (previousConsumerIds.has(id)) returningCount++
    }
    const newConsumers = Math.max(0, totalConsumers - returningCount)

    const cohortMetrics: CohortMetrics = {
      totalConsumers,
      newConsumers,
      returningConsumers: returningCount,
      retentionRate: previousConsumerIds.size > 0
        ? Math.round((returningCount / previousConsumerIds.size) * 10000) / 100
        : 0,
      avgRevenuePerConsumer: totalConsumers > 0
        ? Math.round(totalRevenue / totalConsumers)
        : 0,
    }

    // ── Assemble latency by tool ────────────────────────────────────────────
    const latencyByTool: LatencyBreakdown[] = latencyRows.map((row) => ({
      toolId: row.toolId,
      toolName: toolNameMap.get(row.toolId) ?? 'Unknown',
      p50: row.p50,
      p95: row.p95,
      p99: row.p99,
      sampleSize: row.sampleSize,
    }))

    // ── Assemble error trend ────────────────────────────────────────────────
    const errorTrend: ErrorTrendPoint[] = errorTrendRows.map((row) => ({
      date: row.date,
      totalCount: row.totalCount,
      errorCount: row.errorCount,
      errorRate: row.totalCount > 0
        ? Math.round((row.errorCount / row.totalCount) * 10000) / 100
        : 0,
    }))

    // ── Assemble cost efficiency ────────────────────────────────────────────
    const costEfficiency: CostEfficiencyPoint[] = costRows.map((row) => ({
      date: row.date,
      revenueCents: row.revenueCents,
      invocations: row.invocations,
      revenuePerInvocationCents: row.invocations > 0
        ? Math.round((row.revenueCents / row.invocations) * 100) / 100
        : 0,
    }))

    const result: AdvancedAnalytics = {
      revenueTrend,
      cohortMetrics,
      latencyByTool,
      errorTrend,
      topConsumers: topConsumerRows,
      methodBreakdown: methodRows,
      hourlyHeatmap: heatmapRows,
      costEfficiency,
      referralAttribution: referralRows,
      periodDays,
    }

    return successResponse(result)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
