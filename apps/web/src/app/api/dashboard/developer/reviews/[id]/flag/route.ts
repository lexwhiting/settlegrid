import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/** POST /api/dashboard/developer/reviews/[id]/flag — flag a review for admin review */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-review-flag:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params

    // Verify the review belongs to one of the developer's tools
    const [review] = await db
      .select({
        id: toolReviews.id,
        reportedAt: toolReviews.reportedAt,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(and(eq(toolReviews.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!review) {
      return errorResponse('Review not found or not associated with your tools.', 404, 'NOT_FOUND')
    }

    if (review.reportedAt) {
      return errorResponse('This review has already been flagged.', 409, 'ALREADY_FLAGGED')
    }

    await db
      .update(toolReviews)
      .set({
        reportedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(toolReviews.id, id))

    return successResponse({ success: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
