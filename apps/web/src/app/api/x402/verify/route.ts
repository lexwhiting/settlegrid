import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { verifyExactPayment, verifyUptoPayment } from '@/lib/settlement/x402'
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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

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
