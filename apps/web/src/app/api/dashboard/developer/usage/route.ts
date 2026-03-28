import { NextRequest } from 'next/server'
import { eq, sql, and, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/** Tier-to-monthly-ops-limit mapping */
const TIER_OPS_LIMITS: Record<string, number> = {
  standard: 50_000,
  builder: 200_000,
  scale: 2_000_000,
  enterprise: 10_000_000,
}

/**
 * GET /api/dashboard/developer/usage
 *
 * Returns the developer's current month usage vs tier limit:
 * - currentMonthOps: total invocations this calendar month
 * - tierLimit: ops limit for their tier
 * - tier: developer's tier name
 * - usagePercent: 0-100+ (can exceed 100 if over limit)
 * - periodStart/periodEnd: ISO date boundaries
 * - daysRemaining: days left in billing period
 * - overLimit: true if currentMonthOps > tierLimit
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-usage:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // Get developer's tier and founding member status
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    const isFoundingMember = developer?.isFoundingMember ?? false
    const tier = isFoundingMember ? 'scale' : (developer?.tier ?? 'standard')
    const tierLimit = TIER_OPS_LIMITS[tier] ?? TIER_OPS_LIMITS.standard

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    // Calculate current month boundaries
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysRemaining = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )

    // Count invocations for developer's tools this calendar month
    let currentMonthOps = 0

    if (toolIds.length > 0) {
      const [result] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(invocations)
        .where(
          and(
            inArray(invocations.toolId, toolIds),
            gte(invocations.createdAt, sql`${periodStart.toISOString()}::timestamptz`)
          )
        )
        .limit(1)

      currentMonthOps = result?.count ?? 0
    }

    const usagePercent = tierLimit > 0
      ? Math.round((currentMonthOps / tierLimit) * 1000) / 10
      : 0
    const overLimit = currentMonthOps > tierLimit

    return successResponse({
      currentMonthOps,
      tierLimit,
      tier,
      isFoundingMember,
      usagePercent,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      daysRemaining,
      overLimit,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
