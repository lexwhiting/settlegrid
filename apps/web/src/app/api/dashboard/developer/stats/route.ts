import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
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

    // All of the developer's tools, deleted ones included: earnings below cover every tool.
    const developerTools = await db
      .select({
        id: tools.id,
        status: tools.status,
        totalRevenueCents: tools.totalRevenueCents,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    // Activity metrics cover tools that aren't deleted (lib/dashboard-scope.ts).
    const visibleTools = developerTools.filter((t) => t.status !== 'deleted')
    const toolCount = developerTools.filter((t) => t.status === 'active').length
    const toolsCreated = developerTools.length
    const totalRevenueCents = developerTools.reduce((sum, t) => sum + t.totalRevenueCents, 0)

    // Get invocations from the last 24 hours, grouped by hour
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const toolIds = developerTools.map((t) => t.id)
    const visibleToolIds = visibleTools.map((t) => t.id)

    let recentInvocations: Array<{ hour: string; count: number; revenueCents: number }> = []
    let totalInvocations = 0
    let hasInvocations = false
    // Revenue this UTC calendar month (the basis of the progressive take)
    let monthRevenueCents = 0

    if (toolIds.length > 0) {
      // Recorded calls, every status, on tools that aren't deleted (matches Analytics).
      if (visibleToolIds.length > 0) {
        const [totals] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(invocations)
          .where(inArray(invocations.toolId, visibleToolIds))
          .limit(1)
        totalInvocations = Number(totals?.count ?? 0)

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
              inArray(invocations.toolId, visibleToolIds)
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
      }

      // Getting Started: has the developer ever made a call, on any tool?
      hasInvocations =
        totalInvocations > 0 ||
        (
          await db
            .select({ id: invocations.id })
            .from(invocations)
            .where(inArray(invocations.toolId, toolIds))
            .limit(1)
        ).length > 0

      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const monthRows = await db
        .select({ revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int` })
        .from(invocations)
        .where(
          and(
            gte(invocations.createdAt, sql`${monthStart.toISOString()}::timestamptz`),
            inArray(invocations.toolId, toolIds)
          )
        )
        .limit(1)
      monthRevenueCents = Number(monthRows[0]?.revenueCents ?? 0)
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
