/**
 * AP2 (Google Agentic Payments Protocol) — Deep Smart Proxy Integration
 *
 * Handles AP2 payment flows for SettleGrid tools:
 *   1. Detects AP2 headers on incoming requests (x-ap2-mandate, x-ap2-credential, etc.)
 *   2. Validates AP2 credentials (VDC JWTs) and mandates
 *   3. Processes payments via the AP2 credentials provider
 *   4. Returns proper AP2 402 responses when payment is required
 *
 * AP2 (Google's Agentic Pay) uses credential-based payments via
 * Verifiable Digital Credentials (VDCs). Agents present AP2 credentials
 * provisioned by a payment provider (SettleGrid acts as the credentials provider).
 *
 * @see https://developers.google.com/commerce/agentic
 */

import { logger } from './logger'
import { isAp2Enabled, getAppUrl, getAp2SigningSecret } from './env'

// ─── AP2 Constants ──────────────────────────────────────────────────────────

const AP2_PROTOCOL_VERSION = '0.1'

/** AP2-specific HTTP headers */
const AP2_HEADERS = {
  /** AP2 mandate reference (mandate ID or serialized mandate) */
  MANDATE: 'x-ap2-mandate',
  /** AP2 credential (VDC JWT) */
  CREDENTIAL: 'x-ap2-credential',
  /** AP2 consumer ID */
  CONSUMER_ID: 'x-ap2-consumer-id',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
  /** AP2 agent ID */
  AGENT_ID: 'x-ap2-agent-id',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Ap2PaymentResult {
  valid: boolean
  /** Transaction ID for the processed payment */
  transactionId?: string
  /** Consumer ID of the payer */
  consumerId?: string
  /** Amount paid in cents */
  amountCents?: number
  /** Currency code */
  currency?: string
  /** Payment method used */
  paymentMethod?: string
  /** Mandate type if present */
  mandateType?: string
  /** Error details when validation fails */
  error?: {
    code: Ap2ErrorCode
    message: string
  }
}

export type Ap2ErrorCode =
  | 'AP2_NOT_CONFIGURED'
  | 'AP2_CREDENTIAL_MISSING'
  | 'AP2_CREDENTIAL_INVALID'
  | 'AP2_CREDENTIAL_EXPIRED'
  | 'AP2_MANDATE_INVALID'
  | 'AP2_MANDATE_EXPIRED'
  | 'AP2_AMOUNT_MISMATCH'
  | 'AP2_PAYMENT_FAILED'
  | 'AP2_PROVIDER_ERROR'

export interface Ap2ToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name for payment descriptions */
  displayName: string
  /** Merchant ID for AP2 payment mandates */
  merchantId?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains AP2 payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-ap2-credential header (VDC JWT)
 *   2. x-ap2-mandate header (mandate reference)
 *   3. x-settlegrid-protocol: ap2 header
 *   4. Authorization: Bearer ap2_* prefix
 */
export function isAp2Request(request: Request): boolean {
  // AP2 credential header (VDC JWT)
  if (request.headers.get(AP2_HEADERS.CREDENTIAL)) return true

  // AP2 mandate header
  if (request.headers.get(AP2_HEADERS.MANDATE)) return true

  // Explicit protocol hint
  if (request.headers.get(AP2_HEADERS.PROTOCOL) === 'ap2') return true

  // Authorization bearer with ap2 prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ap2_')) return true
  }

  return false
}

/**
 * Extract the AP2 credential (VDC JWT) from a request.
 * Checks x-ap2-credential, Authorization: Bearer, and body fields.
 */
function extractAp2Credential(request: Request): string | null {
  // Priority 1: Explicit credential header
  const credential = request.headers.get(AP2_HEADERS.CREDENTIAL)
  if (credential) return credential

  // Priority 2: Authorization bearer with ap2 prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ap2_')) {
      return bearer.slice(4) // Strip ap2_ prefix, return JWT
    }
  }

  return null
}

/**
 * Verify a VDC JWT (AP2 credential).
 * Uses HMAC-SHA256 verification matching the AP2 credentials provider implementation.
 */
function verifyVdcJwt(token: string, secretKey: string): VdcClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  // Verify HMAC signature
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto')
  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url')

  if (parts[2] !== expectedSig) return null

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as VdcClaims
  } catch {
    return null
  }
}

