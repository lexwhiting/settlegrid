import { NextRequest } from 'next/server'
import { eq, sql, gte, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { dashboardToolsWhere, monthEarningsCents } from '@/lib/dashboard-scope'
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

    // Tool counts and lifetime earnings in SQL over every tool the developer owns, deleted ones included.
    const [toolTotals] = await db
      .select({
        toolCount: sql<number>`count(*) filter (where ${tools.status} = 'active')::int`,
        toolsCreated: sql<number>`count(*)::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)::bigint`,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(1)

    const toolCount = Number(toolTotals?.toolCount ?? 0)
    const toolsCreated = Number(toolTotals?.toolsCreated ?? 0)
    const totalRevenueCents = Number(toolTotals?.totalRevenueCents ?? 0)

    // Get invocations from the last 24 hours, grouped by hour
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    let recentInvocations: Array<{ hour: string; count: number; revenueCents: number }> = []
    let totalInvocations = 0
    let hasInvocations = false
    // Revenue this UTC calendar month (the basis of the progressive take)
    let monthRevenueCents = 0

    if (toolsCreated > 0) {
      // Activity: recorded calls, every status, on tools that aren't deleted (lib/dashboard-scope.ts).
      const [totals] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(invocations)
        .innerJoin(tools, eq(invocations.toolId, tools.id))
        .where(dashboardToolsWhere(auth.id))
        .limit(1)
      totalInvocations = Number(totals?.count ?? 0)

      // Last 24h by hour over every owned tool: calls skip deleted tools (activity), revenue keeps them (earnings).
      const recentRows = await db
        .select({
          hour: sql<string>`date_trunc('hour', ${invocations.createdAt})::text`,
          count: sql<number>`(count(*) filter (where ${tools.status} <> 'deleted'))::int`,
          revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        })
        .from(invocations)
        .innerJoin(tools, eq(invocations.toolId, tools.id))
        .where(
          and(
            eq(tools.developerId, auth.id),
            gte(invocations.createdAt, sql`${twentyFourHoursAgo.toISOString()}::timestamptz`)
          )
        )
        .groupBy(sql`date_trunc('hour', ${invocations.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${invocations.createdAt})`)
        .limit(24)

      recentInvocations = recentRows.map((row) => ({
        hour: row.hour,
        count: row.count,
        revenueCents: row.revenueCents,
      }))

      // Getting Started: has the developer ever made a call, on any tool?
      hasInvocations =
        totalInvocations > 0 ||
        (
          await db
            .select({ id: invocations.id })
            .from(invocations)
            .innerJoin(tools, eq(invocations.toolId, tools.id))
            .where(eq(tools.developerId, auth.id))
            .limit(1)
        ).length > 0

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
