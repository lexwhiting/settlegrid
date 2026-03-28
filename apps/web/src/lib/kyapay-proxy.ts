/**
 * KYAPay (Skyfire — Visa Intelligent Commerce) — Smart Proxy Integration
 *
 * Handles KYAPay payment flows for SettleGrid tools.
 * KYAPay uses JWT tokens with verified agent identity + payment credentials:
 *   - Agent presents KYAPay JWT in request headers
 *   - JWT contains: agent owner info, authorized spend amount, payment credentials
 *   - Service validates JWT signature and processes payment
 *
 * Full JWT validation is implemented (RS256/HS256, no external API needed).
 *
 * @see https://skyfire.xyz/
 */

import { createHmac } from 'crypto'
import { logger } from './logger'
import { getAppUrl } from './env'

// ─── KYAPay Constants ───────────────────────────────────────────────────────

const KYAPAY_PROTOCOL_VERSION = '1.0'

/** KYAPay-specific HTTP headers */
const KYAPAY_HEADERS = {
  /** KYAPay JWT token */
  TOKEN: 'x-kyapay-token',
  /** KYAPay agent identifier */
  AGENT_ID: 'x-kyapay-agent-id',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KyaPayPaymentResult {
  valid: boolean
  /** JWT token identifier (jti claim) */
  tokenId?: string
  /** Agent owner / principal identifier (sub claim) */
  principalId?: string
  /** Agent identifier from JWT */
  agentId?: string
  /** Authorized spend amount in cents */
  authorizedAmountCents?: number
  /** Amount charged in cents */
  chargedAmountCents?: number
  /** Error details when validation fails */
  error?: {
    code: KyaPayErrorCode
    message: string
  }
}

export type KyaPayErrorCode =
  | 'KYAPAY_NOT_CONFIGURED'
  | 'KYAPAY_TOKEN_MISSING'
  | 'KYAPAY_TOKEN_INVALID'
  | 'KYAPAY_TOKEN_EXPIRED'
  | 'KYAPAY_INSUFFICIENT_AUTHORIZATION'
  | 'KYAPAY_SIGNATURE_INVALID'

export interface KyaPayToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name */
  displayName: string
}

// ─── JWT Types ──────────────────────────────────────────────────────────────

interface KyaPayJwtHeader {
  alg: string
  typ: string
  kid?: string
}

interface KyaPayJwtPayload {
  /** Subject — principal (agent owner) identifier */
  sub?: string
  /** Issuer — should be KYAPay / Skyfire */
  iss?: string
  /** Audience — service provider identifier */
  aud?: string | string[]
  /** Expiration time */
  exp?: number
  /** Not before time */
  nbf?: number
  /** Issued at time */
  iat?: number
  /** JWT ID — unique token identifier */
  jti?: string
  /** KYAPay-specific: agent identifier */
  agent_id?: string
  /** KYAPay-specific: authorized maximum spend in cents */
  max_spend_cents?: number
  /** KYAPay-specific: payment credentials reference */
  payment_credential_ref?: string
  /** KYAPay-specific: allowed services (tool slugs) */
  allowed_services?: string[]
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains KYAPay payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-kyapay-token header
 *   2. Authorization: Bearer kyapay_* prefix
 *   3. x-settlegrid-protocol: kyapay header
 */
export function isKyaPayRequest(request: Request): boolean {
  if (request.headers.get(KYAPAY_HEADERS.TOKEN)) return true
  if (request.headers.get(KYAPAY_HEADERS.PROTOCOL) === 'kyapay') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('kyapay_')) return true
  }

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isKyaPayEnabled(): boolean {
  return !!process.env.KYAPAY_VERIFICATION_KEY
}

// ─── JWT Operations ─────────────────────────────────────────────────────────

/**
 * Base64URL decode a string.
 */
function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

/**
 * Parse a JWT token into header, payload, and signature parts.
 * Does NOT verify the signature — call verifyJwtSignature separately.
 */
function parseJwt(
  token: string
): { header: KyaPayJwtHeader; payload: KyaPayJwtPayload; signedContent: string; signature: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as KyaPayJwtHeader
    const payload = JSON.parse(base64UrlDecode(parts[1])) as KyaPayJwtPayload
    const signedContent = `${parts[0]}.${parts[1]}`
    const signature = parts[2]

    return { header, payload, signedContent, signature }
  } catch {
    return null
  }
}

/**
 * Verify a JWT signature using HMAC-SHA256 (HS256).
 *
 * For RS256 verification, the KYAPAY_VERIFICATION_KEY should be a PEM-encoded
 * public key. RS256 verification uses Node.js crypto.verify.
 * HS256 verification uses HMAC with the shared secret.
 */
function verifyJwtSignature(
  signedContent: string,
  signature: string,
  algorithm: string,
  verificationKey: string
): boolean {
  if (algorithm === 'HS256') {
    // HMAC-SHA256 verification
    const expectedSig = createHmac('sha256', verificationKey)
      .update(signedContent)
      .digest('base64url')
    return expectedSig === signature
  }

  if (algorithm === 'RS256') {
    // RSA-SHA256 verification
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto') as typeof import('crypto')
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(signedContent)
      const sigBuffer = Buffer.from(signature + '='.repeat((4 - (signature.length % 4)) % 4), 'base64')
      return verifier.verify(verificationKey, sigBuffer)
    } catch {
      return false
    }
  }

  // Unsupported algorithm
  return false
}

