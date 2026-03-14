import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews, invocations } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

/** GET /api/tools/[slug]/reviews — public: list reviews for a tool */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-reviews:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params

    // Look up the tool by slug
    const [tool] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Fetch reviews
    const reviews = await db
      .select({
        id: toolReviews.id,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .where(eq(toolReviews.toolId, tool.id))
      .orderBy(desc(toolReviews.createdAt))
      .limit(50)

    // Compute average rating
    const [stats] = await db
      .select({
        averageRating: sql<number>`coalesce(avg(${toolReviews.rating})::numeric(2,1), 0)`,
        totalReviews: sql<number>`count(*)::int`,
      })
      .from(toolReviews)
      .where(eq(toolReviews.toolId, tool.id))

    return successResponse({
      reviews,
      averageRating: Number(stats.averageRating),
      totalReviews: stats.totalReviews,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** POST /api/tools/[slug]/reviews — consumer: create a review */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-reviews:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { slug } = await params
    const body = await parseBody(request, createReviewSchema)

    // Look up the tool by slug
    const [tool] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Anti-spam: consumer must have at least 1 invocation on the tool
    const [invocation] = await db
      .select({ id: invocations.id })
      .from(invocations)
      .where(and(eq(invocations.toolId, tool.id), eq(invocations.consumerId, auth.id)))
      .limit(1)

    if (!invocation) {
      return errorResponse(
        'You must have used this tool at least once before leaving a review.',
        403,
        'NO_INVOCATIONS'
      )
    }

    // One review per consumer per tool
    const [existing] = await db
      .select({ id: toolReviews.id })
      .from(toolReviews)
      .where(and(eq(toolReviews.toolId, tool.id), eq(toolReviews.consumerId, auth.id)))
      .limit(1)

    if (existing) {
      return errorResponse('You have already reviewed this tool.', 409, 'REVIEW_EXISTS')
    }

    const [review] = await db
      .insert(toolReviews)
      .values({
        toolId: tool.id,
        consumerId: auth.id,
        rating: body.rating,
        comment: body.comment ?? null,
      })
      .returning({
        id: toolReviews.id,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })

    return successResponse({ review }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
