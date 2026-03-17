import { NextRequest } from 'next/server'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'
import type { X402SupportedInfo } from '@/lib/settlement/x402/types'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

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
      networks: Object.entries(USDC_ADDRESSES).map(([network, address]) => ({
        network,
        asset: address,
        assetSymbol: 'USDC',
        assetDecimals: 6,
      })),
      extensions: ['offer-and-receipt'],
    }

    return successResponse(info)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