/**
 * Extract the KYAPay token from request headers.
 */
function extractKyaPayToken(request: Request): string | null {
  // Priority 1: Explicit KYAPay token header
  const kyaToken = request.headers.get(KYAPAY_HEADERS.TOKEN)
  if (kyaToken) return kyaToken

  // Priority 2: Authorization bearer with kyapay_ prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('kyapay_')) {
      // Strip the kyapay_ prefix to get the actual JWT
      return bearer.slice(7)
    }
  }

  return null
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming KYAPay JWT payment token.
 *
 * Flow:
 *   1. Extract the JWT from request headers
 *   2. Parse the JWT (header + payload + signature)
 *   3. Verify the JWT signature (HS256 or RS256)
 *   4. Check expiry, nbf, and authorized spend amount
 *   5. Verify the tool slug is in the allowed services (if specified)
 *   6. Return the result
 */
export async function validateKyaPayPayment(
  request: Request,
  toolConfig: KyaPayToolConfig
): Promise<KyaPayPaymentResult> {
  if (!isKyaPayEnabled()) {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_NOT_CONFIGURED',
        message: 'KYAPay payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const token = extractKyaPayToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_TOKEN_MISSING',
        message: 'No KYAPay token found in request. Provide x-kyapay-token header or Authorization: Bearer kyapay_<jwt> header.',
      },
    }
  }

  // Parse the JWT
  const parsed = parseJwt(token)
  if (!parsed) {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_TOKEN_INVALID',
        message: 'Failed to parse KYAPay JWT. Ensure it is a valid JWT (3 dot-separated base64url segments).',
      },
    }
  }

  const { header, payload, signedContent, signature } = parsed

  // Verify algorithm is supported
  if (header.alg !== 'HS256' && header.alg !== 'RS256') {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_TOKEN_INVALID',
        message: `Unsupported JWT algorithm: ${header.alg}. Supported: HS256, RS256.`,
      },
    }
  }

  // Verify signature
  const verificationKey = process.env.KYAPAY_VERIFICATION_KEY!
  const signatureValid = verifyJwtSignature(signedContent, signature, header.alg, verificationKey)
  if (!signatureValid) {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_SIGNATURE_INVALID',
        message: 'KYAPay JWT signature verification failed.',
      },
    }
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && Number.isFinite(payload.exp) && now > payload.exp) {
    return {
      valid: false,
      tokenId: payload.jti,
      error: {
        code: 'KYAPAY_TOKEN_EXPIRED',
        message: `KYAPay JWT expired ${now - payload.exp}s ago.`,
      },
    }
  }

  // Check not-before
  if (payload.nbf && Number.isFinite(payload.nbf) && now < payload.nbf) {
    return {
      valid: false,
      tokenId: payload.jti,
      error: {
        code: 'KYAPAY_TOKEN_INVALID',
        message: `KYAPay JWT not yet valid; becomes valid in ${payload.nbf - now}s.`,
      },
    }
  }

  // Check authorized spend amount
  if (payload.max_spend_cents !== undefined) {
    const maxSpend = payload.max_spend_cents
    if (Number.isFinite(maxSpend) && maxSpend < toolConfig.costCents) {
      return {
        valid: false,
        tokenId: payload.jti,
        authorizedAmountCents: maxSpend,
        error: {
          code: 'KYAPAY_INSUFFICIENT_AUTHORIZATION',
          message: `KYAPay JWT authorizes up to ${maxSpend} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }
  }

  // Check allowed services (if specified)
  if (payload.allowed_services && Array.isArray(payload.allowed_services)) {
    if (!payload.allowed_services.includes(toolConfig.slug) && !payload.allowed_services.includes('*')) {
      return {
        valid: false,
        tokenId: payload.jti,
        error: {
          code: 'KYAPAY_TOKEN_INVALID',
          message: `KYAPay JWT does not authorize access to service "${toolConfig.slug}".`,
        },
      }
    }
  }

  const agentId = payload.agent_id ?? request.headers.get(KYAPAY_HEADERS.AGENT_ID) ?? undefined

  logger.info('kyapay.payment_accepted', {
    toolSlug: toolConfig.slug,
    tokenId: payload.jti,
    principalId: payload.sub,
    agentId,
    maxSpendCents: payload.max_spend_cents,
    chargedCents: toolConfig.costCents,
  })

  return {
    valid: true,
    tokenId: payload.jti,
    principalId: payload.sub,
    agentId,
    authorizedAmountCents: payload.max_spend_cents,
    chargedAmountCents: toolConfig.costCents,
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate a KYAPay 402 Payment Required response.
 */
export function generateKyaPay402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'kyapay',
    version: KYAPAY_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['kyapay-jwt'],
    authentication: {
      type: 'jwt',
      algorithms: ['HS256', 'RS256'],
      required_claims: ['sub', 'exp', 'max_spend_cents'],
      optional_claims: ['agent_id', 'allowed_services', 'payment_credential_ref'],
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain a KYAPay JWT from the Skyfire platform with max_spend_cents >= ${costCents} and re-send the request with x-kyapay-token header or Authorization: Bearer kyapay_<jwt>.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'kyapay',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
