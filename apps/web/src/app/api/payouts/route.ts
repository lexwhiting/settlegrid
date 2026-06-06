import { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payouts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `payouts-list:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `payouts-list:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const payoutRecords = await db
      .select({
        id: payouts.id,
        amountCents: payouts.amountCents,
        platformFeeCents: payouts.platformFeeCents,
        stripeTransferId: payouts.stripeTransferId,
        periodStart: payouts.periodStart,
        periodEnd: payouts.periodEnd,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .where(eq(payouts.developerId, auth.id))
      .orderBy(desc(payouts.createdAt))
      .limit(50)

    return successResponse({ payouts: payoutRecords })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
