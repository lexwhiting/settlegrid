import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import {
  verifyExactPayment,
  settleExactPayment,
  CANONICAL_X402_NETWORKS,
  isCanonicalX402Network,
} from '@/lib/settlement/x402'
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
  /** x402 v2 payment-identifier extension: client-supplied idempotency key */
  paymentIdentifier: z.string().optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)

    const rateLimit = await checkRateLimit(apiLimiter, `x402-settle:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { paymentPayload, paymentIdentifier } = body

    logger.info('x402.settle_request', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
      hasPaymentIdentifier: !!paymentIdentifier,
    })

    // (G) Settle-boundary guard: only canonical settleable+confirmable networks
    // may reach the engines — a non-canonical settle could otherwise broadcast
    // money the reconciler can never confirm. Reject BEFORE verify/settle so no
    // RPC is spent on a doomed network. Network-then-scheme, matching the
    // facilitator v1 settle route.
    if (!isCanonicalX402Network(paymentPayload.network)) {
      return errorResponse(
        `Network not supported for settlement: ${paymentPayload.network}. ` +
          `Supported: ${CANONICAL_X402_NETWORKS.join(', ')}.`,
        400,
        'UNSUPPORTED_NETWORK'
      )
    }

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

    // Then settle (idempotency is handled inside settleExactPayment)
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
      gasEstimate: settleResult.gasEstimate ?? null,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
