import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * GET /api/consumer/referral — returns consumer's referral code and stats.
 * Auto-generates a referral code on first access.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-referral:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Get current consumer record
    const [consumer] = await db
      .select({
        id: consumers.id,
        referralCode: consumers.referralCode,
      })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    if (!consumer) {
      return errorResponse('Consumer not found.', 404, 'NOT_FOUND')
    }

    let referralCode = consumer.referralCode

    // Auto-generate referral code if not present
    if (!referralCode) {
      referralCode = `ref_${randomBytes(6).toString('hex')}`

      await db
        .update(consumers)
        .set({ referralCode })
        .where(eq(consumers.id, auth.id))
    }

    // Count referrals made by this consumer
    const [referralStats] = await db
      .select({
        referralsMade: sql<number>`count(*)::int`,
      })
      .from(consumers)
      .where(eq(consumers.referredByConsumerId, auth.id))

    const referralsMade = referralStats?.referralsMade ?? 0
    // $25 credit (2500 cents) per referral
    const REFERRAL_CREDIT_CENTS = 2500
    const creditsEarnedCents = referralsMade * REFERRAL_CREDIT_CENTS

    return successResponse({
      referralCode,
      referralsMade,
      creditsEarnedCents,
      shareUrl: `https://settlegrid.ai/register?ref=${referralCode}`,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
