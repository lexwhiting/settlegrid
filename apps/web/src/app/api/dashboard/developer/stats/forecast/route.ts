import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 30

// ─── Types ────────────────────────────────────────────────────────────────────

type Trend = 'growing' | 'stable' | 'declining'

interface ForecastResult {
  currentMonthRevenueCents: number
  projectedNextMonthCents: number
  growthRate: number
  trend: Trend
  dailyDataPoints: number
  confidence: 'low' | 'medium' | 'high'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 30
const PROJECTION_DAYS = 30
const GROWTH_THRESHOLD = 0.05 // 5% growth rate threshold
const MIN_DATA_POINTS_HIGH = 20
const MIN_DATA_POINTS_MEDIUM = 7

/**
 * Simple linear regression: y = mx + b
 * Returns slope (m), intercept (b), and R-squared
 */
function linearRegression(data: Array<{ x: number; y: number }>): {
  slope: number
  intercept: number
  rSquared: number
} {
  const n = data.length
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 }
  if (n === 1) return { slope: 0, intercept: data[0].y, rSquared: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const point of data) {
    sumX += point.x
    sumY += point.y
    sumXY += point.x * point.y
    sumXX += point.x * point.x
  }

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // R-squared
  const meanY = sumY / n
  let ssRes = 0
  let ssTot = 0
  for (const point of data) {
    const predicted = slope * point.x + intercept
    ssRes += (point.y - predicted) ** 2
    ssTot += (point.y - meanY) ** 2
  }
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, rSquared }
}

/** GET /api/dashboard/developer/stats/forecast — revenue forecast (Builder+) */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-forecast:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: revenue_forecasting requires Builder+ ────────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'revenue_forecasting', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Builder plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'builder', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    // ── Get developer's tools ───────────────────────────────────────────
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    // Empty defaults
    const emptyForecast: ForecastResult = {
      currentMonthRevenueCents: 0,
      projectedNextMonthCents: 0,
      growthRate: 0,
      trend: 'stable',
      dailyDataPoints: 0,
      confidence: 'low',
    }

    if (toolIds.length === 0) {
      return successResponse(emptyForecast)
    }

    // ── Get daily revenue for last 30 days ──────────────────────────────
    const lookbackStart = new Date()
    lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS)

    const dailyRevenue = await db
      .select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        gte(invocations.createdAt, sql`${lookbackStart.toISOString()}::timestamptz`),
      ))
      .groupBy(sql`${invocations.createdAt}::date`)
      .orderBy(sql`${invocations.createdAt}::date`)
      .limit(LOOKBACK_DAYS)

    if (dailyRevenue.length === 0) {
      return successResponse(emptyForecast)
    }

    // ── Calculate current month revenue ─────────────────────────────────
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const currentMonthRevenueCents = dailyRevenue
      .filter((d) => d.date >= monthStartStr)
      .reduce((sum, d) => sum + d.revenueCents, 0)

    // ── Linear regression on daily revenue ──────────────────────────────
    const regressionData = dailyRevenue.map((d, idx) => ({
      x: idx,
      y: d.revenueCents,
    }))

    const { slope, intercept, rSquared } = linearRegression(regressionData)

    // Project next 30 days: sum of predicted daily values
    const lastIdx = regressionData.length - 1
    let projectedNextMonthCents = 0
    for (let i = 1; i <= PROJECTION_DAYS; i++) {
      const predicted = slope * (lastIdx + i) + intercept
      // Floor at 0 — revenue can't be negative
      projectedNextMonthCents += Math.max(0, Math.round(predicted))
    }

    // ── Calculate growth rate ───────────────────────────────────────────
    // Compare last 15 days avg to first 15 days avg
    const midpoint = Math.floor(dailyRevenue.length / 2)
    const firstHalf = dailyRevenue.slice(0, midpoint)
    const secondHalf = dailyRevenue.slice(midpoint)

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((s, d) => s + d.revenueCents, 0) / firstHalf.length
      : 0
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((s, d) => s + d.revenueCents, 0) / secondHalf.length
      : 0

    const growthRate = firstHalfAvg > 0
      ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 10000) / 10000
      : 0

    // ── Determine trend ─────────────────────────────────────────────────
    let trend: Trend
    if (growthRate > GROWTH_THRESHOLD) {
      trend = 'growing'
    } else if (growthRate < -GROWTH_THRESHOLD) {
      trend = 'declining'
    } else {
      trend = 'stable'
    }

    // ── Confidence level ────────────────────────────────────────────────
    const dataPoints = dailyRevenue.length
    let confidence: 'low' | 'medium' | 'high'
    if (dataPoints >= MIN_DATA_POINTS_HIGH && rSquared > 0.5) {
      confidence = 'high'
    } else if (dataPoints >= MIN_DATA_POINTS_MEDIUM) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    const result: ForecastResult = {
      currentMonthRevenueCents,
      projectedNextMonthCents,
      growthRate,
      trend,
      dailyDataPoints: dataPoints,
      confidence,
    }

    return successResponse(result)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
