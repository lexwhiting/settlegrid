/**
 * Circle Nanopayments — Smart Proxy Integration (Stub)
 *
 * Handles Circle Nanopayment detection and 402 responses for SettleGrid tools.
 * Circle Nanopayments enable gas-free USDC micropayments as small as $0.000001
 * with off-chain immediate confirmation and periodic on-chain batch settlement.
 * x402-compatible.
 *
 * NOTE: This is a stub integration with TODO markers for actual API calls.
 * Detection and 402 responses are fully functional; validation has
 * placeholder behavior until Circle Nanopayments API access is obtained.
 *
 * @see https://developers.circle.com/w3s/nanopayments
 */

import { logger } from './logger'
import { getAppUrl } from './env'

// ─── Circle Nano Constants ──────────────────────────────────────────────────

const CIRCLE_NANO_PROTOCOL_VERSION = '1.0'

/** Circle Nanopayments HTTP headers */
const CIRCLE_NANO_HEADERS = {
  /** EIP-3009 authorization for nanopayment */
  AUTH: 'x-circle-nano-auth',
  /** Circle wallet address */
  WALLET: 'x-circle-nano-wallet',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CircleNanoPaymentResult {
  valid: boolean
  /** Off-chain confirmation ID (batch settlement is periodic) */
  confirmationId?: string
  /** Payer wallet address */
  payerAddress?: string
  /** Amount in USDC base units */
  amountUsdc?: string
  /** Error details when validation fails */
  error?: {
    code: CircleNanoErrorCode
    message: string
  }
}

export type CircleNanoErrorCode =
  | 'CIRCLE_NANO_NOT_CONFIGURED'
  | 'CIRCLE_NANO_AUTH_MISSING'
  | 'CIRCLE_NANO_AUTH_INVALID'
  | 'CIRCLE_NANO_INSUFFICIENT_FUNDS'
  | 'CIRCLE_NANO_API_ERROR'

export interface CircleNanoToolConfig {
  slug: string
  costCents: number
  displayName: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains Circle Nanopayment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-circle-nano-auth header (EIP-3009 authorization)
 *   2. x-settlegrid-protocol: circle-nano header
 *   3. Authorization: Bearer cnano_* prefix
 */
export function isCircleNanoRequest(request: Request): boolean {
  if (request.headers.get(CIRCLE_NANO_HEADERS.AUTH)) return true
  if (request.headers.get(CIRCLE_NANO_HEADERS.PROTOCOL) === 'circle-nano') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('cnano_')) return true
  }

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isCircleNanoEnabled(): boolean {
  return !!process.env.CIRCLE_NANO_API_KEY
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming Circle Nanopayment.
 *
 * TODO: Implement actual EIP-3009 authorization verification and
 * Circle Nanopayments API integration for off-chain confirmation.
 * Currently returns a stub response.
 */
export async function validateCircleNanoPayment(
  request: Request,
  toolConfig: CircleNanoToolConfig
): Promise<CircleNanoPaymentResult> {
  if (!isCircleNanoEnabled()) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NOT_CONFIGURED',
        message: 'Circle Nanopayments are not configured on this SettleGrid instance.',
      },
    }
  }

  const authHeader = request.headers.get(CIRCLE_NANO_HEADERS.AUTH)
  if (!authHeader) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_MISSING',
        message: 'No Circle Nanopayment authorization found in request. Provide x-circle-nano-auth header with an EIP-3009 authorization.',
      },
    }
  }

  const walletAddress = request.headers.get(CIRCLE_NANO_HEADERS.WALLET) ?? undefined

  try {
    // TODO: Verify EIP-3009 authorization payload
    // TODO: Submit to Circle Nanopayments API for off-chain confirmation
    const confirmationId = crypto.randomUUID()

    logger.info('circle_nano.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      walletAddress,
      confirmationId,
      note: 'Circle Nano validation is stub; accepted based on structural validation.',
    })

    return {
      valid: true,
      confirmationId,
      payerAddress: walletAddress,
    }
  } catch (err) {
    logger.error('circle_nano.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during Circle Nanopayment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate a Circle Nanopayments 402 Payment Required response.
 */
export function generateCircleNano402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  // Convert cents to USDC base units (6 decimals)
  const amountBaseUnits = String(costCents * 10_000)

  const body = {
    error: 'payment_required',
    protocol: 'circle-nano',
    version: CIRCLE_NANO_PROTOCOL_VERSION,
    amount_cents: costCents,
    amount_usdc_base_units: amountBaseUnits,
    currency: 'usdc',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['eip3009-nanopayment'],
    // Circle Nano-specific info
    settlement: {
      type: 'off-chain-immediate',
      batch_settlement: 'periodic-on-chain',
      network: 'eip155:8453', // Base mainnet
      asset: 'USDC',
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, create an EIP-3009 transferWithAuthorization for at least ${amountBaseUnits} USDC base units, then re-send the request with x-circle-nano-auth header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'circle-nano',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
