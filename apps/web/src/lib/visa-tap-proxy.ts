/**
 * Visa TAP (Trusted Agent Protocol) — Deep Smart Proxy Integration
 *
 * Handles Visa TAP payment flows for SettleGrid tools:
 *   1. Detects Visa TAP headers on incoming requests (x-visa-agent-token, etc.)
 *   2. Validates Visa TAP tokens via Visa's API
 *   3. Authorizes payments through the Visa token service
 *   4. Returns proper 402 responses when payment is required
 *
 * Visa TAP enables AI agents to hold scoped Visa tokens with per-transaction
 * and daily spending limits, providing card-network-level settlement.
 * Agents present a Visa TAP token reference, which is verified and authorized
 * via Visa's API (through a payment processor).
 *
 * @see https://developer.visa.com/capabilities/visa-token-service
 */

import { logger } from './logger'
import { isVisaTapEnabled, getAppUrl, getVisaApiUrl, getVisaApiKey, getVisaSharedSecret } from './env'

// ─── Visa TAP Constants ────────────────────────────────────────────────────

const VISA_TAP_PROTOCOL_VERSION = '1.0'
const VISA_TAP_TOKEN_PREFIX = 'vtap_'

/** Visa TAP-specific HTTP headers */
const VISA_TAP_HEADERS = {
  /** Visa agent token reference */
  AGENT_TOKEN: 'x-visa-agent-token',
  /** Agent attestation (JSON with confidence, context, verification method) */
  AGENT_ATTESTATION: 'x-visa-agent-attestation',
  /** Payment amount in cents */
  AMOUNT: 'x-visa-amount',
  /** Merchant ID */
  MERCHANT_ID: 'x-visa-merchant-id',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VisaTapPaymentResult {
  valid: boolean
  /** Visa authorization code */
  authorizationCode?: string
  /** Visa network reference ID */
  networkReferenceId?: string
  /** Token reference ID */
  tokenReferenceId?: string
  /** Amount authorized in cents */
  amountCents?: number
  /** Agent ID from attestation */
  agentId?: string
  /** Error details when validation fails */
  error?: {
    code: VisaTapErrorCode
    message: string
  }
}

export type VisaTapErrorCode =
  | 'VISA_TAP_NOT_CONFIGURED'
  | 'VISA_TAP_TOKEN_MISSING'
  | 'VISA_TAP_TOKEN_INVALID'
  | 'VISA_TAP_TOKEN_EXPIRED'
  | 'VISA_TAP_TOKEN_REVOKED'
  | 'VISA_TAP_LIMIT_EXCEEDED'
  | 'VISA_TAP_AUTHORIZATION_DECLINED'
  | 'VISA_TAP_API_ERROR'

export interface VisaTapToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name for payment descriptions */
  displayName: string
  /** Merchant ID for Visa TAP transactions */
  merchantId?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains Visa TAP payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-visa-agent-token header (Visa TAP token reference)
 *   2. x-settlegrid-protocol: visa-tap header
 *   3. Authorization: Bearer vtap_* prefix
 */
export function isVisaTapRequest(request: Request): boolean {
  // Visa agent token header
  if (request.headers.get(VISA_TAP_HEADERS.AGENT_TOKEN)) return true

  // Explicit protocol hint
  if (request.headers.get(VISA_TAP_HEADERS.PROTOCOL) === 'visa-tap') return true

  // Authorization bearer with vtap prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(VISA_TAP_TOKEN_PREFIX)) return true
  }

  return false
}

/**
 * Extract the Visa TAP token reference from a request.
 * Checks x-visa-agent-token and Authorization: Bearer headers.
 */
function extractVisaTapToken(request: Request): string | null {
  // Priority 1: Explicit Visa agent token header
  const agentToken = request.headers.get(VISA_TAP_HEADERS.AGENT_TOKEN)
  if (agentToken) return agentToken

  // Priority 2: Authorization bearer with vtap prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(VISA_TAP_TOKEN_PREFIX)) {
      return bearer
    }
  }

  return null
}

/**
 * Extract the agent attestation from request headers.
 * Returns parsed attestation or null.
 */
function extractAgentAttestation(request: Request): AgentAttestation | null {
  const attestationHeader = request.headers.get(VISA_TAP_HEADERS.AGENT_ATTESTATION)
  if (!attestationHeader) return null

  try {
    return JSON.parse(attestationHeader) as AgentAttestation
  } catch {
    return null
  }
}

