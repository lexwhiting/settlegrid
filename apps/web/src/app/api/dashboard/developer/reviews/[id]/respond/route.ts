import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const respondSchema = z.object({
  response: z.string().min(1, 'Response cannot be empty').max(1000, 'Response must be 1000 characters or fewer'),
})

/** PUT /api/dashboard/developer/reviews/[id]/respond — create or update a developer response */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-review-respond:${ip}`)
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
    const body = await parseBody(request, respondSchema)

    // Verify the review belongs to one of the developer's tools
    const [review] = await db
      .select({
        id: toolReviews.id,
        toolId: toolReviews.toolId,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(and(eq(toolReviews.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!review) {
      return errorResponse('Review not found or not associated with your tools.', 404, 'NOT_FOUND')
    }

    // Update the developer response
    const [updated] = await db
      .update(toolReviews)
      .set({
        developerResponse: body.response,
        developerRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(toolReviews.id, id))
      .returning({
        id: toolReviews.id,
        developerResponse: toolReviews.developerResponse,
        developerRespondedAt: toolReviews.developerRespondedAt,
      })

    return successResponse({ review: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** DELETE /api/dashboard/developer/reviews/[id]/respond — remove a developer response */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-review-respond:${ip}`)
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
      .select({ id: toolReviews.id })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(and(eq(toolReviews.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!review) {
      return errorResponse('Review not found or not associated with your tools.', 404, 'NOT_FOUND')
    }

    await db
      .update(toolReviews)
      .set({
        developerResponse: null,
        developerRespondedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(toolReviews.id, id))

    return successResponse({ success: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
