import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/dashboard/developer/stats/attribution — revenue attribution by referral source */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-attribution:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    const emptyResult = {
      byReferralSource: [],
      sessionPatterns: [],
      topReferringAgents: [],
    }

    if (toolIds.length === 0) {
      return successResponse(emptyResult)
    }

    const toolFilter = sql`${invocations.toolId} = ANY(${toolIds})`

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

    // Session patterns — unique sessions per day
    const sessionPatterns = await db
      .select({
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        uniqueSessions: sql<number>`count(distinct ${invocations.sessionId})::int`,
        totalInvocations: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(sql`${toolFilter} AND ${invocations.sessionId} IS NOT NULL`)
      .groupBy(sql`${invocations.createdAt}::date`)
      .orderBy(sql`${invocations.createdAt}::date desc`)
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
