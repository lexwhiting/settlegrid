import { NextRequest } from 'next/server'
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toolReviews, tools, consumers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/**
 * GET /api/admin/reviews — List reviews for admin moderation
 *
 * Query params:
 *   ?status=flagged  — reviews with reportedAt IS NOT NULL
 *   ?status=hidden   — reviews with status='hidden' or 'removed'
 *   ?status=all      — all reviews (default)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `admin-reviews:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      return errorResponse('Forbidden. Admin access required.', 403, 'FORBIDDEN')
    }

    const filterStatus = request.nextUrl.searchParams.get('status') ?? 'all'

    let whereClause
    switch (filterStatus) {
      case 'flagged':
        whereClause = and(
          isNotNull(toolReviews.reportedAt),
          eq(toolReviews.status, 'visible'),
        )
        break
      case 'hidden':
        whereClause = sql`${toolReviews.status} IN ('hidden', 'removed')`
        break
      case 'all':
      default:
        whereClause = undefined
        break
    }

    const reviews = await db
      .select({
        id: toolReviews.id,
        toolId: toolReviews.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        consumerId: toolReviews.consumerId,
        consumerEmail: consumers.email,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        developerResponse: toolReviews.developerResponse,
        reportedAt: toolReviews.reportedAt,
        status: toolReviews.status,
        hideReason: toolReviews.hideReason,
        hiddenAt: toolReviews.hiddenAt,
        createdAt: toolReviews.createdAt,
        updatedAt: toolReviews.updatedAt,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .innerJoin(consumers, eq(toolReviews.consumerId, consumers.id))
      .where(whereClause)
      .orderBy(desc(toolReviews.reportedAt), desc(toolReviews.createdAt))
      .limit(100)

    logger.info('admin.reviews_listed', { email: auth.email, filter: filterStatus, count: reviews.length })

    return successResponse({ reviews })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
