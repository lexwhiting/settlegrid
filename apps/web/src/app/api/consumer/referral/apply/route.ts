import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const maxDuration = 60

/** $25 credit per referral, for both referrer and referee */
const REFERRAL_CREDIT_CENTS = 2500

const applyReferralSchema = z.object({
  referralCode: z.string().min(1).max(50),
})

/**
 * POST /api/consumer/referral/apply — apply a referral code.
 * Credits $25 to both referrer and referee (global balance).
 * Idempotent: one referral per consumer.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-referral-apply:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Parse and validate body
    let parsed: z.infer<typeof applyReferralSchema>
    try {
      parsed = await parseBody(request, applyReferralSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
    }

    const { referralCode } = parsed

    // Check that the consumer hasn't already been referred
    const [currentConsumer] = await db
      .select({
        id: consumers.id,
        referredByConsumerId: consumers.referredByConsumerId,
      })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    if (!currentConsumer) {
      return errorResponse('Consumer not found.', 404, 'NOT_FOUND')
    }

    if (currentConsumer.referredByConsumerId) {
      return successResponse({
        message: 'Referral already applied.',
        alreadyReferred: true,
      })
    }

    // Look up the referrer by code
    const [referrer] = await db
      .select({
        id: consumers.id,
        referralCode: consumers.referralCode,
      })
      .from(consumers)
      .where(eq(consumers.referralCode, referralCode))
      .limit(1)

    if (!referrer) {
      return errorResponse('Invalid referral code.', 400, 'INVALID_REFERRAL_CODE')
    }

    // Prevent self-referral
    if (referrer.id === auth.id) {
      return errorResponse('Cannot use your own referral code.', 400, 'SELF_REFERRAL')
    }

    // Apply the referral: update referee with referrer ID and credit both
    await db
      .update(consumers)
      .set({
        referredByConsumerId: referrer.id,
        globalBalanceCents: sql`${consumers.globalBalanceCents} + ${REFERRAL_CREDIT_CENTS}`,
      })
      .where(eq(consumers.id, auth.id))

    // Credit the referrer
    await db
      .update(consumers)
      .set({
        globalBalanceCents: sql`${consumers.globalBalanceCents} + ${REFERRAL_CREDIT_CENTS}`,
      })
      .where(eq(consumers.id, referrer.id))

    logger.info('consumer.referral.applied', {
      refereeId: auth.id,
      referrerId: referrer.id,
      creditCents: REFERRAL_CREDIT_CENTS,
    })

    return successResponse({
      message: `Referral applied! Both you and the referrer received $${(REFERRAL_CREDIT_CENTS / 100).toFixed(2)} in credits.`,
      creditedCents: REFERRAL_CREDIT_CENTS,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
