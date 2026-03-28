/**
 * ACP (Agentic Commerce Protocol) — Deep Smart Proxy Integration
 *
 * Handles ACP payment flows for SettleGrid tools:
 *   1. Detects ACP headers on incoming requests (x-acp-token, etc.)
 *   2. Validates ACP checkout tokens via Stripe
 *   3. Captures payments through Stripe checkout sessions
 *   4. Returns proper ACP 402 responses when payment is required
 *
 * ACP (Stripe + OpenAI Agentic Commerce Protocol) uses Stripe checkout
 * sessions for agent purchases. The agent initiates a checkout session,
 * Stripe processes the payment, and the agent receives a checkout token
 * to authorize tool access.
 *
 * @see https://docs.stripe.com/agents
 */

import { logger } from './logger'
import { isAcpEnabled, getAppUrl } from './env'

// ─── ACP Constants ──────────────────────────────────────────────────────────

const ACP_PROTOCOL_VERSION = '1.0'
const ACP_TOKEN_PREFIX = 'acp_'

/** ACP-specific HTTP headers */
const ACP_HEADERS = {
  /** ACP checkout token (Stripe checkout session token) */
  TOKEN: 'x-acp-token',
  /** ACP checkout session ID */
  SESSION_ID: 'x-acp-session-id',
  /** ACP merchant reference */
  MERCHANT_REF: 'x-acp-merchant-ref',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AcpPaymentResult {
  valid: boolean
  /** Stripe checkout session ID */
  checkoutSessionId?: string
  /** Stripe Payment Intent ID */
  paymentIntentId?: string
  /** Stripe customer ID of the payer */
  customerId?: string
  /** Amount paid in cents */
  amountCents?: number
  /** Currency code */
  currency?: string
  /** Error details when validation fails */
  error?: {
    code: AcpErrorCode
    message: string
  }
}

export type AcpErrorCode =
  | 'ACP_NOT_CONFIGURED'
  | 'ACP_TOKEN_MISSING'
  | 'ACP_TOKEN_INVALID'
  | 'ACP_SESSION_EXPIRED'
  | 'ACP_SESSION_UNPAID'
  | 'ACP_AMOUNT_MISMATCH'
  | 'ACP_CAPTURE_FAILED'
  | 'ACP_STRIPE_ERROR'

export interface AcpToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name for payment descriptions */
  displayName: string
  /** Stripe Connect account ID for receiving payments */
  recipientId?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains ACP payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-acp-token header (ACP checkout token)
 *   2. x-acp-session-id header (Stripe checkout session reference)
 *   3. x-settlegrid-protocol: acp header
 *   4. Authorization: Bearer acp_* prefix
 */
export function isAcpRequest(request: Request): boolean {
  // ACP token header
  if (request.headers.get(ACP_HEADERS.TOKEN)) return true

  // ACP session ID header
  if (request.headers.get(ACP_HEADERS.SESSION_ID)) return true

  // Explicit protocol hint
  if (request.headers.get(ACP_HEADERS.PROTOCOL) === 'acp') return true

  // Authorization bearer with acp prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(ACP_TOKEN_PREFIX)) return true
  }

  return false
}

/**
 * Extract the ACP token from a request.
 * Checks x-acp-token, Authorization: Bearer, and x-acp-session-id headers.
 */
function extractAcpToken(request: Request): string | null {
  // Priority 1: Explicit ACP token header
  const acpToken = request.headers.get(ACP_HEADERS.TOKEN)
  if (acpToken) return acpToken

  // Priority 2: Authorization bearer with acp prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(ACP_TOKEN_PREFIX)) {
      return bearer
    }
  }

  // Priority 3: ACP session ID (used as token fallback)
  return request.headers.get(ACP_HEADERS.SESSION_ID)
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming ACP payment from a Stripe checkout session token.
 *
 * Flow:
 *   1. Extract the ACP token from request headers
 *   2. Retrieve the checkout session from Stripe
 *   3. Verify the session is paid and not expired
 *   4. Check that the payment amount covers the tool cost
 *   5. Return the result
 *
 * If ACP_STRIPE_KEY is not configured, returns a clear error so the
 * proxy can fall back to the standard API key flow.
 */
