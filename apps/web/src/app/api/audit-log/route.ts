import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 10

/** GET /api/audit-log — paginated audit log entries for the authenticated developer */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `audit-log:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const resourceType = url.searchParams.get('resourceType')
    const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const offsetParam = parseInt(url.searchParams.get('offset') ?? '0', 10)

    const limit = Math.min(Math.max(limitParam, 1), 200)
    const offset = Math.max(offsetParam, 0)

    // Build conditions
    const conditions = [eq(auditLogs.developerId, auth.id)]

    if (action) {
      conditions.push(eq(auditLogs.action, action))
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType))
    }

    // Get total count for pagination
    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...conditions))

    const total = countResult?.total ?? 0

    // Get paginated entries
    const entries = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset)

    return successResponse({
      entries,
      total,
      limit,
      offset,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
