import { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toolChangelogs, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/tools/[id]/versions — full version history from toolChangelogs */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-versions:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID', requestId)
    }

    // Verify tool exists
    const [tool] = await db
      .select({ id: tools.id, currentVersion: tools.currentVersion })
      .from(tools)
      .where(eq(tools.id, id))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    // Fetch full version history
    const versions = await db
      .select({
        id: toolChangelogs.id,
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        details: toolChangelogs.details,
        createdAt: toolChangelogs.createdAt,
      })
      .from(toolChangelogs)
      .where(eq(toolChangelogs.toolId, id))
      .orderBy(desc(toolChangelogs.createdAt))
      .limit(100)

    return successResponse({
      currentVersion: tool.currentVersion,
      versions,
    }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
