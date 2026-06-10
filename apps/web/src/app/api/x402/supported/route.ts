import { NextRequest } from 'next/server'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'
import { isCanonicalX402Network } from '@/lib/settlement/x402/networks'
import type { X402SupportedInfo } from '@/lib/settlement/x402/types'

export const maxDuration = 30
export { corsOptions as OPTIONS }

export const GET = withCors(async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)

    const rateLimit = await checkRateLimit(apiLimiter, `x402-supported:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const info: X402SupportedInfo = {
      facilitator: 'SettleGrid',
      version: '1.0.0',
      schemes: [
        {
          scheme: 'exact',
          description: 'EIP-3009 transferWithAuthorization — exact amount, facilitator-submitted',
          status: 'active',
        },
        {
          scheme: 'upto',
          description: 'Permit2 permitWitnessTransferFrom — up-to amount, facilitator-witnessed',
          status: 'beta',
        },
      ],
      // (G) Advertise ONLY the canonical settleable+confirmable networks — the
      // USDC_ADDRESSES table also carries eip155:1 for the verify engine's
      // internals, which no settle path here supports.
      networks: Object.entries(USDC_ADDRESSES)
        .filter(([network]) => isCanonicalX402Network(network))
        .map(([network, address]) => ({
          network,
          asset: address,
          assetSymbol: 'USDC',
          assetDecimals: 6,
        })),
      extensions: ['offer-and-receipt', 'payment-identifier'],
    }

    return successResponse(info)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
