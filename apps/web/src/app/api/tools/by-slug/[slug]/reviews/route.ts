import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews, invocations, developers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { newReviewNotificationEmail, sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/env'
import { logger } from '@/lib/logger'
import { filterReviewContent } from '@/lib/content-filter'

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

    // Fetch reviews (only visible)
    const reviews = await db
      .select({
        id: toolReviews.id,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .where(and(eq(toolReviews.toolId, tool.id), eq(toolReviews.status, 'visible')))
      .orderBy(desc(toolReviews.createdAt))
      .limit(50)

    // Compute average rating (only visible reviews)
    const [stats] = await db
      .select({
        averageRating: sql<number>`coalesce(avg(${toolReviews.rating})::numeric(2,1), 0)`,
        totalReviews: sql<number>`count(*)::int`,
      })
      .from(toolReviews)
      .where(and(eq(toolReviews.toolId, tool.id), eq(toolReviews.status, 'visible')))

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
    try { auth = await requireConsumer(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { slug } = await params
    const body = await parseBody(request, createReviewSchema)

    // Look up the tool by slug (include name + developerId for notification)
    const [tool] = await db
      .select({ id: tools.id, name: tools.name, developerId: tools.developerId })
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

    // Content moderation: filter comment if provided
    if (body.comment) {
      const filterResult = filterReviewContent(body.comment)
      if (!filterResult.passed) {
        logger.warn('review.content_policy_violation', {
          toolId: tool.id,
          consumerId: auth.id,
          reasons: filterResult.reasons,
        })
        return errorResponse(
          'Your review could not be submitted because it violates our content policy.',
          400,
          'CONTENT_POLICY_VIOLATION',
          undefined,
          { reasons: filterResult.reasons },
        )
      }
    }

    const [review] = await db
      .insert(toolReviews)
      .values({
        toolId: tool.id,
        consumerId: auth.id,
        rating: body.rating,
        comment: body.comment ?? null,
        status: 'visible',
      })
      .returning({
        id: toolReviews.id,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })

    // Fire-and-forget: notify the developer about the new review + check low rating threshold
    ;(async () => {
      try {
        const [dev] = await db
          .select({ email: developers.email, name: developers.name })
          .from(developers)
          .where(eq(developers.id, tool.developerId))
          .limit(1)
        if (dev) {
          const appUrl = getAppUrl()
          const email = newReviewNotificationEmail(
            dev.name ?? 'Developer',
            tool.name,
            body.rating,
            body.comment ?? null,
            `${appUrl}/dashboard/reviews`,
          )
          await sendEmail({ to: dev.email, subject: email.subject, html: email.html })
        }

        // Auto-flag: notify admin if average rating drops below 2.0 with 3+ reviews
        const LOW_RATING_THRESHOLD = 2.0
        const MIN_REVIEWS_FOR_FLAG = 3
        const [ratingStats] = await db
          .select({
            avg: sql<number>`coalesce(avg(${toolReviews.rating})::numeric(2,1), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(toolReviews)
          .where(eq(toolReviews.toolId, tool.id))

        if (
          ratingStats &&
          Number(ratingStats.count) >= MIN_REVIEWS_FOR_FLAG &&
          Number(ratingStats.avg) < LOW_RATING_THRESHOLD
        ) {
          const avgStr = Number(ratingStats.avg).toFixed(1)
          const adminEmails = ['lexwhiting365@gmail.com']
          for (const adminEmail of adminEmails) {
            await sendEmail({
              to: adminEmail,
              subject: `[SettleGrid] Low Rating Alert: ${tool.name} (${avgStr}/5.0)`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1A1F3A;">Low Rating Alert</h2>
                  <p>Tool <strong>${escapeHtml(tool.name)}</strong> has dropped below ${LOW_RATING_THRESHOLD.toFixed(1)} average rating.</p>
                  <ul>
                    <li><strong>Average rating:</strong> ${avgStr} / 5.0</li>
                    <li><strong>Total reviews:</strong> ${ratingStats.count}</li>
                  </ul>
                  <p>Consider reviewing this tool for quality issues.</p>
                  <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
                    This is an automated notification from SettleGrid quality gates.
                  </p>
                </div>
              `,
            })
          }
          logger.warn('review.low_rating_flagged', {
            toolId: tool.id,
            toolName: tool.name,
            avg: avgStr,
            count: ratingStats.count,
          })
        }
      } catch (err) {
        logger.error('review.notification_failed', {}, err)
      }
    })()

    return successResponse({ review }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** Escapes HTML entities to prevent XSS in emails. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
