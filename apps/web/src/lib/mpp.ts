/**
 * MPP (Machine Payments Protocol) — Deep Stripe Integration
 *
 * Handles MPP payment flows for SettleGrid tools:
 *   1. Detects MPP headers on incoming requests
 *   2. Validates Shared Payment Tokens (SPTs) with Stripe
 *   3. Captures payments and records invocations
 *   4. Returns proper MPP 402 responses when payment is required
 *
 * MPP launched March 18, 2026. It enables machine-to-machine payments
 * via HTTP using Stripe-backed Shared Payment Tokens (SPTs).
 *
 * @see https://docs.stripe.com/payments/machine/mpp
 */

import { logger } from './logger'
import { getStripeMppSecret, isMppEnabled, getAppUrl } from './env'

// ─── MPP Constants ──────────────────────────────────────────────────────────

const MPP_PROTOCOL_VERSION = '1.0'
const MPP_TOKEN_PREFIX = 'spt_'
const MPP_CREDENTIAL_PREFIX = 'mpp_'

/** MPP-specific HTTP headers */
const MPP_HEADERS = {
  PROTOCOL: 'X-Payment-Protocol',
  TOKEN: 'X-Payment-Token',
  AMOUNT: 'X-Payment-Amount',
  CURRENCY: 'X-Payment-Currency',
  DESCRIPTION: 'X-Payment-Description',
  RECIPIENT: 'X-Payment-Recipient',
  MAX_AMOUNT: 'X-Payment-Max-Amount',
  SESSION_ID: 'X-MPP-Session-Id',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MppPaymentResult {
  valid: boolean
  /** Stripe Payment Intent or Charge ID for the captured payment */
  paymentId?: string
  /** Amount captured in cents */
  amountCents?: number
  /** Currency code (lowercase, e.g. 'usd') */
  currency?: string
  /** Stripe customer ID of the payer (the model provider / agent host) */
  payerCustomerId?: string
  /** MPP session ID if present */
  sessionId?: string
  /** Error details when validation fails */
  error?: {
    code: MppErrorCode
    message: string
  }
}

export type MppErrorCode =
  | 'MPP_NOT_CONFIGURED'
  | 'MPP_TOKEN_MISSING'
  | 'MPP_TOKEN_INVALID'
  | 'MPP_TOKEN_EXPIRED'
  | 'MPP_AMOUNT_MISMATCH'
  | 'MPP_INSUFFICIENT_AUTHORIZATION'
  | 'MPP_CAPTURE_FAILED'
  | 'MPP_STRIPE_ERROR'

export interface MppToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name for payment descriptions */
  displayName: string
  /** Stripe Connect account ID for receiving payments (platform-level or per-tool) */
  recipientId?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains MPP payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. X-Payment-Protocol header set to MPP/1.0
 *   2. X-Payment-Token header with spt_ or mpp_ prefix
 *   3. Authorization: Bearer spt_* or Bearer mpp_*
 *   4. x-mpp-credential header (existing adapter compatibility)
 */
export function isMppRequest(request: Request): boolean {
  const protocol = request.headers.get(MPP_HEADERS.PROTOCOL)
  if (protocol?.startsWith('MPP')) return true

  const token = request.headers.get(MPP_HEADERS.TOKEN)
  if (token && (token.startsWith(MPP_TOKEN_PREFIX) || token.startsWith(MPP_CREDENTIAL_PREFIX))) return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) return true
  }

  // Compatibility with existing MPP adapter
  if (request.headers.get('x-mpp-credential')) return true

  return false
}

/**
 * Extract the MPP token from a request.
 * Checks X-Payment-Token, Authorization: Bearer, and x-mpp-credential headers.
 */
function extractMppToken(request: Request): string | null {
  // Priority 1: Explicit payment token header
  const paymentToken = request.headers.get(MPP_HEADERS.TOKEN)
  if (paymentToken) return paymentToken

  // Priority 2: Authorization bearer
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) {
      return bearer
    }
  }

  // Priority 3: Legacy MPP credential header
  return request.headers.get('x-mpp-credential')
}

/**
 * Extract the amount the agent is authorizing from request headers or body.
 * Returns amount in cents, or null if not specified.
 */
