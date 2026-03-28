/**
 * Mastercard Agent Pay (Verifiable Intent) — Smart Proxy Integration (Stub)
 *
 * Handles Mastercard Agent Pay payment detection and 402 responses.
 * Mastercard Agent Pay uses SD-JWT selective disclosure with ES256 signatures
 * and a three-layer delegation chain: Credential Provider -> User -> Agent.
 *
 * NOTE: This is a stub integration with TODO markers for actual API calls.
 * Detection and 402 responses are fully functional; validation has
 * placeholder behavior until Mastercard sandbox credentials are obtained.
 *
 * @see https://developer.mastercard.com/agent-pay
 */

import { logger } from './logger'
import { getAppUrl } from './env'

// ─── Mastercard Constants ───────────────────────────────────────────────────

const MC_PROTOCOL_VERSION = '1.0'

/** Mastercard Agent Pay HTTP headers */
const MC_HEADERS = {
  /** SD-JWT credential chain (Verifiable Intent) */
  VERIFIABLE_INTENT: 'x-mc-verifiable-intent',
  /** Intent ID for tracking */
  INTENT_ID: 'x-mc-intent-id',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MastercardPaymentResult {
  valid: boolean
  /** Mastercard authorization reference */
  authorizationRef?: string
  /** Intent ID */
  intentId?: string
  /** Amount authorized in cents */
  amountCents?: number
  /** Error details when validation fails */
  error?: {
    code: MastercardErrorCode
    message: string
  }
}

export type MastercardErrorCode =
  | 'MC_NOT_CONFIGURED'
  | 'MC_INTENT_MISSING'
  | 'MC_INTENT_INVALID'
  | 'MC_INTENT_EXPIRED'
  | 'MC_AUTHORIZATION_DECLINED'
  | 'MC_API_ERROR'

export interface MastercardToolConfig {
  slug: string
  costCents: number
  displayName: string
  merchantId?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains Mastercard Agent Pay payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-mc-verifiable-intent header (SD-JWT credential chain)
 *   2. x-settlegrid-protocol: mastercard-vi header
 *   3. Authorization: Bearer mcvi_* prefix
 */
export function isMastercardRequest(request: Request): boolean {
  if (request.headers.get(MC_HEADERS.VERIFIABLE_INTENT)) return true
  if (request.headers.get(MC_HEADERS.PROTOCOL) === 'mastercard-vi') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('mcvi_')) return true
  }

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isMastercardEnabled(): boolean {
  return !!process.env.MASTERCARD_API_KEY
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming Mastercard Agent Pay payment.
 *
 * TODO: Implement actual SD-JWT verification and Mastercard authorization.
 * Currently returns a stub response indicating Mastercard VI is not yet fully integrated.
 */
export async function validateMastercardPayment(
  request: Request,
  toolConfig: MastercardToolConfig
): Promise<MastercardPaymentResult> {
  if (!isMastercardEnabled()) {
    return {
      valid: false,
      error: {
        code: 'MC_NOT_CONFIGURED',
        message: 'Mastercard Agent Pay is not configured on this SettleGrid instance.',
      },
    }
  }

  const intentHeader = request.headers.get(MC_HEADERS.VERIFIABLE_INTENT)
  if (!intentHeader) {
    return {
      valid: false,
      error: {
        code: 'MC_INTENT_MISSING',
        message: 'No Mastercard Verifiable Intent found in request. Provide x-mc-verifiable-intent header with an SD-JWT credential chain.',
      },
    }
  }

  const intentId = request.headers.get(MC_HEADERS.INTENT_ID) ?? undefined

  try {
    // TODO: Verify SD-JWT credential chain (3-layer delegation)
    // TODO: Submit authorization to Mastercard API
    logger.info('mastercard.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      intentId,
      note: 'Mastercard validation is stub; accepted based on structural validation.',
    })

    return {
      valid: true,
      intentId,
      amountCents: toolConfig.costCents,
    }
  } catch (err) {
    logger.error('mastercard.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'MC_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during Mastercard payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate a Mastercard Agent Pay 402 Payment Required response.
 */
export function generateMastercard402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  merchantId?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const effectiveMerchantId = merchantId ?? 'settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'mastercard-vi',
    version: MC_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    merchant_id: effectiveMerchantId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_credentials: ['sd-jwt-verifiable-intent'],
    credential_requirements: {
      delegation_chain: ['credential-provider', 'user', 'agent'],
      signature_algorithm: 'ES256',
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain a Mastercard Verifiable Intent SD-JWT credential chain, then re-send the request with x-mc-verifiable-intent header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'mastercard-vi',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
