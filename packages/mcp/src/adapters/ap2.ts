/**
 * AP2 Protocol Adapter
 *
 * Extracts payment context from AP2 protocol requests (Google Agentic Payments).
 * Detects requests via:
 *   1. x-settlegrid-protocol: ap2 header
 *   2. AP2 mandate body with type field matching ap2.mandates.*
 */

import { createHmac, timingSafeEqual } from 'crypto'
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
import { randomUUID } from 'crypto'

export class AP2Adapter implements ProtocolAdapter {
  readonly name = 'ap2' as const
  readonly displayName = 'AP2 Protocol (Google Agentic Payments)'

  /**
   * Detect if this request is an AP2 payment. P2.K3 delegates to the
   * module-level `isAp2Request` helper for a single detection surface.
   */
  canHandle(request: Request): boolean {
    return isAp2Request(request)
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    // Try to parse mandate from body
    let mandateType = 'unknown'
    let consumerId = ''
    let method = 'default'
    const service = 'ap2-credentials-provider'
    let mandateRef: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      // AP2 skill request format
      if (body?.skill) {
        method = String(body.skill)
      }

      // Extract consumer ID from params
      if (body?.params?.consumerId) {
        consumerId = String(body.params.consumerId)
      }

      // Extract mandate type if present
      if (body?.params?.mandate?.type) {
        mandateType = String(body.params.mandate.type)
      }

      // Mandate ref is a reference, NOT the cryptographic credential.
      if (body?.mandateRef) {
        mandateRef = String(body.mandateRef)
      }
    } catch {
      // Body may not be JSON
    }

    // The VDC JWT credential lives in request headers (x-ap2-credential or
    // `Authorization: Bearer ap2_<jwt>`). Capture it into `payment.proof`
    // — the field is typed for exactly this ("EIP-712 signature, JWT,
    // etc.") — so the credential survives the kernel→facilitator hop, which
    // forwards only the serialized `paymentContext`, not the raw headers
    // (see kernel.ts handleFacilitatorProtocol). Fall back to the mandate
    // ref so prior behavior (proof = mandateRef) holds when no credential
    // is present; mandateRef is also preserved in identity.metadata.
    const credential = extractAp2Credential(request)
    const proof = credential ?? mandateRef

    // Determine payment type from mandate
    const paymentType = mandateType.includes('Payment') ? 'vdc' as const : 'credit-balance' as const

