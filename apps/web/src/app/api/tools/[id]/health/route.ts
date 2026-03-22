import { NextRequest } from 'next/server'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolHealthChecks } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/tools/[id]/health — tool health and uptime stats */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-health:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID')
    }

    // Check if tool exists
    const [tool] = await db
      .select({ id: tools.id, name: tools.name, developerId: tools.developerId })
      .from(tools)
      .where(eq(tools.id, id))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Check if requester is the tool owner (for detailed stats)
    let isOwner = false
    try {
      const auth = await requireDeveloper(request)
      isOwner = auth.id === tool.developerId
    } catch {
      // Not authenticated or not a developer — public view
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Latest health check
    const [latestCheck] = await db
      .select({
        status: toolHealthChecks.status,
        responseTimeMs: toolHealthChecks.responseTimeMs,
        checkedAt: toolHealthChecks.checkedAt,
      })
      .from(toolHealthChecks)
      .where(eq(toolHealthChecks.toolId, id))
      .orderBy(desc(toolHealthChecks.checkedAt))
      .limit(1)

    // Uptime percentage (last 30 days)
    const [uptimeStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        upCount: sql<number>`count(*) filter (where ${toolHealthChecks.status} = 'up')::int`,
        avgResponseTimeMs: sql<number>`coalesce(avg(${toolHealthChecks.responseTimeMs}), 0)::int`,
      })
      .from(toolHealthChecks)
      .where(sql`${toolHealthChecks.toolId} = ${id} AND ${toolHealthChecks.checkedAt} >= ${thirtyDaysAgo}`)

    const total = uptimeStats?.total ?? 0
    const uptimePct = total > 0 ? Math.round((uptimeStats.upCount / total) * 10000) / 100 : 100

    // Public response
    const publicResult = {
      toolId: tool.id,
      toolName: tool.name,
      currentStatus: latestCheck?.status ?? 'unknown',
      lastCheckedAt: latestCheck?.checkedAt ?? null,
      uptimePct30d: uptimePct,
      avgResponseTimeMs: uptimeStats?.avgResponseTimeMs ?? 0,
    }

    if (!isOwner) {
      return successResponse(publicResult)
    }

    // Detailed stats for owner: incident history
    const incidents = await db
      .select({
        status: toolHealthChecks.status,
        responseTimeMs: toolHealthChecks.responseTimeMs,
        checkedAt: toolHealthChecks.checkedAt,
      })
      .from(toolHealthChecks)
      .where(sql`${toolHealthChecks.toolId} = ${id} AND ${toolHealthChecks.status} != 'up' AND ${toolHealthChecks.checkedAt} >= ${thirtyDaysAgo}`)
      .orderBy(desc(toolHealthChecks.checkedAt))
      .limit(50)

    return successResponse({
      ...publicResult,
      incidents,
      totalChecks30d: total,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
