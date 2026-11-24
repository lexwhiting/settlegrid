import { NextRequest } from 'next/server'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools, apiKeys, consumerToolBalances } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { utcDayStart, utcMonthStart, daysBefore, hoursBefore } from '@/lib/utc-periods'

export const maxDuration = 60

// ─── Constants ──────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TRANSACTIONS = 100
const ANOMALY_LOOKBACK_DAYS = 7
const SPENDING_SPIKE_MULTIPLIER = 2
const ERROR_RATE_SPIKE_MULTIPLIER = 3
const BUDGET_WARNING_PCT = 80

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPeriodCutoff(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'today':
      return utcDayStart(now)
    case 'week':
      return daysBefore(now, 7)
    case 'month':
    default:
      return utcMonthStart(now)
  }
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `explorer:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `explorer:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') ?? 'month'
    const toolId = url.searchParams.get('toolId')
    const status = url.searchParams.get('status')

    // Validate period
    if (!['today', 'week', 'month'].includes(period)) {
      return errorResponse('Invalid period. Use: today, week, month.', 400, 'INVALID_PERIOD')
    }
    // Validate optional filters
    if (toolId && !UUID_REGEX.test(toolId)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }
    if (status && !['success', 'error', 'timeout'].includes(status)) {
      return errorResponse('Invalid status filter. Use: success, error, timeout.', 400, 'INVALID_STATUS')
    }

    const periodCutoff = getPeriodCutoff(period)

    // ── Build conditions ────────────────────────────────────────────────────
    const baseConditions = [
      eq(invocations.consumerId, auth.id),
      gte(invocations.createdAt, sql`${periodCutoff.toISOString()}::timestamptz`),
    ]
    if (toolId) baseConditions.push(eq(invocations.toolId, toolId))
    if (status) baseConditions.push(eq(invocations.status, status))

    // ── Fetch transactions ──────────────────────────────────────────────────
    const transactions = await db
      .select({
        id: invocations.id,
        toolId: invocations.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        apiKeyId: invocations.apiKeyId,
        method: invocations.method,
        costCents: invocations.costCents,
        latencyMs: invocations.latencyMs,
        status: invocations.status,
        createdAt: invocations.createdAt,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(...baseConditions))
      .orderBy(desc(invocations.createdAt))
      .limit(MAX_TRANSACTIONS)

    // ── Fetch all-period data for stats (unfiltered by toolId/status) ───────
    const allPeriodConditions = [
      eq(invocations.consumerId, auth.id),
      gte(invocations.createdAt, sql`${periodCutoff.toISOString()}::timestamptz`),
    ]

    const allPeriodData = await db
      .select({
        toolId: invocations.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        apiKeyId: invocations.apiKeyId,
        costCents: invocations.costCents,
        latencyMs: invocations.latencyMs,
        status: invocations.status,
        createdAt: invocations.createdAt,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(...allPeriodConditions))
      .orderBy(desc(invocations.createdAt))
      .limit(5000)

    // ── Compute header stats ────────────────────────────────────────────────
    // Today, the rolling week and this month always cover their own windows, whatever
    // period is selected, and have no row cap; the average response time covers the
    // selected period.
    const now = new Date()
    const todayCutoff = utcDayStart(now)
    const weekCutoff = daysBefore(now, 7)
    const monthCutoff = utcMonthStart(now)
    const statsFrom = new Date(Math.min(weekCutoff.getTime(), monthCutoff.getTime(), periodCutoff.getTime()))
    const since = (d: Date) => sql`${invocations.createdAt} >= ${d.toISOString()}::timestamptz`
    const [agg] = await db
      .select({
        spentToday: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where ${since(todayCutoff)}), 0))::int`,
        spentWeek: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where ${since(weekCutoff)}), 0))::int`,
        spentMonth: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where ${since(monthCutoff)}), 0))::int`,
        callsToday: sql<number>`(count(*) filter (where ${since(todayCutoff)}))::int`,
        callsWeek: sql<number>`(count(*) filter (where ${since(weekCutoff)}))::int`,
        callsMonth: sql<number>`(count(*) filter (where ${since(monthCutoff)}))::int`,
        avgLatencyMs: sql<number | null>`avg(${invocations.latencyMs}) filter (where ${since(periodCutoff)} and ${invocations.latencyMs} is not null)`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(eq(invocations.consumerId, auth.id), since(statsFrom)))

    const spentToday = agg?.spentToday ?? 0
    const spentWeek = agg?.spentWeek ?? 0
    const spentMonth = agg?.spentMonth ?? 0
    const callsToday = agg?.callsToday ?? 0
    const callsWeek = agg?.callsWeek ?? 0
    const callsMonth = agg?.callsMonth ?? 0
    const avgCostCents = callsMonth > 0 ? Math.round(spentMonth / callsMonth) : 0
    const avgResponseMs = agg?.avgLatencyMs != null ? Math.round(Number(agg.avgLatencyMs)) : 0

    const stats = {
      spentToday,
      spentWeek,
      spentMonth,
      callsToday,
      callsWeek,
      callsMonth,
      avgCostCents,
      avgResponseMs,
    }

    // ── Per-tool breakdown ──────────────────────────────────────────────────
    const toolBreakdown = new Map<string, {
      toolId: string
      toolName: string
      toolSlug: string
      totalCalls: number
      totalSpentCents: number
      totalLatencyMs: number
      latencyCount: number
      errorCount: number
      lastCalledAt: string
    }>()

    for (const row of allPeriodData) {
      const existing = toolBreakdown.get(row.toolId)
      const cost = Number.isFinite(row.costCents) ? row.costCents : 0
      const latency = row.latencyMs !== null && Number.isFinite(row.latencyMs) ? row.latencyMs : 0
      const hasLatency = row.latencyMs !== null && Number.isFinite(row.latencyMs)
      const isError = row.status === 'error' || row.status === 'timeout'
      const ts = new Date(row.createdAt).toISOString()

      if (existing) {
        existing.totalCalls += 1
        existing.totalSpentCents += cost
        existing.totalLatencyMs += latency
        existing.latencyCount += hasLatency ? 1 : 0
        existing.errorCount += isError ? 1 : 0
        if (ts > existing.lastCalledAt) existing.lastCalledAt = ts
      } else {
        toolBreakdown.set(row.toolId, {
          toolId: row.toolId,
          toolName: row.toolName,
          toolSlug: row.toolSlug,
          totalCalls: 1,
          totalSpentCents: cost,
          totalLatencyMs: latency,
          latencyCount: hasLatency ? 1 : 0,
          errorCount: isError ? 1 : 0,
          lastCalledAt: ts,
        })
      }
    }

    const perTool = Array.from(toolBreakdown.values()).map((t) => ({
      toolId: t.toolId,
      toolName: t.toolName,
      toolSlug: t.toolSlug,
      totalCalls: t.totalCalls,
      totalSpentCents: t.totalSpentCents,
      avgCostCents: t.totalCalls > 0 ? Math.round(t.totalSpentCents / t.totalCalls) : 0,
      avgResponseMs: t.latencyCount > 0 ? Math.round(t.totalLatencyMs / t.latencyCount) : 0,
      errorRate: t.totalCalls > 0 ? Number(((t.errorCount / t.totalCalls) * 100).toFixed(1)) : 0,
      lastCalledAt: t.lastCalledAt,
    }))

    // ── Per-API-key breakdown (proxy for per-agent) ─────────────────────────
    const keyBreakdown = new Map<string, {
      apiKeyId: string
      keyPrefix: string
      totalCalls: number
      totalSpentCents: number
      lastActiveAt: string
    }>()

    for (const row of allPeriodData) {
      const existing = keyBreakdown.get(row.apiKeyId)
      const cost = Number.isFinite(row.costCents) ? row.costCents : 0
      const ts = new Date(row.createdAt).toISOString()

      if (existing) {
        existing.totalCalls += 1
        existing.totalSpentCents += cost
        if (ts > existing.lastActiveAt) existing.lastActiveAt = ts
      } else {
        keyBreakdown.set(row.apiKeyId, {
          apiKeyId: row.apiKeyId,
          keyPrefix: '',
          totalCalls: 1,
          totalSpentCents: cost,
          lastActiveAt: ts,
        })
      }
    }

    // Fetch key prefixes for display
    const keyIds = Array.from(keyBreakdown.keys())
    if (keyIds.length > 0) {
      const keyRows = await db
        .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix })
        .from(apiKeys)
        .where(sql`${apiKeys.id} IN (${sql.join(keyIds.map(k => sql`${k}::uuid`), sql`, `)})`)
        .limit(100)

      for (const kr of keyRows) {
        const entry = keyBreakdown.get(kr.id)
        if (entry) entry.keyPrefix = kr.keyPrefix
      }
    }

    // Fetch budget info for per-agent remaining balance
    const balances = await db
      .select({
        toolId: consumerToolBalances.toolId,
        balanceCents: consumerToolBalances.balanceCents,
        spendingLimitCents: consumerToolBalances.spendingLimitCents,
        currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
      })
      .from(consumerToolBalances)
      .where(eq(consumerToolBalances.consumerId, auth.id))
      .limit(100)

    const totalBudgetRemainingCents = balances.reduce((sum, b) => sum + b.balanceCents, 0)

    const perAgent = Array.from(keyBreakdown.values()).map((k) => ({
      apiKeyId: k.apiKeyId,
      keyPrefix: k.keyPrefix,
      totalCalls: k.totalCalls,
      totalSpentCents: k.totalSpentCents,
      budgetRemainingCents: totalBudgetRemainingCents,
      lastActiveAt: k.lastActiveAt,
    }))

    // ── Anomaly detection ───────────────────────────────────────────────────
    interface Anomaly {
      type: string
      severity: 'warning' | 'critical'
      description: string
      timestamp: string
    }
    const anomalies: Anomaly[] = []

    // Fetch 7-day lookback data for baseline
    const lookbackCutoff = daysBefore(new Date(), ANOMALY_LOOKBACK_DAYS)
    const hourAgo = hoursBefore(new Date(), 1)

    const lookbackData = await db
      .select({
        costCents: invocations.costCents,
        status: invocations.status,
        toolId: invocations.toolId,
        createdAt: invocations.createdAt,
      })
      .from(invocations)
      .where(
        and(
          eq(invocations.consumerId, auth.id),
          gte(invocations.createdAt, sql`${lookbackCutoff.toISOString()}::timestamptz`)
        )
      )
      .limit(10000)

    // Compute daily averages and recent-hour metrics
    let lookbackTotalSpend = 0
    let lookbackTotalErrors = 0
    let lookbackTotalCalls = 0
    let recentHourSpend = 0
    let recentHourErrors = 0
    let recentHourCalls = 0
    const knownTools = new Set<string>()
    const recentTools = new Set<string>()

    for (const row of lookbackData) {
      const ts = new Date(row.createdAt)
      const cost = Number.isFinite(row.costCents) ? row.costCents : 0
      const isError = row.status === 'error' || row.status === 'timeout'

      lookbackTotalSpend += cost
      lookbackTotalCalls += 1
      if (isError) lookbackTotalErrors += 1

      if (ts >= hourAgo) {
        recentHourSpend += cost
        recentHourCalls += 1
        if (isError) recentHourErrors += 1
        recentTools.add(row.toolId)
      } else {
        knownTools.add(row.toolId)
      }
    }

    const hoursInLookback = ANOMALY_LOOKBACK_DAYS * 24
    const avgHourlySpend = hoursInLookback > 0 ? lookbackTotalSpend / hoursInLookback : 0
    const avgHourlyErrors = hoursInLookback > 0 ? lookbackTotalErrors / hoursInLookback : 0
    const avgHourlyCalls = hoursInLookback > 0 ? lookbackTotalCalls / hoursInLookback : 0
    const baselineErrorRate = lookbackTotalCalls > 0 ? lookbackTotalErrors / lookbackTotalCalls : 0
    const recentErrorRate = recentHourCalls > 0 ? recentHourErrors / recentHourCalls : 0

    const nowIso = now.toISOString()

    // Spending spike: current hour spend > 2x hourly average
    if (avgHourlySpend > 0 && recentHourSpend > avgHourlySpend * SPENDING_SPIKE_MULTIPLIER) {
      anomalies.push({
        type: 'spending_spike',
        severity: recentHourSpend > avgHourlySpend * 4 ? 'critical' : 'warning',
        description: `Spending in the last hour ($${(recentHourSpend / 100).toFixed(2)}) is ${(recentHourSpend / avgHourlySpend).toFixed(1)}x the hourly average ($${(avgHourlySpend / 100).toFixed(2)}).`,
        timestamp: nowIso,
      })
    }

    // Error spike: recent error rate > 3x baseline (and baseline < 5%)
    if (baselineErrorRate < 0.05 && recentErrorRate > 0.2 && recentHourCalls >= 5) {
      anomalies.push({
        type: 'error_spike',
        severity: recentErrorRate > 0.5 ? 'critical' : 'warning',
        description: `Error rate in the last hour is ${(recentErrorRate * 100).toFixed(0)}% (${recentHourErrors} errors in ${recentHourCalls} calls). Baseline is ${(baselineErrorRate * 100).toFixed(1)}%.`,
        timestamp: nowIso,
      })
    } else if (avgHourlyCalls > 0 && recentHourErrors > avgHourlyErrors * ERROR_RATE_SPIKE_MULTIPLIER && recentHourErrors >= 3) {
      anomalies.push({
        type: 'error_spike',
        severity: 'warning',
        description: `${recentHourErrors} errors in the last hour, compared to an average of ${avgHourlyErrors.toFixed(1)} per hour.`,
        timestamp: nowIso,
      })
    }

    // New tool usage: tool called for the first time in the last hour
    for (const tid of recentTools) {
      if (!knownTools.has(tid)) {
        const toolInfo = perTool.find((t) => t.toolId === tid)
        anomalies.push({
          type: 'new_tool',
          severity: 'warning',
          description: `First-time usage of tool "${toolInfo?.toolName ?? tid}" detected.`,
          timestamp: nowIso,
        })
      }
    }

    // Budget approaching limit
    for (const b of balances) {
      if (b.spendingLimitCents && b.spendingLimitCents > 0) {
        const pct = (b.currentPeriodSpendCents / b.spendingLimitCents) * 100
        if (pct >= BUDGET_WARNING_PCT) {
          const toolInfo = perTool.find((t) => t.toolId === b.toolId)
          anomalies.push({
            type: 'budget_limit',
            severity: pct >= 95 ? 'critical' : 'warning',
            description: `Budget for "${toolInfo?.toolName ?? b.toolId}" is at ${pct.toFixed(0)}% (${(b.currentPeriodSpendCents / 100).toFixed(2)} of ${(b.spendingLimitCents / 100).toFixed(2)} limit).`,
            timestamp: nowIso,
          })
        }
      }
    }

    return successResponse({
      stats,
      transactions,
      perTool,
      perAgent,
      anomalies,
      period,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
