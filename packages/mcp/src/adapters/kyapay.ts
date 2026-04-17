/**
 * KYAPay Protocol Adapter — Skyfire (Visa Intelligent Commerce)
 *
 * KYAPay uses JWT tokens with verified agent identity + payment credentials.
 * The JWT carries: agent owner, authorized spend amount, payment credentials.
 * Full JWT validation (RS256/HS256) is implemented locally — no external API.
 *
 * P2.K2 migrates the lib/kyapay-proxy.ts logic into this adapter. The
 * validation function accepts the verification key as an option so the
 * adapter package stays env-agnostic.
 *
 * @see https://skyfire.xyz/
 */

import { createHmac, createVerify, timingSafeEqual } from 'crypto'
import { randomUUID } from 'crypto'
import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type {
  AdapterLogger,
  PaymentContext,
  ProtocolAdapter,
  SettlementResult,
} from './types'
import { NOOP_LOGGER } from './types'

// ─── KYAPay Constants ───────────────────────────────────────────────────────

const KYAPAY_PROTOCOL_VERSION = '1.0'

/** KYAPay-specific HTTP headers */
const KYAPAY_HEADERS = {
  TOKEN: 'x-kyapay-token',
  AGENT_ID: 'x-kyapay-agent-id',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Public types ──────────────────────────────────────────────────────────

export interface KyaPayPaymentResult {
  valid: boolean
  tokenId?: string
  principalId?: string
  agentId?: string
  authorizedAmountCents?: number
  chargedAmountCents?: number
  error?: { code: KyaPayErrorCode; message: string }
}

export type KyaPayErrorCode =
  | 'KYAPAY_NOT_CONFIGURED'
  | 'KYAPAY_TOKEN_MISSING'
  | 'KYAPAY_TOKEN_INVALID'
  | 'KYAPAY_TOKEN_EXPIRED'
  | 'KYAPAY_INSUFFICIENT_AUTHORIZATION'
  | 'KYAPAY_SIGNATURE_INVALID'

export interface KyaPayToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface KyaPayValidateOptions {
  enabled: boolean
  toolConfig: KyaPayToolConfig
  /**
   * Verification key — either an HMAC shared secret (for HS256) or a PEM-encoded
   * RSA public key (for RS256). When absent, validation returns
   * KYAPAY_NOT_CONFIGURED.
   */
  verificationKey?: string
  logger?: AdapterLogger
}

export interface KyaPay402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
}

// ─── JWT types + helpers ───────────────────────────────────────────────────

interface KyaPayJwtHeader {
  alg: string
  typ: string
  kid?: string
}

interface KyaPayJwtPayload {
  sub?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  agent_id?: string
  max_spend_cents?: number
  payment_credential_ref?: string
  allowed_services?: string[]
}

function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

function parseJwt(
  token: string,
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
 * Timing-safe comparison of two base64url-encoded strings. Used for HS256
 * JWT signatures. If lengths differ (e.g. the token's signature was
 * truncated by a network/client bug), we return false without calling
 * timingSafeEqual (which throws on length mismatch). Hostile-review M2.
 */
function timingSafeStrEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function verifyJwtSignature(
  signedContent: string,
  signature: string,
  algorithm: string,
  verificationKey: string,
): boolean {
  if (algorithm === 'HS256') {
    const expectedSig = createHmac('sha256', verificationKey)
      .update(signedContent)
      .digest('base64url')
    // Hostile-review M2: timing-safe comparison of HS256 signatures.
    return timingSafeStrEqual(expectedSig, signature)
  }

  if (algorithm === 'RS256') {
    try {
      const verifier = createVerify('RSA-SHA256')
      verifier.update(signedContent)
      const sigBuffer = Buffer.from(
        signature + '='.repeat((4 - (signature.length % 4)) % 4),
        'base64',
      )
      return verifier.verify(verificationKey, sigBuffer)
    } catch {
      return false
    }
  }

  return false
}

function extractKyaPayToken(request: Request): string | null {
  const kyaToken = request.headers.get(KYAPAY_HEADERS.TOKEN)
  if (kyaToken) return kyaToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('kyapay_')) return bearer.slice(7)
  }

  return null
}

// ─── Adapter class ─────────────────────────────────────────────────────────

export class KyaPayAdapter implements ProtocolAdapter {
  readonly name = 'kyapay' as const
  readonly displayName = 'KYAPay (Skyfire — Visa Intelligent Commerce)'

