import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs, developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60


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

    // ── Tier gate: audit_logs requires Scale+ ──────────────────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'audit_logs', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Scale plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'scale', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
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
