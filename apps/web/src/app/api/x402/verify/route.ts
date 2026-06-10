import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import {
  verifyExactPayment,
  verifyUptoPayment,
  CANONICAL_X402_NETWORKS,
  isCanonicalX402Network,
} from '@/lib/settlement/x402'
import type { X402ExactPayload, X402UptoPayload } from '@/lib/settlement/x402'
import { logger } from '@/lib/logger'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const verifySchema = z.object({
  paymentPayload: z.object({
    scheme: z.enum(['exact', 'upto']),
    network: z.string().min(1),
    payload: z.record(z.unknown()),
  }),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)

    const rateLimit = await checkRateLimit(apiLimiter, `x402-verify:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, verifySchema)
    const { paymentPayload } = body

    logger.info('x402.verify_request', {
      scheme: paymentPayload.scheme,
      network: paymentPayload.network,
    })

    // (G) Same canonical-network guard as the settle route: never report a
    // payment as verifiable on a network no settle path here can broadcast and
    // the reconciler can never confirm (the verify engine itself supports
    // eip155:1 RPC reads, so without this guard a funded Ethereum payload
    // returns isValid:true for a payment that can never settle).
    if (!isCanonicalX402Network(paymentPayload.network)) {
      return errorResponse(
        `Network not supported: ${paymentPayload.network}. ` +
          `Supported: ${CANONICAL_X402_NETWORKS.join(', ')}.`,
        400,
        'UNSUPPORTED_NETWORK'
      )
    }

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

    return errorResponse(`Unsupported scheme: ${paymentPayload.scheme}`, 400, 'UNSUPPORTED_SCHEME')
  } catch (error) {
    return internalErrorResponse(error)
  }
})