interface AgentAttestation {
  agentId: string
  confidence: number
  decisionContext: string
  userVerificationMethod: 'passkey' | 'pin' | 'biometric' | 'none'
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming Visa TAP payment from a Visa agent token.
 *
 * Flow:
 *   1. Extract the Visa TAP token from request headers
 *   2. Validate the token via Visa's API (status, limits)
 *   3. Submit authorization request through the payment processor
 *   4. Return the result
 *
 * If VISA_TAP_API_KEY is not configured, returns a clear error so the
 * proxy can fall back to the standard API key flow.
 */
export async function validateVisaTapPayment(
  request: Request,
  toolConfig: VisaTapToolConfig
): Promise<VisaTapPaymentResult> {
  // Check if Visa TAP is configured
  if (!isVisaTapEnabled()) {
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_NOT_CONFIGURED',
        message: 'Visa TAP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Extract the token
  const token = extractVisaTapToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_TOKEN_MISSING',
        message: 'No Visa TAP token found in request. Provide x-visa-agent-token header with a valid Visa TAP token reference.',
      },
    }
  }

  const attestation = extractAgentAttestation(request)

  try {
    // Step 1: Verify the token status via Visa API
    const apiUrl = getVisaApiUrl()
    const apiKey = getVisaApiKey()
    const sharedSecret = getVisaSharedSecret()

    if (!apiKey) {
      return {
        valid: false,
        error: {
          code: 'VISA_TAP_NOT_CONFIGURED',
          message: 'Visa TAP API key is not configured.',
        },
      }
    }

    const tokenStatus = await verifyVisaToken(apiUrl, apiKey, sharedSecret, token)

    if (!tokenStatus.valid) {
      const errorCode: VisaTapErrorCode = tokenStatus.expired
        ? 'VISA_TAP_TOKEN_EXPIRED'
        : tokenStatus.revoked
          ? 'VISA_TAP_TOKEN_REVOKED'
          : 'VISA_TAP_TOKEN_INVALID'

      return {
        valid: false,
        tokenReferenceId: token,
        error: {
          code: errorCode,
          message: tokenStatus.error ?? 'Visa TAP token verification failed.',
        },
      }
    }

    // Step 2: Check per-transaction limit
    if (tokenStatus.maxTransactionCents !== undefined &&
        tokenStatus.maxTransactionCents < toolConfig.costCents) {
      return {
        valid: false,
        tokenReferenceId: token,
        error: {
          code: 'VISA_TAP_LIMIT_EXCEEDED',
          message: `Visa TAP token per-transaction limit is ${tokenStatus.maxTransactionCents} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }

    // Step 3: Check daily limit
    if (tokenStatus.dailyLimitCents !== undefined &&
        tokenStatus.dailySpentCents !== undefined &&
        (tokenStatus.dailySpentCents + toolConfig.costCents) > tokenStatus.dailyLimitCents) {
      const remainingCents = tokenStatus.dailyLimitCents - tokenStatus.dailySpentCents
      return {
        valid: false,
        tokenReferenceId: token,
        error: {
          code: 'VISA_TAP_LIMIT_EXCEEDED',
          message: `Visa TAP daily limit would be exceeded. Remaining: ${remainingCents} cents, required: ${toolConfig.costCents} cents.`,
        },
      }
    }

    // Step 4: Submit authorization
    const authResult = await authorizeVisaPayment(apiUrl, apiKey, sharedSecret, {
      tokenReferenceId: token,
      amountCents: toolConfig.costCents,
      currency: 'USD',
      merchantId: toolConfig.merchantId ?? 'settlegrid_platform',
      agentAttestation: attestation ?? {
        agentId: 'unknown',
        confidence: 0,
        decisionContext: 'tool_invocation',
        userVerificationMethod: 'none',
      },
    })

    if (!authResult.authorized) {
      return {
        valid: false,
        tokenReferenceId: token,
        error: {
          code: 'VISA_TAP_AUTHORIZATION_DECLINED',
          message: authResult.error ?? 'Visa TAP authorization was declined.',
        },
      }
    }

    logger.info('visa_tap.payment_authorized', {
      toolSlug: toolConfig.slug,
      tokenReferenceId: token.slice(0, 12) + '...',
      authorizationCode: authResult.authorizationCode,
      amountCents: toolConfig.costCents,
      agentId: attestation?.agentId ?? 'unknown',
    })

    return {
      valid: true,
      authorizationCode: authResult.authorizationCode,
      networkReferenceId: authResult.networkReferenceId,
      tokenReferenceId: token,
      amountCents: toolConfig.costCents,
      agentId: attestation?.agentId,
    }
  } catch (err) {
    logger.error('visa_tap.validation_error', {
      toolSlug: toolConfig.slug,
      token: token.slice(0, 12) + '...',
    }, err)

    return {
      valid: false,
      error: {
        code: 'VISA_TAP_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during Visa TAP payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate a Visa TAP 402 Payment Required response with payment requirements.
 *
 * Returned when an agent calls a SettleGrid tool without a valid Visa TAP token.
 * The response includes token requirements and provisioning instructions.
 */
export function generateVisaTap402Response(
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
    protocol: 'visa-tap',
    version: VISA_TAP_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    merchant_id: effectiveMerchantId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_tokens: ['visa_agent_token'],
    // Visa TAP-specific info
    token_requirements: {
      min_transaction_limit_cents: costCents,
      merchant_scope: effectiveMerchantId,
      required_attestation: true,
    },
    token_provision_url: `${appUrl}/api/visa-tap/provision`,
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, provision a Visa TAP agent token with at least ${costCents} cents transaction limit, then re-send the request with x-visa-agent-token header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'visa-tap',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}

// ─── Visa API Communication ────────────────────────────────────────────────

interface VisaTokenVerifyResult {
  valid: boolean
  expired?: boolean
  revoked?: boolean
  maxTransactionCents?: number
  dailyLimitCents?: number
  dailySpentCents?: number
  error?: string
}

interface VisaAuthorizationResult {
  authorized: boolean
  authorizationCode?: string
  networkReferenceId?: string
  error?: string
}

/**
 * Verify a Visa TAP token status via Visa's API.
 *
 * TODO: Replace with actual Visa Token Service API call when sandbox
 * credentials are obtained. The current implementation follows the
 * announced Visa TAP specification.
 */
async function verifyVisaToken(
  apiUrl: string,
  apiKey: string,
  sharedSecret: string | undefined,
  tokenRef: string
): Promise<VisaTokenVerifyResult> {
  try {
    const headers: Record<string, string> = {
      'Authorization': `Basic ${Buffer.from(`${apiKey}:${sharedSecret ?? ''}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    const response = await fetch(
      `${apiUrl}/vts/v2/tokenReferenceIds/${encodeURIComponent(tokenRef)}`,
      {
        method: 'GET',
        headers,
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, error: 'Visa TAP token not found.' }
      }
      if (response.status === 401) {
        return { valid: false, error: 'Invalid Visa API credentials.' }
      }

      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorMessage = (errorBody.message as string) ?? `Visa API returned HTTP ${response.status}`
      const isExpired = errorMessage.toLowerCase().includes('expired')
      const isRevoked = errorMessage.toLowerCase().includes('revoked') || errorMessage.toLowerCase().includes('suspended')

      return {
        valid: false,
        expired: isExpired,
        revoked: isRevoked,
        error: errorMessage,
      }
    }

    const data = await response.json() as Record<string, unknown>
    const tokenStatus = data.tokenStatus as string | undefined

    if (tokenStatus === 'expired') {
      return { valid: false, expired: true, error: 'Visa TAP token has expired.' }
    }
    if (tokenStatus === 'revoked' || tokenStatus === 'suspended') {
      return { valid: false, revoked: true, error: `Visa TAP token is ${tokenStatus}.` }
    }

    return {
      valid: true,
      maxTransactionCents: typeof data.maxTransactionCents === 'number' ? data.maxTransactionCents : undefined,
      dailyLimitCents: typeof data.dailyLimitCents === 'number' ? data.dailyLimitCents : undefined,
      dailySpentCents: typeof data.dailySpentCents === 'number' ? data.dailySpentCents : undefined,
    }
  } catch (err) {
    logger.error('visa_tap.verify_error', { tokenRef: tokenRef.slice(0, 12) + '...' }, err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to reach Visa TAP API.',
    }
  }
}

/**
 * Submit a Visa TAP payment authorization.
 *
 * TODO: Replace with actual Visa payment authorization API call when sandbox
 * credentials are obtained. Uses the Visa TAP payment instruction format.
 */
async function authorizeVisaPayment(
  apiUrl: string,
  apiKey: string,
  sharedSecret: string | undefined,
  instruction: {
    tokenReferenceId: string
    amountCents: number
    currency: string
    merchantId: string
    agentAttestation: AgentAttestation
  }
): Promise<VisaAuthorizationResult> {
  try {
    const headers: Record<string, string> = {
      'Authorization': `Basic ${Buffer.from(`${apiKey}:${sharedSecret ?? ''}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    const response = await fetch(
      `${apiUrl}/vts/v2/payments/authorizations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tokenReferenceId: instruction.tokenReferenceId,
          amount: instruction.amountCents,
          currency: instruction.currency,
          merchantId: instruction.merchantId,
          agentAttestation: instruction.agentAttestation,
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorMessage = (errorBody.message as string) ?? `Visa authorization failed with HTTP ${response.status}`
      return { authorized: false, error: errorMessage }
    }

    const data = await response.json() as Record<string, unknown>
    const responseCode = data.responseCode as string | undefined

    if (responseCode !== '00' && responseCode !== 'approved') {
      return {
        authorized: false,
        error: `Authorization declined with response code ${responseCode}: ${data.responseMessage ?? 'Unknown reason'}.`,
      }
    }

    return {
      authorized: true,
      authorizationCode: typeof data.authorizationCode === 'string' ? data.authorizationCode : undefined,
      networkReferenceId: typeof data.networkReferenceId === 'string' ? data.networkReferenceId : undefined,
    }
  } catch (err) {
    logger.error('visa_tap.authorization_error', {
      tokenRef: instruction.tokenReferenceId.slice(0, 12) + '...',
      amountCents: instruction.amountCents,
    }, err)

    return {
      authorized: false,
      error: err instanceof Error ? err.message : 'Failed to authorize via Visa TAP API.',
    }
  }
}