export async function validateAcpPayment(
  request: Request,
  toolConfig: AcpToolConfig
): Promise<AcpPaymentResult> {
  // Check if ACP is configured
  if (!isAcpEnabled()) {
    return {
      valid: false,
      error: {
        code: 'ACP_NOT_CONFIGURED',
        message: 'ACP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Extract the token
  const token = extractAcpToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'ACP_TOKEN_MISSING',
        message: 'No ACP token found in request. Provide x-acp-token header with a valid ACP checkout token.',
      },
    }
  }

  const sessionId = request.headers.get(ACP_HEADERS.SESSION_ID) ?? undefined

  try {
    // Retrieve the checkout session from Stripe
    const acpStripeKey = process.env.ACP_STRIPE_KEY!
    const session = await retrieveCheckoutSession(acpStripeKey, token, sessionId)

    if (!session.found) {
      return {
        valid: false,
        error: {
          code: 'ACP_TOKEN_INVALID',
          message: session.error ?? 'ACP checkout session not found.',
        },
      }
    }

    // Check payment status
    if (session.paymentStatus !== 'paid') {
      return {
        valid: false,
        checkoutSessionId: session.sessionId,
        error: {
          code: 'ACP_SESSION_UNPAID',
          message: `ACP checkout session has payment status "${session.paymentStatus}". Expected "paid".`,
        },
      }
    }

    // Check expiration
    if (session.expiresAt) {
      const now = Math.floor(Date.now() / 1000)
      if (now > session.expiresAt) {
        return {
          valid: false,
          checkoutSessionId: session.sessionId,
          error: {
            code: 'ACP_SESSION_EXPIRED',
            message: `ACP checkout session expired ${now - session.expiresAt}s ago.`,
          },
        }
      }
    }

    // Check that the payment amount covers the tool cost
    if (session.amountTotalCents !== undefined && session.amountTotalCents < toolConfig.costCents) {
      return {
        valid: false,
        checkoutSessionId: session.sessionId,
        error: {
          code: 'ACP_AMOUNT_MISMATCH',
          message: `ACP checkout session paid ${session.amountTotalCents} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }

    logger.info('acp.payment_validated', {
      toolSlug: toolConfig.slug,
      checkoutSessionId: session.sessionId,
      paymentIntentId: session.paymentIntentId,
      amountCents: session.amountTotalCents,
      customerId: session.customerId,
    })

    return {
      valid: true,
      checkoutSessionId: session.sessionId,
      paymentIntentId: session.paymentIntentId,
      customerId: session.customerId,
      amountCents: session.amountTotalCents,
      currency: session.currency,
    }
  } catch (err) {
    logger.error('acp.validation_error', {
      toolSlug: toolConfig.slug,
      token: token.slice(0, 12) + '...',
      sessionId,
    }, err)

    return {
      valid: false,
      error: {
        code: 'ACP_STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during ACP payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an ACP 402 Payment Required response with checkout information.
 *
 * Returned when an agent calls a SettleGrid tool without a valid ACP token.
 * The response includes a checkout URL that the agent (or its hosting platform)
 * can use to initiate a Stripe checkout session.
 */
export function generateAcp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientId?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const checkoutUrl = `${appUrl}/api/acp/checkout`
  const effectiveRecipientId = recipientId ?? 'acct_settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'acp',
    version: ACP_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    recipient: effectiveRecipientId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    // ACP checkout flow
    checkout: {
      url: checkoutUrl,
      method: 'POST',
      params: {
        tool_slug: toolSlug,
        amount_cents: costCents,
        currency: 'usd',
        description,
        success_url: `${paymentEndpoint}?acp_status=success`,
        cancel_url: `${paymentEndpoint}?acp_status=cancel`,
      },
    },
    accepted_tokens: ['acp_checkout_session'],
    network: 'stripe',
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, create a Stripe checkout session via POST ${checkoutUrl}, complete the checkout, then re-send the request with x-acp-token header containing the checkout session token.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'acp',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}

// ─── Stripe Checkout Session Retrieval ──────────────────────────────────────

interface CheckoutSessionResult {
  found: boolean
  sessionId?: string
  paymentStatus?: string
  paymentIntentId?: string
  customerId?: string
  amountTotalCents?: number
  currency?: string
  expiresAt?: number
  error?: string
}

/**
 * Retrieve a Stripe checkout session to verify ACP payment.
 *
 * Attempts to retrieve by:
 *   1. ACP token as session ID (cs_*)
 *   2. Explicit session ID
 *
 * TODO: Update endpoint and handling when Stripe finalizes the ACP API.
 * The current implementation uses standard Stripe Checkout Session retrieval.
 */
async function retrieveCheckoutSession(
  apiKey: string,
  token: string,
  sessionId?: string
): Promise<CheckoutSessionResult> {
  // Determine the session ID to look up
  // ACP tokens can be the session ID directly (cs_*) or prefixed (acp_cs_*)
  let lookupId = token
  if (token.startsWith(ACP_TOKEN_PREFIX)) {
    lookupId = token.slice(ACP_TOKEN_PREFIX.length)
  }
  if (sessionId && sessionId.startsWith('cs_')) {
    lookupId = sessionId
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(lookupId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { found: false, error: 'Checkout session not found.' }
      }
      if (response.status === 401) {
        return { found: false, error: 'Invalid ACP Stripe API key.' }
      }

      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined
      return {
        found: false,
        error: (errorObj?.message as string) ?? `Stripe returned HTTP ${response.status}`,
      }
    }

    const data = await response.json() as Record<string, unknown>

    return {
      found: true,
      sessionId: typeof data.id === 'string' ? data.id : undefined,
      paymentStatus: typeof data.payment_status === 'string' ? data.payment_status : undefined,
      paymentIntentId: typeof data.payment_intent === 'string' ? data.payment_intent : undefined,
      customerId: typeof data.customer === 'string' ? data.customer : undefined,
      amountTotalCents: typeof data.amount_total === 'number' ? data.amount_total : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      expiresAt: typeof data.expires_at === 'number' ? data.expires_at : undefined,
    }
  } catch (err) {
    logger.error('acp.stripe_session_error', { lookupId: lookupId.slice(0, 12) + '...' }, err)
    return {
      found: false,
      error: err instanceof Error ? err.message : 'Failed to reach Stripe API.',
    }
  }
}
