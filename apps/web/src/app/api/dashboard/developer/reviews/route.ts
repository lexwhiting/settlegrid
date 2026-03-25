import { NextRequest } from 'next/server'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews, consumers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/** GET /api/dashboard/developer/reviews — list all reviews across the developer's tools */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-reviews:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Parse optional filters from query params
    const { searchParams } = new URL(request.url)
    const toolIdFilter = searchParams.get('toolId')
    const ratingFilter = searchParams.get('rating')
    const respondedFilter = searchParams.get('responded')

    // Build where conditions
    const conditions = [eq(tools.developerId, auth.id)]
    if (toolIdFilter) {
      conditions.push(eq(tools.id, toolIdFilter))
    }
    if (ratingFilter) {
      const ratingNum = parseInt(ratingFilter, 10)
      if (ratingNum >= 1 && ratingNum <= 5) {
        conditions.push(eq(toolReviews.rating, ratingNum))
      }
    }
    if (respondedFilter === 'true') {
      conditions.push(sql`${toolReviews.developerResponse} IS NOT NULL`)
    } else if (respondedFilter === 'false') {
      conditions.push(sql`${toolReviews.developerResponse} IS NULL`)
    }

    const reviews = await db
      .select({
        id: toolReviews.id,
        toolId: tools.id,
        toolName: tools.name,
        toolSlug: tools.slug,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        consumerEmail: consumers.email,
        developerResponse: toolReviews.developerResponse,
        developerRespondedAt: toolReviews.developerRespondedAt,
        reportedAt: toolReviews.reportedAt,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .innerJoin(consumers, eq(toolReviews.consumerId, consumers.id))
      .where(and(...conditions))
      .orderBy(desc(toolReviews.createdAt))
      .limit(100)

    // Derive consumer display name from email (first part before @, or initials)
    const mapped = reviews.map((r) => {
      const emailLocal = r.consumerEmail.split('@')[0] ?? 'User'
      // Show first name-like portion only (up to first dot/underscore/digit)
      const displayName = emailLocal.split(/[._+0-9]/)[0] ?? 'User'
      const capitalized = displayName.charAt(0).toUpperCase() + displayName.slice(1)
      return {
        id: r.id,
        toolId: r.toolId,
        toolName: r.toolName,
        toolSlug: r.toolSlug,
        rating: r.rating,
        comment: r.comment,
        consumerName: capitalized,
        developerResponse: r.developerResponse,
        developerRespondedAt: r.developerRespondedAt,
        reportedAt: r.reportedAt,
        createdAt: r.createdAt,
      }
    })

    return successResponse({ reviews: mapped })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
