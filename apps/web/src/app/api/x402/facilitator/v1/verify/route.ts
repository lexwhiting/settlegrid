/**
 * P4.MKT2 — Public x402 facilitator: POST /v1/verify.
 *
 * Validates an x402 payment payload (exact or upto scheme) without
 * settling it. Mirrors the internal /api/x402/verify route but with
 * a separate rate-limit bucket so external traffic doesn't squeeze
 * SDK consumers and vice versa.
 *
 * Per the x402 v2 facilitator spec, verify is a read-only check:
 *   - signature decodes correctly
 *   - nonce isn't already-used
 *   - balance is sufficient at the time of the call
 *   - time window (`validBefore`) hasn't expired
 *
 * Returns `{isValid, invalidReason?, errorCode?, payer?, network?,
 * gasEstimate?}`. Status code is always 200 if the request was
 * structurally valid; the `isValid: false` envelope conveys the
 * verification result. 422 means the request itself was malformed.
 *
 * The settlement layer (`@/lib/settlement/x402`) is shared with the
 * internal route; this is intentional — same battle-tested viem
 * client, same public-blockchain reads.
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
import { verifyExactPayment, verifyUptoPayment } from '@/lib/settlement/x402'
import type { X402ExactPayload, X402UptoPayload } from '@/lib/settlement/x402'
import { logger } from '@/lib/logger'
import { PUBLIC_FACILITATOR_NETWORKS } from '../supported/route'

export const maxDuration = 30
export { corsOptions as OPTIONS }

/**
 * Body shape: x402 v2 spec literal. `paymentPayload.payload` is opaque
 * here — the verify functions inside `@/lib/settlement/x402` decode it
 * per scheme. We validate `network` is one of the public-facilitator
 * networks at the boundary so we fail fast with a useful error.
 */
const verifySchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string().min(1),
    payload: z.record(z.unknown()),
  }),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const rateLimit = await checkRateLimit(apiLimiter, `x402-facilitator-verify:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, verifySchema)
    const { paymentPayload } = body

    if (
      !(PUBLIC_FACILITATOR_NETWORKS as readonly string[]).includes(paymentPayload.network)
    ) {
      // Spec hostile gate (b): only Base + Base Sepolia day one. Reject
      // unsupported networks at the boundary rather than passing them
      // through and getting a downstream verify failure.
      return errorResponse(
        `Network not supported on the public facilitator: ${paymentPayload.network}. ` +
          `Supported: ${PUBLIC_FACILITATOR_NETWORKS.join(', ')}.`,
        400,
        'UNSUPPORTED_NETWORK',
      )
    }

    logger.info('x402.facilitator.verify_request', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
    })

    if (paymentPayload.scheme === 'exact') {
      const exactPayload: X402ExactPayload = {
        x402Version: 2,
        scheme: 'exact',
        network: paymentPayload.network as X402ExactPayload['network'],
        payload: paymentPayload.payload as X402ExactPayload['payload'],
      }
      const result = await verifyExactPayment(exactPayload)
      return successResponse(result)
    }

    if (paymentPayload.scheme === 'upto') {
      const uptoPayload: X402UptoPayload = {
        x402Version: 2,
        scheme: 'upto',
        network: paymentPayload.network as X402UptoPayload['network'],
        payload: paymentPayload.payload as X402UptoPayload['payload'],
      }
      const result = await verifyUptoPayment(uptoPayload)
      return successResponse(result)
    }

    return errorResponse(
      `Unsupported scheme: ${paymentPayload.scheme}`,
      400,
      'UNSUPPORTED_SCHEME',
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
})
