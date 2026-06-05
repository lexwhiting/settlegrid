import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const maxDuration = 15

const subscribeSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  frequency: z.enum(['weekly', 'monthly']).optional(),
})

/**
 * POST /api/newsletter/subscribe — subscribe to the SettleGrid ecosystem newsletter.
 * Creates a consumer record if one doesn't exist, or updates newsletterSubscribed to true.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
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

    const { email, frequency = 'weekly' } = parsed

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
        .set({ newsletterSubscribed: true, newsletterFrequency: frequency })
        .where(eq(consumers.id, existing.id))

      logger.info('newsletter.resubscribed', { email, frequency })
      return successResponse({ message: 'Successfully resubscribed.', subscribed: true, frequency })
    }

    // Consumer-audit #10 — mint a referralCode at newsletter-subscribe
    // time. Previously newsletter-only consumers had a NULL referralCode,
    // which later broke referral sign-ups: the `consumers.referralCode`
    // unique index would conflict when the real signup tried to mint one.
    // Matching the format used by /api/consumer/referral and the developer
    // referrals route (`ref_` + 12 hex chars).
    const referralCode = `ref_${randomBytes(6).toString('hex')}`

    // Create a minimal consumer record for newsletter-only subscribers.
    await db.insert(consumers).values({
      email,
      newsletterSubscribed: true,
      newsletterFrequency: frequency,
      referralCode,
    })

    logger.info('newsletter.subscribed', { email })
    return successResponse({ message: 'Successfully subscribed.', subscribed: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
