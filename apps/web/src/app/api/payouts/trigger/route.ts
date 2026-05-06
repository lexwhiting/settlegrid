/**
 * POST /api/payouts/trigger — request a payout for the authenticated
 * developer. Thin wrapper over `processPayout` (lib/payouts/process.ts);
 * the route handles auth + rate-limit, the helper does the work.
 */

import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { processPayout } from '@/lib/payouts/process'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `payout-trigger:${ip}`)
    if (!rateLimit.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const result = await processPayout({
      developerId: auth.id,
      trigger: 'manual',
      ipAddress: ip,
    })

    if (!result.ok) {
      return errorResponse(result.errorMessage, result.httpStatus, result.errorCode)
    }

    return successResponse({
      payout: {
        id: result.payoutId,
        amountCents: result.amountCents,
        platformFeeCents: result.platformFeeCents,
        stripeTransferId: result.stripeTransferId,
        status: 'completed',
        createdAt: result.createdAt,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
