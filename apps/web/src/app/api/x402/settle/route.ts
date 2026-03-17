import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { verifyExactPayment, settleExactPayment } from '@/lib/settlement/x402'
import type { X402ExactPayload } from '@/lib/settlement/x402'
import { logger } from '@/lib/logger'

export const maxDuration = 60
export { corsOptions as OPTIONS }

const settleSchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string().min(1),
    payload: z.record(z.unknown()),
  }),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const rateLimit = await checkRateLimit(apiLimiter, `x402-settle:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { paymentPayload } = body

    logger.info('x402.settle_request', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
    })

    // Only exact scheme settlement is supported for now
    if (paymentPayload.scheme === 'upto') {
      return errorResponse(
        'Upto scheme settlement is not yet supported. Only exact scheme is available.',
        400,
        'UNSUPPORTED_SCHEME'
      )
    }

    const exactPayload: X402ExactPayload = {
      x402Version: 2,
      scheme: 'exact',
      network: paymentPayload.network as X402ExactPayload['network'],
      payload: paymentPayload.payload as X402ExactPayload['payload'],
    }

    // Verify first
    const verifyResult = await verifyExactPayment(exactPayload)
    if (!verifyResult.isValid) {
      return errorResponse(
        verifyResult.invalidReason ?? 'Payment verification failed',
        402,
        'PAYMENT_VERIFICATION_FAILED'
      )
    }

    // Then settle
    const settleResult = await settleExactPayment(exactPayload)

    if (!settleResult.success) {
      return errorResponse(
        settleResult.errorReason ?? 'Settlement failed',
        500,
        'SETTLEMENT_FAILED'
      )
    }

    logger.info('x402.settle_success', {
      txHash: settleResult.txHash,
      network: settleResult.network,
    })

    return successResponse({
      success: true,
      txHash: settleResult.txHash,
      network: settleResult.network,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
