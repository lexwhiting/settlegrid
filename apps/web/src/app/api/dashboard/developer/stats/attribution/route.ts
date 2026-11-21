import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations } from '@/lib/db/schema'
import { developerHasTools, invocationsOfDeveloper } from '@/lib/developer-invocations'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/dashboard/developer/stats/attribution — revenue attribution by referral source */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-attribution:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-attribution:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const emptyResult = {
      byReferralSource: [],
      sessionPatterns: [],
      topReferringAgents: [],
    }

    if (!(await developerHasTools(auth.id))) {
      return successResponse(emptyResult)
    }

    // Every tool the developer owns, deleted ones included, with no cap on how many
    const toolFilter = invocationsOfDeveloper(auth.id)

    // Revenue breakdown by referral code
    const byReferralSource = await db
      .select({
        referralCode: invocations.referralCode,
        invocationCount: sql<number>`count(*)::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(toolFilter)
      .groupBy(invocations.referralCode)
      .orderBy(sql`sum(${invocations.costCents}) desc`)
      .limit(50)

    // Session patterns — unique sessions per UTC day
    const utcDay = sql`(${invocations.createdAt} at time zone 'UTC')::date`
    const sessionPatterns = await db
      .select({
        date: sql<string>`to_char(${utcDay}, 'YYYY-MM-DD')`,
        uniqueSessions: sql<number>`count(distinct ${invocations.sessionId})::int`,
        totalInvocations: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(sql`${toolFilter} AND ${invocations.sessionId} IS NOT NULL`)
      .groupBy(utcDay)
      .orderBy(sql`${utcDay} desc`)
      .limit(30)

    // Top referring agents (by consumer spend with referral codes)
    const topReferringAgents = await db
      .select({
        referralCode: invocations.referralCode,
        uniqueConsumers: sql<number>`count(distinct ${invocations.consumerId})::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(sql`${toolFilter} AND ${invocations.referralCode} IS NOT NULL`)
      .groupBy(invocations.referralCode)
      .orderBy(sql`count(distinct ${invocations.consumerId}) desc`)
      .limit(20)

    return successResponse({
      byReferralSource,
      sessionPatterns,
      topReferringAgents,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
