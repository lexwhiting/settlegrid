/**
 * P4.MKT2 — Public x402 facilitator: GET /v1/supported.
 *
 * Returns the SettleGrid facilitator's capabilities envelope per the
 * x402 v2 facilitator spec. Public surface, rate-limited per IP, no
 * auth required (the x402 spec does not mandate facilitator auth).
 *
 * ## Why this is separate from /api/x402/supported
 *
 * The internal route at `/api/x402/supported` is the broader server
 * surface used by SDK consumers; it returns every network the kernel
 * has settlement primitives for, including unverified Ethereum
 * mainnet. The PUBLIC facilitator surface is more conservative on
 * day one — only Base mainnet + Base Sepolia are explicitly supported
 * for external traffic. ETH mainnet returns from the internal route
 * but is intentionally filtered here. This narrower set is the
 * "honest day-one claim" the P4.MKT2 spec hostile-review gate
 * requires (gate b).
 *
 * Founder action required before this route serves real traffic:
 *   - DNS for `facilitator.settlegrid.ai` must be provisioned and
 *     pointed at the apps/web Vercel deployment with a rewrite from
 *     `facilitator.settlegrid.ai/v1/*` → `/api/x402/facilitator/v1/*`.
 *   - Smoke-test from outside the SettleGrid network (curl from
 *     a personal laptop, not from the dev box).
 *
 * @packageDocumentation
 */
import { NextRequest } from 'next/server'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'
import type { X402SupportedInfo } from '@/lib/settlement/x402/types'
import {
  PUBLIC_FACILITATOR_NETWORKS,
  FACILITATOR_NAME,
  FACILITATOR_VERSION,
} from '../_shared'

export const maxDuration = 30
export { corsOptions as OPTIONS }

export const GET = withCors(async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)

    const rateLimit = await checkRateLimit(apiLimiter, `x402-facilitator-supported:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const networks = (PUBLIC_FACILITATOR_NETWORKS as readonly string[])
      .filter((id) => id in USDC_ADDRESSES)
      .map((id) => ({
        network: id,
        asset: USDC_ADDRESSES[id],
        assetSymbol: 'USDC' as const,
        assetDecimals: 6,
      }))

    const info: X402SupportedInfo = {
      facilitator: FACILITATOR_NAME,
      version: FACILITATOR_VERSION,
      schemes: [
        {
          scheme: 'exact',
          description:
            'EIP-3009 transferWithAuthorization — exact amount, facilitator-submitted',
          status: 'active',
        },
        {
          scheme: 'upto',
          // Asymmetric ship state: verify works (Permit2 signature
          // checks fire), but settle is currently rejected with 400
          // UNSUPPORTED_SCHEME because the gas-wallet-side Permit2
          // submission isn't tested. Description is explicit so a
          // buyer reading /v1/supported isn't misled by the 'beta'
          // status into trying a settle path that 400s.
          description:
            'Permit2 permitWitnessTransferFrom — verify endpoint live; settle returns 400 UNSUPPORTED_SCHEME until Permit2 wallet path ships',
          status: 'beta',
        },
      ],
      networks,
      // 'payment-identifier' was previously claimed here as an extension,
      // but the field is accepted by /v1/settle and not actually plumbed
      // through to settleExactPayment — internal idempotency is on the
      // SHA-256 of the payload, not on the client-supplied identifier.
      // Dropping the claim until paymentIdentifier is honored end-to-end.
      extensions: ['offer-and-receipt'],
    }

    return successResponse(info)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
