/**
 * Mastercard Verifiable Intent Adapter
 *
 * Extracts payment context from Mastercard Verifiable Intent requests using
 * SD-JWT selective disclosure with ES256 signatures.
 * Three-layer delegation chain: Credential Provider -> User -> Agent.
 *
 * Naming note: "Verifiable Intent" is the canonical product / spec name
 * for this protocol. Earlier press coverage referred to it as "Mastercard
 * Agent Pay"; that naming is retired in SettleGrid code and marketing.
 *
 * Detects requests via:
 *   1. x-mc-verifiable-intent header (SD-JWT credential chain)
 *   2. x-settlegrid-protocol: mastercard-vi header
 */

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

export class MastercardVIAdapter implements ProtocolAdapter {
  readonly name = 'mastercard-vi' as const
  readonly displayName = 'Mastercard Verifiable Intent'

  /**
   * Detect if this request is a Mastercard Verifiable Intent payment.
   * MC VI requests have:
   *   - x-mc-verifiable-intent header (SD-JWT credential chain)
   *   - OR x-settlegrid-protocol: mastercard-vi
   */
  canHandle(request: Request): boolean {
    const hasIntentHeader = request.headers.get('x-mc-verifiable-intent') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'mastercard-vi'
    return hasIntentHeader || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const intentHeader = request.headers.get('x-mc-verifiable-intent') ?? ''
    let method = 'payment'
    let service = 'mastercard-agent-pay'
    let intentId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.intentId) intentId = String(body.intentId)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'mastercard-vi',
      identity: {
        type: 'sd-jwt',
        value: intentHeader || 'unknown',
        metadata: { intentId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'agentic-token',
        proof: intentHeader || undefined,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'mastercard-vi',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        intentId: result.operationId,
        verified: result.status === 'settled',
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
    const isIntentError =
      error.message.includes('intent') ||
      error.message.includes('credential') ||
      error.message.includes('expired') ||
      error.message.includes('invalid') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isIntentError) {
      status = 401
      code = 'MC_VI_INVALID_INTENT'
    } else if (isPaymentError) {
      status = 402
      code = 'MC_VI_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'MC_VI_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mastercard-vi' as const,
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
   * Build the `accepts[]` challenge entry for the Mastercard
   * Verifiable Intent rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateMastercard402Response` in
   * `apps/web/src/lib/mastercard-proxy.ts` (protocol + amount_cents +
   * currency + accepted_credentials + credential_requirements).
   * A future pass will replace this with the full SD-JWT credential
   * chain challenge (ES256 issuer key, three-layer delegation chain,
   * Mastercard's Verifiable Intent endpoint) — today's stub carries the
   * accepted_credentials list so a client can recognize the rail.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'mastercard-vi',
      provider: 'mastercard',
      costCents,
      currency: 'USD',
      acceptedCredentials: ['sd-jwt-verifiable-intent'],
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(
    request: Request,
    options: MastercardValidateOptions,
  ): Promise<MastercardPaymentResult> {
    return validateMastercardPayment(request, options)
  }

  /** P2.K2 — generate a full Mastercard VI 402 Payment Required response. */
  build402Response(options: Mastercard402Options): Response {
    return generateMastercard402Response(options)
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const MC_PROTOCOL_VERSION = '1.0'

const MC_HTTP_HEADERS = {
  VERIFIABLE_INTENT: 'x-mc-verifiable-intent',
  INTENT_ID: 'x-mc-intent-id',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface MastercardPaymentResult {
  valid: boolean
  authorizationRef?: string
  intentId?: string
  amountCents?: number
  error?: { code: MastercardErrorCode; message: string }
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

export interface MastercardValidateOptions {
  enabled: boolean
  toolConfig: MastercardToolConfig
  logger?: AdapterLogger
}

export interface Mastercard402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  merchantId?: string
  appUrl: string
}

export function isMastercardRequest(request: Request): boolean {
  if (request.headers.get(MC_HTTP_HEADERS.VERIFIABLE_INTENT)) return true
  if (request.headers.get(MC_HTTP_HEADERS.PROTOCOL) === 'mastercard-vi') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('mcvi_')) return true
  }

  return false
}

export async function validateMastercardPayment(
  request: Request,
  options: MastercardValidateOptions,
): Promise<MastercardPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'MC_NOT_CONFIGURED',
        message: 'Mastercard Verifiable Intent is not configured on this SettleGrid instance.',
      },
    }
  }

  const intentHeader = request.headers.get(MC_HTTP_HEADERS.VERIFIABLE_INTENT)
  if (!intentHeader) {
    return {
      valid: false,
      error: {
        code: 'MC_INTENT_MISSING',
        message:
          'No Mastercard Verifiable Intent found in request. Provide x-mc-verifiable-intent header with an SD-JWT credential chain.',
      },
    }
  }

  const intentId = request.headers.get(MC_HTTP_HEADERS.INTENT_ID) ?? undefined

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
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected error during Mastercard payment validation.',
      },
    }
  }
}

export function generateMastercard402Response(options: Mastercard402Options): Response {
  const { toolSlug, costCents, toolName, merchantId, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