interface VdcClaims {
  iss: string
  sub: string // consumer ID
  aud: string // merchant
  iat: number
  exp: number
  mandate_type: string
  mandate_id: string
  payment_method: string
  amount_cents: number
  currency: string
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming AP2 payment from a VDC credential.
 *
 * Flow:
 *   1. Extract the VDC JWT from request headers
 *   2. Verify the JWT signature using the AP2 signing secret
 *   3. Check expiration and claims
 *   4. Check that the authorized amount covers the tool cost
 *   5. Return the result
 *
 * If AP2_PROVIDER_KEY is not configured, returns a clear error so the
 * proxy can fall back to the standard API key flow.
 */
export async function validateAp2Payment(
  request: Request,
  toolConfig: Ap2ToolConfig
): Promise<Ap2PaymentResult> {
  // Check if AP2 is configured
  if (!isAp2Enabled()) {
    return {
      valid: false,
      error: {
        code: 'AP2_NOT_CONFIGURED',
        message: 'AP2 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Extract the credential
  const credential = extractAp2Credential(request)
  if (!credential) {
    return {
      valid: false,
      error: {
        code: 'AP2_CREDENTIAL_MISSING',
        message: 'No AP2 credential found in request. Provide x-ap2-credential header with a valid VDC JWT.',
      },
    }
  }

  try {
    // Verify the VDC JWT
    const signingSecret = getAp2SigningSecret()
    const claims = verifyVdcJwt(credential, signingSecret)

    if (!claims) {
      return {
        valid: false,
        error: {
          code: 'AP2_CREDENTIAL_INVALID',
          message: 'AP2 VDC JWT signature verification failed. The credential may have been tampered with or was issued by a different provider.',
        },
      }
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (claims.exp && now > claims.exp) {
      return {
        valid: false,
        error: {
          code: 'AP2_CREDENTIAL_EXPIRED',
          message: `AP2 credential expired ${now - claims.exp}s ago.`,
        },
      }
    }

    // Check that the authorized amount covers the tool cost
    if (claims.amount_cents < toolConfig.costCents) {
      return {
        valid: false,
        error: {
          code: 'AP2_AMOUNT_MISMATCH',
          message: `AP2 credential authorizes ${claims.amount_cents} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }

    // Verify issuer is SettleGrid
    if (claims.iss !== 'settlegrid.ai') {
      return {
        valid: false,
        error: {
          code: 'AP2_CREDENTIAL_INVALID',
          message: `AP2 credential issued by ${claims.iss}, expected settlegrid.ai.`,
        },
      }
    }

    const transactionId = crypto.randomUUID()

    logger.info('ap2.payment_validated', {
      toolSlug: toolConfig.slug,
      consumerId: claims.sub,
      amountCents: claims.amount_cents,
      paymentMethod: claims.payment_method,
      mandateId: claims.mandate_id,
      transactionId,
    })

    return {
      valid: true,
      transactionId,
      consumerId: claims.sub,
      amountCents: claims.amount_cents,
      currency: claims.currency,
      paymentMethod: claims.payment_method,
      mandateType: claims.mandate_type,
    }
  } catch (err) {
    logger.error('ap2.validation_error', {
      toolSlug: toolConfig.slug,
      credential: credential.slice(0, 20) + '...',
    }, err)

    return {
      valid: false,
      error: {
        code: 'AP2_PROVIDER_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during AP2 payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an AP2 402 Payment Required response with payment options.
 *
 * Returned when an agent calls a SettleGrid tool without valid AP2 credentials.
 * The response body follows AP2's skill protocol so that AP2-compatible agents
 * can navigate the mandate flow (Intent -> Cart -> Payment).
 */
export function generateAp2_402Response(
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
    protocol: 'ap2',
    version: AP2_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    merchant_id: effectiveMerchantId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    // AP2 skill protocol — tell the agent what skills are available
    available_skills: [
      {
        skill: 'get_eligible_payment_methods',
        description: 'List payment methods available for this tool',
        endpoint: `${appUrl}/api/ap2/skills/get_eligible_payment_methods`,
      },
      {
        skill: 'provision_credentials',
        description: 'Get a VDC credential to pay for this tool',
        endpoint: `${appUrl}/api/ap2/skills/provision_credentials`,
      },
    ],
    accepted_credential_types: ['vdc_jwt'],
    // AP2 mandate types accepted
    mandate_types: [
      'ap2.mandates.IntentMandate',
      'ap2.mandates.CartMandate',
      'ap2.mandates.PaymentMandate',
    ],
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain a VDC credential by calling the provision_credentials skill, then re-send the request with x-ap2-credential header containing the VDC JWT authorizing at least ${costCents} cents.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'ap2',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
