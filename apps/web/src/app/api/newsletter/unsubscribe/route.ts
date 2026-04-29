import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const maxDuration = 15

const unsubscribeSchema = z.object({
  email: z.string().email().max(320),
})

/**
 * POST /api/newsletter/unsubscribe — unsubscribe from the SettleGrid ecosystem newsletter.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `newsletter-unsubscribe:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let parsed: z.infer<typeof unsubscribeSchema>
    try {
      parsed = await parseBody(request, unsubscribeSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
    }

    const { email } = parsed

    const [existing] = await db
      .select({ id: consumers.id })
      .from(consumers)
      .where(eq(consumers.email, email))
      .limit(1)

    if (!existing) {
      // Don't reveal whether the email exists
      return successResponse({ message: 'Unsubscribed.', subscribed: false })
    }

    await db
      .update(consumers)
      .set({ newsletterSubscribed: false })
      .where(eq(consumers.id, existing.id))

    logger.info('newsletter.unsubscribed', { email })
    return successResponse({ message: 'Unsubscribed.', subscribed: false })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
