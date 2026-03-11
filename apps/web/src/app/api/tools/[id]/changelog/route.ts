import { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toolChangelogs } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/tools/[id]/changelog — public changelog for a tool */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-changelog:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID')
    }

    const changelogs = await db
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
      .limit(50)

    return successResponse({ changelogs })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
