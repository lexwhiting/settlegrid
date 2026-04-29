/**
 * P4.MKT2 — Public x402 facilitator: POST /v1/settle.
 *
 * Verifies an x402 payment and submits the on-chain settlement
 * transaction via the SettleGrid gas wallet. Idempotent on the
 * payment payload's SHA-256 hash (24-hour Redis TTL inside
 * `settleExactPayment`) plus the optional `paymentIdentifier`
 * (x402 v2 extension).
 *
 * Per the x402 v2 facilitator spec, settle returns `{success,
 * txHash?, network?, errorReason?, errorCode?, gasEstimate?}`. Status
 * codes:
 *   - 200 — settlement succeeded; `txHash` populated
 *   - 402 — payment verification failed (signature invalid, expired,
 *           insufficient balance, nonce already used)
 *   - 400 — request malformed (bad scheme, unsupported network)
 *   - 422 — Zod validation failure (parseBody contract)
 *   - 429 — rate limited
 *   - 500 — settlement reached the on-chain submit step but failed
 *           (RPC error, gas wallet exhausted, transaction reverted)
 *
 * Only the `exact` scheme is currently settled on day one; `upto`
 * verification is supported but settlement returns 400. This matches
 * the internal /api/x402/settle route's behavior.
 *
 * @packageDocumentation
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  parseBody,
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { verifyExactPayment, settleExactPayment } from '@/lib/settlement/x402'
import type { X402ExactPayload } from '@/lib/settlement/x402'
import { logger } from '@/lib/logger'
import { PUBLIC_FACILITATOR_NETWORKS } from '../_shared'

export const maxDuration = 60
export { corsOptions as OPTIONS }

const settleSchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string().min(1),
    payload: z.record(z.unknown()),
  }),
  /**
   * x402 v2 payment-identifier extension: client-supplied
   * idempotency key. Accepted at the schema boundary for forward
   * compatibility but currently NOT plumbed through to
   * settleExactPayment — internal idempotency is the SHA-256 of
   * the payment payload (see apps/web/src/lib/settlement/x402/settle.ts).
   * Dropped from /v1/supported's `extensions` list per the P4.MKT2
   * Round 3 hostile review until paymentIdentifier-based dedup is
   * actually wired end-to-end.
   */
  paymentIdentifier: z.string().optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const rateLimit = await checkRateLimit(apiLimiter, `x402-facilitator-settle:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { paymentPayload, paymentIdentifier } = body

    if (
      !(PUBLIC_FACILITATOR_NETWORKS as readonly string[]).includes(paymentPayload.network)
    ) {
      return errorResponse(
        `Network not supported on the public facilitator: ${paymentPayload.network}. ` +
          `Supported: ${PUBLIC_FACILITATOR_NETWORKS.join(', ')}.`,
        400,
        'UNSUPPORTED_NETWORK',
      )
    }

    logger.info('x402.facilitator.settle_request', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
      hasPaymentIdentifier: !!paymentIdentifier,
    })

    if (paymentPayload.scheme === 'upto') {
      // Match the internal /api/x402/settle gating — upto settlement
      // is not yet shipped. Verify works for upto; settle does not.
      return errorResponse(
        'Upto scheme settlement is not yet supported. Only exact scheme is available.',
        400,
        'UNSUPPORTED_SCHEME',
      )
    }

    const exactPayload: X402ExactPayload = {
      x402Version: 2,
      scheme: 'exact',
      network: paymentPayload.network as X402ExactPayload['network'],
      payload: paymentPayload.payload as X402ExactPayload['payload'],
    }

    // Verify before submitting — surfaces invalid signatures + expired
    // windows before we burn gas on a doomed transaction.
    const verifyResult = await verifyExactPayment(exactPayload)
    if (!verifyResult.isValid) {
      return errorResponse(
        verifyResult.invalidReason ?? 'Payment verification failed',
        402,
        'PAYMENT_VERIFICATION_FAILED',
      )
    }

    // settleExactPayment is the canonical settlement entry point. It
    // owns the gas wallet, the Redis idempotency cache (24h TTL keyed
    // on payload SHA-256), and receipt generation.
    const settleResult = await settleExactPayment(exactPayload)

    if (!settleResult.success) {
      return errorResponse(
        settleResult.errorReason ?? 'Settlement failed',
        500,
        'SETTLEMENT_FAILED',
      )
    }

    logger.info('x402.facilitator.settle_success', {
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
