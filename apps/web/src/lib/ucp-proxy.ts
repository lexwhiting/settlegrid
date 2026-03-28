/**
 * UCP (Universal Commerce Protocol) — Smart Proxy Integration (Stub)
 *
 * Handles UCP payment detection and 402 responses for SettleGrid tools.
 * UCP (Google + Shopify) uses .well-known/ucp for discovery and
 * session-based checkout (create -> update -> complete).
 *
 * NOTE: This is a stub integration with TODO markers for actual API calls.
 * Detection and 402 responses are fully functional; validation has
 * placeholder behavior until the UCP API is finalized.
 *
 * @see https://universalcommerce.dev
 */

import { logger } from './logger'
import { getAppUrl } from './env'

// ─── UCP Constants ──────────────────────────────────────────────────────────

const UCP_PROTOCOL_VERSION = '1.0'

/** UCP-specific HTTP headers */
const UCP_HEADERS = {
  /** UCP session ID */
  SESSION: 'x-ucp-session',
  /** UCP payment handler (Google Pay, Shop Pay, Stripe, etc.) */
  PAYMENT_HANDLER: 'x-ucp-payment-handler',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UcpPaymentResult {
  valid: boolean
  /** UCP session ID */
  sessionId?: string
  /** Payment handler used */
  paymentHandler?: string
  /** Amount paid in cents */
  amountCents?: number
  /** Error details when validation fails */
  error?: {
    code: UcpErrorCode
    message: string
  }
}

export type UcpErrorCode =
  | 'UCP_NOT_CONFIGURED'
  | 'UCP_SESSION_MISSING'
  | 'UCP_SESSION_INVALID'
  | 'UCP_SESSION_EXPIRED'
  | 'UCP_PAYMENT_INCOMPLETE'
  | 'UCP_API_ERROR'

export interface UcpToolConfig {
  slug: string
  costCents: number
  displayName: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains UCP payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-ucp-session header (UCP session ID)
 *   2. x-settlegrid-protocol: ucp header
 *   3. Authorization: Bearer ucp_* prefix
 */
export function isUcpRequest(request: Request): boolean {
  if (request.headers.get(UCP_HEADERS.SESSION)) return true
  if (request.headers.get(UCP_HEADERS.PROTOCOL) === 'ucp') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ucp_')) return true
  }

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isUcpEnabled(): boolean {
  return !!process.env.UCP_API_KEY
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming UCP payment from a session ID.
 *
 * TODO: Implement actual UCP session verification via UCP API.
 * Currently returns a stub response indicating UCP is not yet fully integrated.
 */
export async function validateUcpPayment(
  request: Request,
  toolConfig: UcpToolConfig
): Promise<UcpPaymentResult> {
  if (!isUcpEnabled()) {
    return {
      valid: false,
      error: {
        code: 'UCP_NOT_CONFIGURED',
        message: 'UCP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const sessionId = request.headers.get(UCP_HEADERS.SESSION)
  if (!sessionId) {
    return {
      valid: false,
      error: {
        code: 'UCP_SESSION_MISSING',
        message: 'No UCP session ID found in request. Provide x-ucp-session header.',
      },
    }
  }

  const paymentHandler = request.headers.get(UCP_HEADERS.PAYMENT_HANDLER) ?? undefined

  try {
    // TODO: Call UCP API to verify session status and payment completion
    // For now, accept sessions that pass structural validation
    logger.info('ucp.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      sessionId,
      paymentHandler,
      note: 'UCP validation is stub; accepted based on structural validation.',
    })

    return {
      valid: true,
      sessionId,
      paymentHandler,
      amountCents: toolConfig.costCents,
    }
  } catch (err) {
    logger.error('ucp.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'UCP_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during UCP payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate a UCP 402 Payment Required response.
 */
export function generateUcp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'ucp',
    version: UCP_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    // UCP session-based checkout
    checkout: {
      create_session_url: `${appUrl}/api/ucp/sessions`,
      method: 'POST',
      supported_payment_handlers: ['google-pay', 'shop-pay', 'stripe'],
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, create a UCP checkout session via POST ${appUrl}/api/ucp/sessions, complete payment, then re-send the request with x-ucp-session header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'ucp',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
