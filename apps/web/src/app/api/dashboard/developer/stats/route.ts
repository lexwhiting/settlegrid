import { NextRequest } from 'next/server'
import { eq, sql, gte, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'

export async function GET(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // Get tool-level aggregates
    const developerTools = await db
      .select({
        id: tools.id,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolCount = developerTools.length
    const totalInvocations = developerTools.reduce((sum, t) => sum + t.totalInvocations, 0)
    const totalRevenueCents = developerTools.reduce((sum, t) => sum + t.totalRevenueCents, 0)

    // Get invocations from the last 24 hours, grouped by hour
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const toolIds = developerTools.map((t) => t.id)

    let recentInvocations: Array<{ hour: string; count: number; revenueCents: number }> = []

    if (toolIds.length > 0) {
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
            gte(invocations.createdAt, twentyFourHoursAgo),
            sql`${invocations.toolId} = ANY(${toolIds})`
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

    return successResponse({
      totalRevenueCents,
      totalInvocations,
      toolCount,
      recentInvocations,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