function extractRequestedAmount(request: Request): number | null {
  const amountHeader = request.headers.get(MPP_HEADERS.AMOUNT)
  if (amountHeader) {
    const parsed = parseInt(amountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const maxAmountHeader = request.headers.get(MPP_HEADERS.MAX_AMOUNT)
  if (maxAmountHeader) {
    const parsed = parseInt(maxAmountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

// ─── Validation & Capture ───────────────────────────────────────────────────

/**
 * Validate an incoming MPP payment from a Stripe Shared Payment Token (SPT).
 *
 * Flow:
 *   1. Extract the SPT from request headers
 *   2. Call Stripe API to verify the token is valid and not expired
 *   3. Check that the authorized amount covers the tool cost
 *   4. Capture the payment via Stripe
 *   5. Return the result
 *
 * If STRIPE_MPP_SECRET is not configured, returns a clear error so the
 * proxy can fall back to the standard API key flow.
 */
export async function validateMppPayment(
  request: Request,
  toolConfig: MppToolConfig
): Promise<MppPaymentResult> {
  // Check if MPP is configured
  if (!isMppEnabled()) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'MPP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const mppSecret = getStripeMppSecret()
  if (!mppSecret) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'Stripe MPP secret key is not configured.',
      },
    }
  }

  // Extract the token
  const token = extractMppToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'MPP_TOKEN_MISSING',
        message: 'No MPP payment token found in request. Provide X-Payment-Token header or Authorization: Bearer spt_* header.',
      },
    }
  }

  const sessionId = request.headers.get(MPP_HEADERS.SESSION_ID) ?? undefined

  try {
    // Step 1: Verify the SPT with Stripe
    const verifyResult = await verifySharedPaymentToken(mppSecret, token)

    if (!verifyResult.valid) {
      return {
        valid: false,
        sessionId,
        error: {
          code: verifyResult.expired ? 'MPP_TOKEN_EXPIRED' : 'MPP_TOKEN_INVALID',
          message: verifyResult.error ?? 'SPT verification failed.',
        },
      }
    }

    // Step 2: Check that the authorized amount covers the tool cost
    const chargeAmount = toolConfig.costCents
    const agentAmount = extractRequestedAmount(request)

    // If the agent specified an amount, verify it matches the tool cost
    if (agentAmount !== null && agentAmount < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_AMOUNT_MISMATCH',
          message: `Agent authorized ${agentAmount} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    if (verifyResult.maxAmountCents !== undefined && verifyResult.maxAmountCents < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_INSUFFICIENT_AUTHORIZATION',
          message: `SPT authorizes up to ${verifyResult.maxAmountCents} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    // Step 3: Capture the payment
    const captureResult = await capturePayment(mppSecret, token, {
      amountCents: chargeAmount,
      currency: 'usd',
      description: `${toolConfig.displayName} via SettleGrid (${toolConfig.slug})`,
      recipientId: toolConfig.recipientId,
      sessionId,
    })

    if (!captureResult.success) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_CAPTURE_FAILED',
          message: captureResult.error ?? 'Payment capture failed.',
        },
      }
    }

    logger.info('mpp.payment_captured', {
      toolSlug: toolConfig.slug,
      amountCents: chargeAmount,
      paymentId: captureResult.paymentId,
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    })

    return {
      valid: true,
      paymentId: captureResult.paymentId,
      amountCents: chargeAmount,
      currency: 'usd',
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    }
  } catch (err) {
    logger.error('mpp.validation_error', {
      toolSlug: toolConfig.slug,
      token: token.slice(0, 12) + '...',
      sessionId,
    }, err)

    return {
      valid: false,
      sessionId,
      error: {
        code: 'MPP_STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during MPP payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an MPP 402 Payment Required response with pricing information.
 *
 * Returned when an agent calls a SettleGrid tool without a valid MPP payment.
 * The response body and headers follow the MPP specification so that
 * MPP-compatible agents can automatically negotiate payment.
 */
export function generateMpp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientId?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const effectiveRecipientId = recipientId ?? 'acct_settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'mpp',
    version: MPP_PROTOCOL_VERSION,
    amount: costCents,
    currency: 'usd',
    description,
    recipient: effectiveRecipientId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_tokens: ['spt'],
    network: 'stripe',
    // Discovery: where to find more tools
    directory_url: `${appUrl}/api/v1/discover`,
    // Instructions for the agent
    instructions: `To pay, re-send the request with X-Payment-Token: spt_... header containing a valid Stripe Shared Payment Token authorizing at least ${costCents} cents.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    [MPP_HEADERS.PROTOCOL]: `MPP/${MPP_PROTOCOL_VERSION}`,
    [MPP_HEADERS.AMOUNT]: String(costCents),
    [MPP_HEADERS.CURRENCY]: 'USD',
    [MPP_HEADERS.DESCRIPTION]: description,
    [MPP_HEADERS.RECIPIENT]: effectiveRecipientId,
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}

// ─── Stripe SPT Verification ────────────────────────────────────────────────
//
// The following functions interact with Stripe's MPP API.
// As of March 2026, the Stripe MPP API uses these endpoints:
//   POST /v1/mpp/shared_payment_tokens/:id/verify
//   POST /v1/mpp/shared_payment_tokens/:id/capture
//
// If the exact API changes, these functions should be updated.
// The architecture ensures all Stripe communication is isolated here.

interface SptVerifyResult {
  valid: boolean
  expired?: boolean
  maxAmountCents?: number
  currency?: string
  payerCustomerId?: string
  error?: string
}

interface SptCaptureParams {
  amountCents: number
  currency: string
  description: string
  recipientId?: string
  sessionId?: string
}

interface SptCaptureResult {
  success: boolean
  paymentId?: string
  payerCustomerId?: string
  error?: string
}

/**
 * Verify a Shared Payment Token with Stripe's MPP API.
 *
 * POST https://api.stripe.com/v1/mpp/shared_payment_tokens/{token}/verify
 *
 * TODO: When Stripe publishes the final MPP API reference, update the
 * endpoint URL and request/response format to match. The current
 * implementation follows the announced specification from March 2026.
 */
async function verifySharedPaymentToken(
  apiKey: string,
  token: string
): Promise<SptVerifyResult> {
  // Extract token ID (strip prefix if present)
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined

      // Handle specific Stripe error codes
      if (response.status === 404) {
        return { valid: false, error: 'SPT not found or already consumed.' }
      }
      if (response.status === 401) {
        return { valid: false, error: 'Invalid Stripe MPP API key.' }
      }

      const stripeMessage = (errorObj?.message as string) ?? `Stripe returned HTTP ${response.status}`
      const isExpired = stripeMessage.toLowerCase().includes('expired')

      return {
        valid: false,
        expired: isExpired,
        error: stripeMessage,
      }
    }

    const data = await response.json() as Record<string, unknown>

    return {
      valid: true,
      maxAmountCents: typeof data.max_amount === 'number' ? data.max_amount : undefined,
      currency: typeof data.currency === 'string' ? data.currency : 'usd',
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error('mpp.stripe_verify_error', { tokenId: tokenId.slice(0, 12) + '...' }, err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to reach Stripe MPP API.',
    }
  }
}

/**
 * Capture payment against a verified Shared Payment Token.
 *
 * POST https://api.stripe.com/v1/mpp/shared_payment_tokens/{token}/capture
 *
 * TODO: Update endpoint and params when Stripe finalizes the MPP capture API.
 */
async function capturePayment(
  apiKey: string,
  token: string,
  params: SptCaptureParams
): Promise<SptCaptureResult> {
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const formData = new URLSearchParams({
      amount: String(params.amountCents),
      currency: params.currency,
      description: params.description,
    })

    if (params.recipientId) {
      formData.set('destination', params.recipientId)
    }
    if (params.sessionId) {
      formData.set('metadata[mpp_session_id]', params.sessionId)
    }
    formData.set('metadata[platform]', 'settlegrid')
    formData.set('metadata[version]', MPP_PROTOCOL_VERSION)

    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
        body: formData.toString(),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined
      const stripeMessage = (errorObj?.message as string) ?? `Capture failed with HTTP ${response.status}`

      return {
        success: false,
        error: stripeMessage,
      }
    }

    const data = await response.json() as Record<string, unknown>

    return {
      success: true,
      paymentId: typeof data.id === 'string' ? data.id : typeof data.payment_intent === 'string' ? data.payment_intent : undefined,
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error('mpp.stripe_capture_error', {
      tokenId: tokenId.slice(0, 12) + '...',
      amountCents: params.amountCents,
    }, err)

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture payment via Stripe MPP API.',
    }
  }
}
