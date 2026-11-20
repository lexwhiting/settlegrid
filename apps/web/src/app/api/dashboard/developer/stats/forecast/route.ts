import { NextRequest } from 'next/server'
import { eq, sql, gte, lt, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { invocationsOfDeveloper, monthEarningsCents } from '@/lib/developer-invocations'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'
import { denseDailyCents, forecastFromDailyCents } from '@/lib/revenue-forecast'

export const maxDuration = 30

// ─── Types ────────────────────────────────────────────────────────────────────

type Trend = 'growing' | 'stable' | 'declining'

interface ForecastResult {
  currentMonthRevenueCents: number
  projectedNextMonthCents: number
  growthRate: number
  trend: Trend
  /** Days with revenue in the lookback window */
  dailyDataPoints: number
  confidence: 'low' | 'medium' | 'high'
  /** Fewer than MIN_DATA_POINTS_MEDIUM days with revenue: no projection or trend is given */
  insufficientData?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 30
const PROJECTION_DAYS = 30
const GROWTH_THRESHOLD = 0.05 // 5% growth rate threshold
const MIN_DATA_POINTS_HIGH = 20
const MIN_DATA_POINTS_MEDIUM = 7

/** GET /api/dashboard/developer/stats/forecast — revenue forecast (Builder+) */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-forecast:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-forecast:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

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

    // The response whenever there is too little data to forecast from. This month's
    // revenue comes from the same query the stats route uses.
    const currentMonthRevenueCents = await monthEarningsCents(auth.id)
    const emptyForecast: ForecastResult = {
      currentMonthRevenueCents,
      projectedNextMonthCents: 0,
      growthRate: 0,
      trend: 'stable',
      dailyDataPoints: 0,
      confidence: 'low',
      insufficientData: true,
    }

    // ── Get daily revenue for the last 30 complete UTC days ─────────────
    // Today is left out: a part-day would read as a drop in revenue.
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const lookbackStart = new Date(todayStart.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const utcDay = sql`(${invocations.createdAt} at time zone 'UTC')::date`

    const dailyRevenue = await db
      .select({
        date: sql<string>`to_char(${utcDay}, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(and(
        invocationsOfDeveloper(auth.id),
        gte(invocations.createdAt, sql`${lookbackStart.toISOString()}::timestamptz`),
        lt(invocations.createdAt, sql`${todayStart.toISOString()}::timestamptz`),
      ))
      .groupBy(utcDay)
      .orderBy(utcDay)
      .limit(LOOKBACK_DAYS)

    // A projection or trend from a handful of days is noise (one day of revenue read
    // as "-100% declining"). Days whose calls earned nothing don't count.
    const revenueDays = dailyRevenue.filter((d) => d.revenueCents > 0).length
    if (revenueDays < MIN_DATA_POINTS_MEDIUM) {
      return successResponse({ ...emptyForecast, dailyDataPoints: revenueDays })
    }

    // ── Projection and growth over every day of the window ─────────────
    // Days without calls have no row; they count as 0, so revenue spread over
    // the month is not read as consecutive days.
    const series = denseDailyCents(dailyRevenue, lookbackStart, LOOKBACK_DAYS)
    const { projectedCents: projectedNextMonthCents, growthRate, rSquared } =
      forecastFromDailyCents(series, PROJECTION_DAYS)

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
    const dataPoints = revenueDays
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
