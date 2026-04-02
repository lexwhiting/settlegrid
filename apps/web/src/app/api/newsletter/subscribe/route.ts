import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const maxDuration = 15

const subscribeSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
})

/**
 * POST /api/newsletter/subscribe — subscribe to the SettleGrid ecosystem newsletter.
 * Creates a consumer record if one doesn't exist, or updates newsletterSubscribed to true.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `newsletter-subscribe:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let parsed: z.infer<typeof subscribeSchema>
    try {
      parsed = await parseBody(request, subscribeSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
    }

    const { email } = parsed

    // Check if consumer already exists
    const [existing] = await db
      .select({ id: consumers.id, newsletterSubscribed: consumers.newsletterSubscribed })
      .from(consumers)
      .where(eq(consumers.email, email))
      .limit(1)

    if (existing) {
      if (existing.newsletterSubscribed) {
        return successResponse({ message: 'Already subscribed.', subscribed: true })
      }

      await db
        .update(consumers)
        .set({ newsletterSubscribed: true })
        .where(eq(consumers.id, existing.id))

      logger.info('newsletter.resubscribed', { email })
      return successResponse({ message: 'Successfully resubscribed.', subscribed: true })
    }

    // Create a minimal consumer record for newsletter-only subscribers
    await db.insert(consumers).values({
      email,
      newsletterSubscribed: true,
    })

    logger.info('newsletter.subscribed', { email })
    return successResponse({ message: 'Successfully subscribed.', subscribed: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
