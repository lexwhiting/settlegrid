import { NextRequest } from 'next/server'
import { eq, sql, gte, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { invocationsOfDeveloper, monthEarningsCents } from '@/lib/developer-invocations'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-stats:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-stats:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Tool-level aggregates over every tool the developer owns, in SQL (no row cap).
    // "Active Tools" is the number with status 'active'; the all-time counters and
    // toolsCreated cover every tool, deleted ones included.
    const [toolTotals] = await db
      .select({
        toolCount: sql<number>`(count(*) filter (where ${tools.status} = 'active'))::int`,
        toolsCreated: sql<number>`count(*)::int`,
        totalInvocations: sql<number>`coalesce(sum(${tools.totalInvocations}), 0)::bigint`,
        totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)::bigint`,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(1)

    const toolCount = Number(toolTotals?.toolCount ?? 0)
    const toolsCreated = Number(toolTotals?.toolsCreated ?? 0)
    const totalInvocations = Number(toolTotals?.totalInvocations ?? 0)
    const totalRevenueCents = Number(toolTotals?.totalRevenueCents ?? 0)

    // Get invocations from the last 24 hours, grouped by hour
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const ownInvocations = invocationsOfDeveloper(auth.id)

    let recentInvocations: Array<{ hour: string; count: number; revenueCents: number }> = []
    // Getting Started: any call ever counted, or any call still in the logs
    let hasInvocations = totalInvocations > 0
    // Revenue this UTC calendar month (the basis of the progressive take)
    let monthRevenueCents = 0

    if (toolsCreated > 0) {
      // Get recent invocations for all developer's tools
      const recentRows = await db
        .select({
          hour: sql<string>`date_trunc('hour', ${invocations.createdAt})::text`,
          count: sql<number>`count(*)::int`,
          revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        })
        .from(invocations)
        .where(
          and(
            gte(invocations.createdAt, sql`${twentyFourHoursAgo.toISOString()}::timestamptz`),
            ownInvocations
          )
        )
        .groupBy(sql`date_trunc('hour', ${invocations.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${invocations.createdAt})`)
        .limit(25) // a rolling 24 hours touches up to 25 clock-hour buckets

      recentInvocations = recentRows.map((row) => ({
        hour: row.hour,
        count: row.count,
        revenueCents: row.revenueCents,
      }))

      if (!hasInvocations) {
        const anyCall = await db.select({ id: invocations.id }).from(invocations).where(ownInvocations).limit(1)
        hasInvocations = anyCall.length > 0
      }

      monthRevenueCents = await monthEarningsCents(auth.id)
    }

    return successResponse({
      totalRevenueCents,
      monthRevenueCents,
      totalInvocations,
      hasInvocations,
      toolCount,
      toolsCreated,
      recentInvocations,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
