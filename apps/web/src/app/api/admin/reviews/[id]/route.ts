import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toolReviews } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

const moderationSchema = z.object({
  action: z.enum(['hide', 'restore', 'remove']),
  reason: z.string().max(500).optional(),
})

/**
 * PATCH /api/admin/reviews/:id — Admin moderation action
 *
 * Body: { action: 'hide' | 'restore' | 'remove', reason?: string }
 *
 * - hide:    sets status='hidden', hideReason, hiddenAt
 * - restore: sets status='visible', clears hide fields
 * - remove:  sets status='removed', hideReason, hiddenAt
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `admin-review-mod:${ip}`)
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

    const { id } = await params
    const body = await parseBody(request, moderationSchema)

    // Verify the review exists
    const [review] = await db
      .select({ id: toolReviews.id, status: toolReviews.status })
      .from(toolReviews)
      .where(eq(toolReviews.id, id))
      .limit(1)

    if (!review) {
      return errorResponse('Review not found.', 404, 'NOT_FOUND')
    }

    const now = new Date()

    switch (body.action) {
      case 'hide': {
        await db
          .update(toolReviews)
          .set({
            status: 'hidden',
            hideReason: body.reason ?? 'admin',
            hiddenAt: now,
            updatedAt: now,
          })
          .where(eq(toolReviews.id, id))
        break
      }
      case 'restore': {
        await db
          .update(toolReviews)
          .set({
            status: 'visible',
            hideReason: null,
            hiddenAt: null,
            reportedAt: null,
            updatedAt: now,
          })
          .where(eq(toolReviews.id, id))
        break
      }
      case 'remove': {
        await db
          .update(toolReviews)
          .set({
            status: 'removed',
            hideReason: body.reason ?? 'admin',
            hiddenAt: now,
            updatedAt: now,
          })
          .where(eq(toolReviews.id, id))
        break
      }
    }

    // Write audit log
    await writeAuditLog({
      developerId: auth.id,
      action: `review.${body.action}`,
      resourceType: 'review',
      resourceId: id,
      details: {
        action: body.action,
        reason: body.reason ?? null,
        previousStatus: review.status,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    logger.info('admin.review_moderated', {
      email: auth.email,
      reviewId: id,
      action: body.action,
      reason: body.reason,
    })

    return successResponse({ success: true, action: body.action, reviewId: id })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