    return {
      protocol: 'ap2',
      identity: {
        type: 'jwt',
        value: consumerId || request.headers.get('x-ap2-consumer-id') || 'anonymous',
        metadata: {
          mandateType,
          ...(mandateRef !== undefined ? { mandateRef } : {}),
        },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: paymentType,
        proof,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'ap2',
    }

    if (result.receipt) {
      headers['X-SettleGrid-VDC'] = result.receipt
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        remainingBalanceCents: result.remainingBalanceCents ?? null,
        receipt: result.receipt ?? null,
        metadata: {
          protocol: result.metadata.protocol,
          latencyMs: result.metadata.latencyMs,
          settlementType: result.metadata.settlementType,
        },
      }),
      { status: 200, headers }
    )
  }

  formatError(error: Error, request: Request): Response {
    const isPaymentError =
      error.message.includes('mandate') ||
      error.message.includes('credential') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const status = isPaymentError ? 402 : 500
    const code = isPaymentError ? 'AP2_PAYMENT_ERROR' : 'SERVER_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'ap2' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  /**
   * Build the `accepts[]` challenge entry for the AP2 rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateAp2_402Response` in `apps/web/src/lib/ap2-proxy.ts`
   * (protocol + amount_cents + currency + merchant/issuer metadata).
   * A future pass will replace this with a full AP2 mandate-shaped
   * entry (credential provider endpoint, available_skills array,
   * VDC issuer chain) — today's stub carries just the provider +
   * currency so a client can recognize the rail and surface the cost.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'ap2',
      provider: 'google',
      costCents,
      currency: 'USD',
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(request: Request, options: Ap2ValidateOptions): Promise<Ap2PaymentResult> {
    return validateAp2Payment(request, options)
  }

  /** P2.K2 — generate a full AP2 402 Payment Required response. */
  build402Response(options: Ap2_402Options): Response {
    return generateAp2_402Response(options)
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const AP2_PROTOCOL_VERSION = '0.1'

const AP2_HTTP_HEADERS = {
  MANDATE: 'x-ap2-mandate',
  CREDENTIAL: 'x-ap2-credential',
  CONSUMER_ID: 'x-ap2-consumer-id',
  PROTOCOL: 'x-settlegrid-protocol',
  AGENT_ID: 'x-ap2-agent-id',
} as const

export interface Ap2PaymentResult {
  valid: boolean
  transactionId?: string
  consumerId?: string
  amountCents?: number
  currency?: string
  paymentMethod?: string
  mandateType?: string
  error?: { code: Ap2ErrorCode; message: string }
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
  slug: string
  costCents: number
  displayName: string
  merchantId?: string
}

export interface Ap2ValidateOptions {
  enabled: boolean
  toolConfig: Ap2ToolConfig
  /** HMAC secret for VDC JWT verification. */
  signingSecret?: string
  /** Expected issuer claim in VDC JWTs. Defaults to 'settlegrid.ai'. */
  expectedIssuer?: string
  logger?: AdapterLogger
}

export interface Ap2_402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  merchantId?: string
  appUrl: string
}

export function isAp2Request(request: Request): boolean {
  if (request.headers.get(AP2_HTTP_HEADERS.CREDENTIAL)) return true
  if (request.headers.get(AP2_HTTP_HEADERS.MANDATE)) return true
  if (request.headers.get(AP2_HTTP_HEADERS.PROTOCOL) === 'ap2') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ap2_')) return true
  }

  return false
}

function extractAp2Credential(request: Request): string | null {
  const credential = request.headers.get(AP2_HTTP_HEADERS.CREDENTIAL)
  if (credential) return credential

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ap2_')) return bearer.slice(4)
  }

  return null
}

interface VdcClaims {
  iss: string
  sub: string
  aud: string
  iat: number
  exp: number
  mandate_type: string
  mandate_id: string
  payment_method: string
  amount_cents: number
  currency: string
}

function verifyVdcJwt(token: string, secretKey: string): VdcClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const expectedSig = createHmac('sha256', secretKey)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url')

  // Hostile-review M2: timing-safe comparison of HS256 VDC JWT signatures.
  // Length check first because timingSafeEqual throws on unequal buffer
  // lengths — a truncated signature returns false cleanly.
  if (parts[2].length !== expectedSig.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expectedSig))) {
      return null
    }
  } catch {
    return null
  }

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as VdcClaims
  } catch {
    return null
  }
}

export async function validateAp2Payment(
  request: Request,
  options: Ap2ValidateOptions,
): Promise<Ap2PaymentResult> {
  // Extract the VDC credential from the request headers, then delegate to
  // the credential-string core. The kernel→facilitator verify path (which
  // only has the serialized PaymentContext, not the raw request) instead
  // calls `validateAp2CredentialString` directly with
  // `paymentContext.payment.proof`.
  const credential = extractAp2Credential(request)
  return validateAp2CredentialString(credential, options)
}

/**
 * P5 — credential-string core of AP2 validation, split out of
 * {@link validateAp2Payment} so the kernel facilitator verify route
 * (`apps/web/src/app/api/ap2/verify`) can validate a VDC carried in
 * `PaymentContext.payment.proof` without reconstructing a `Request`.
 *
 * `credential` is `string | null` so the "no credential present" branch
 * (AP2_CREDENTIAL_MISSING) lives here in one place — both the
 * header-extracting wrapper and the route get identical semantics.
 */
export async function validateAp2CredentialString(
  credential: string | null,
  options: Ap2ValidateOptions,
): Promise<Ap2PaymentResult> {
  const { enabled, toolConfig, signingSecret } = options
  const expectedIssuer = options.expectedIssuer ?? 'settlegrid.ai'
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'AP2_NOT_CONFIGURED',
        message: 'AP2 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  if (!credential) {
    return {
      valid: false,
      error: {
        code: 'AP2_CREDENTIAL_MISSING',
        message:
          'No AP2 credential found in request. Provide x-ap2-credential header with a valid VDC JWT.',
      },
    }
  }

  if (!signingSecret) {
    return {
      valid: false,
      error: {
        code: 'AP2_NOT_CONFIGURED',
        message: 'AP2 signing secret is not configured.',
      },
    }
  }

  try {
    const claims = verifyVdcJwt(credential, signingSecret)

    if (!claims) {
      return {
        valid: false,
        error: {
          code: 'AP2_CREDENTIAL_INVALID',
          message:
            'AP2 VDC JWT signature verification failed. The credential may have been tampered with or was issued by a different provider.',
        },
      }
    }

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

    if (claims.amount_cents < toolConfig.costCents) {
      return {
        valid: false,
        error: {
          code: 'AP2_AMOUNT_MISMATCH',
          message: `AP2 credential authorizes ${claims.amount_cents} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }

    if (claims.iss !== expectedIssuer) {
      return {
        valid: false,
        error: {
          code: 'AP2_CREDENTIAL_INVALID',
          message: `AP2 credential issued by ${claims.iss}, expected ${expectedIssuer}.`,
        },
      }
    }

    const transactionId = randomUUID()

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
    logger.error(
      'ap2.validation_error',
      { toolSlug: toolConfig.slug, credential: credential.slice(0, 20) + '...' },
      err,
    )
    return {
      valid: false,
      error: {
        code: 'AP2_PROVIDER_ERROR',
        message:
          err instanceof Error ? err.message : 'Unexpected error during AP2 payment validation.',
      },
    }
  }
}

export function generateAp2_402Response(options: Ap2_402Options): Response {
  const { toolSlug, costCents, toolName, merchantId, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