  canHandle(request: Request): boolean {
    if (request.headers.get(KYAPAY_HEADERS.TOKEN)) return true
    if (request.headers.get(KYAPAY_HEADERS.PROTOCOL) === 'kyapay') return true

    const auth = request.headers.get('authorization')
    if (auth) {
      const bearer = auth.replace(/^Bearer\s+/i, '')
      if (bearer.startsWith('kyapay_')) return true
    }
    return false
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const token = extractKyaPayToken(request)
    if (!token) {
      throw new Error('No KYAPay token in request headers')
    }

    const parsed = parseJwt(token)
    const agentId =
      parsed?.payload.agent_id ?? request.headers.get(KYAPAY_HEADERS.AGENT_ID) ?? undefined

    return {
      protocol: 'kyapay',
      identity: {
        type: 'jwt',
        value: parsed?.payload.sub ?? parsed?.payload.jti ?? 'unknown',
        metadata: {
          jti: parsed?.payload.jti,
          agentId,
          maxSpendCents: parsed?.payload.max_spend_cents,
        },
      },
      operation: {
        service: 'kyapay-service',
        method: 'payment',
      },
      payment: {
        type: 'card-token',
        proof: token,
        ...(parsed?.payload.max_spend_cents !== undefined
          ? {
              maxAmount: {
                value: BigInt(parsed.payload.max_spend_cents),
                currency: 'USD',
              },
            }
          : {}),
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'kyapay',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        metadata: {
          protocol: result.metadata.protocol,
          latencyMs: result.metadata.latencyMs,
          settlementType: result.metadata.settlementType,
        },
      }),
      { status: 200, headers },
    )
  }

  formatError(error: Error, request: Request): Response {
    const msg = error.message.toLowerCase()
    const isTokenError =
      msg.includes('token') ||
      msg.includes('jwt') ||
      msg.includes('signature') ||
      msg.includes('expired')
    const isInsufficient = msg.includes('insufficient') || msg.includes('authorization')

    let status: number
    let code: string
    if (isTokenError) {
      status = 401
      code = 'KYAPAY_TOKEN_INVALID'
    } else if (isInsufficient) {
      status = 402
      code = 'KYAPAY_INSUFFICIENT_AUTHORIZATION'
    } else {
      status = 500
      code = 'KYAPAY_TOKEN_INVALID'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'kyapay' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'kyapay',
      provider: 'skyfire-visa',
      costCents,
      currency: 'USD',
      acceptedPayments: ['kyapay-jwt'],
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(
    request: Request,
    options: KyaPayValidateOptions,
  ): Promise<KyaPayPaymentResult> {
    return validateKyaPayPayment(request, options)
  }

  /** P2.K2 — generate a full KYAPay 402 Payment Required response. */
  build402Response(options: KyaPay402Options): Response {
    return generateKyaPay402Response(options)
  }
}

// ─── Module-level validation ───────────────────────────────────────────────

export async function validateKyaPayPayment(
  request: Request,
  options: KyaPayValidateOptions,
): Promise<KyaPayPaymentResult> {
  const { enabled, toolConfig, verificationKey } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled || !verificationKey) {
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
        message:
          'No KYAPay token found in request. Provide x-kyapay-token header or Authorization: Bearer kyapay_<jwt> header.',
      },
    }
  }

  const parsed = parseJwt(token)
  if (!parsed) {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_TOKEN_INVALID',
        message:
          'Failed to parse KYAPay JWT. Ensure it is a valid JWT (3 dot-separated base64url segments).',
      },
    }
  }

  const { header, payload, signedContent, signature } = parsed

  if (header.alg !== 'HS256' && header.alg !== 'RS256') {
    return {
      valid: false,
      error: {
        code: 'KYAPAY_TOKEN_INVALID',
        message: `Unsupported JWT algorithm: ${header.alg}. Supported: HS256, RS256.`,
      },
    }
  }

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

  if (payload.allowed_services && Array.isArray(payload.allowed_services)) {
    if (
      !payload.allowed_services.includes(toolConfig.slug) &&
      !payload.allowed_services.includes('*')
    ) {
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

  const agentId =
    payload.agent_id ?? request.headers.get(KYAPAY_HEADERS.AGENT_ID) ?? undefined

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

// ─── Module-level 402 generation ───────────────────────────────────────────

export function generateKyaPay402Response(options: KyaPay402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
