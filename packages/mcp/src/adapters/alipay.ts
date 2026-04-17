/**
 * Alipay ACTP Protocol Adapter — Agentic Commerce Trust Protocol (Ant Group)
 *
 * The canonical spec name is the Agentic Commerce Trust Protocol (ACTP);
 * the runtime identifier `'alipay'` matches the env var prefix
 * (ALIPAY_*) and lib filename convention. Earlier internal SettleGrid
 * drafts called this "Alipay Trust Protocol" — that shorthand is retired.
 *
 * P2.K2 migrates the lib/alipay-proxy.ts validation + 402 generation into
 * this adapter file. Env-agnostic: all env values (feature flag, app URL,
 * optional API secrets) are passed in via options.
 *
 * Status: detection + 402 responses are fully functional; validation is
 * structural (stub) pending Alipay Open Platform partnership credentials.
 *
 * @see https://global.alipay.com/
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

// ─── Alipay Constants ───────────────────────────────────────────────────────

const ALIPAY_PROTOCOL_VERSION = '1.0'

/** Alipay-specific HTTP headers */
const ALIPAY_HEADERS = {
  AGENT_TOKEN: 'x-alipay-agent-token',
  SESSION_ID: 'x-alipay-session-id',
  MERCHANT_ID: 'x-alipay-merchant-id',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

/** Minimum agent token length for structural validation. */
const MIN_ALIPAY_TOKEN_LENGTH = 16

/** Approximate USD cents → CNY fen conversion rate (7.2 fen per USD cent). */
const CNY_FEN_PER_USD_CENT = 7.2

// ─── Public types ──────────────────────────────────────────────────────────

export interface AlipayPaymentResult {
  valid: boolean
  transactionRef?: string
  agentId?: string
  amountCents?: number
  sessionId?: string
  error?: { code: AlipayErrorCode; message: string }
}

export type AlipayErrorCode =
  | 'ALIPAY_NOT_CONFIGURED'
  | 'ALIPAY_TOKEN_MISSING'
  | 'ALIPAY_TOKEN_INVALID'
  | 'ALIPAY_TOKEN_EXPIRED'
  | 'ALIPAY_INSUFFICIENT_FUNDS'
  | 'ALIPAY_API_ERROR'

export interface AlipayToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface AlipayValidateOptions {
  enabled: boolean
  toolConfig: AlipayToolConfig
  logger?: AdapterLogger
}

export interface Alipay402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
}

// ─── Token extraction ──────────────────────────────────────────────────────

function extractAlipayToken(request: Request): string | null {
  const agentToken = request.headers.get(ALIPAY_HEADERS.AGENT_TOKEN)
  if (agentToken) return agentToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('alipay_')) return bearer
  }

  return null
}

// ─── Adapter class ─────────────────────────────────────────────────────────

export class AlipayAdapter implements ProtocolAdapter {
  readonly name = 'alipay' as const
  readonly displayName = 'Alipay ACTP (Agentic Commerce Trust Protocol)'

  canHandle(request: Request): boolean {
    if (request.headers.get(ALIPAY_HEADERS.AGENT_TOKEN)) return true
    if (request.headers.get(ALIPAY_HEADERS.PROTOCOL) === 'alipay') return true

    const auth = request.headers.get('authorization')
    if (auth) {
      const bearer = auth.replace(/^Bearer\s+/i, '')
      if (bearer.startsWith('alipay_')) return true
    }
    return false
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const token = extractAlipayToken(request)
    const sessionId = request.headers.get(ALIPAY_HEADERS.SESSION_ID) ?? undefined

    let method = 'payment'
    let service = 'alipay-actp'

    try {
      const clone = request.clone()
      const body = await clone.json()
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'alipay',
      identity: {
        type: 'jwt',
        value: token ?? 'unknown',
        metadata: { sessionId },
      },
      operation: { service, method },
      payment: { type: 'card-token' },
      ...(sessionId ? { session: { id: sessionId } } : {}),
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'alipay',
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
      msg.includes('token') || msg.includes('invalid') || msg.includes('expired')
    const isPaymentError =
      msg.includes('insufficient') || msg.includes('funds') || msg.includes('balance')

    let status: number
    let code: string
    if (isTokenError) {
      status = 401
      code = 'ALIPAY_TOKEN_INVALID'
    } else if (isPaymentError) {
      status = 402
      code = 'ALIPAY_INSUFFICIENT_FUNDS'
    } else {
      status = 500
      code = 'ALIPAY_API_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'alipay' as const,
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
      scheme: 'alipay',
      provider: 'alipay-ant',
      costCents,
      currency: 'USD',
      acceptedPayments: ['alipay-agent-token'],
    }
  }
}

// ─── Module-level validation ───────────────────────────────────────────────

/**
 * Validate an incoming ACTP (Alipay Agentic Commerce Trust Protocol) payment.
 * Current implementation is structural (stub) pending Alipay partnership.
 */
export async function validateAlipayPayment(
  request: Request,
  options: AlipayValidateOptions,
): Promise<AlipayPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_NOT_CONFIGURED',
        message:
          'ACTP (Alipay Agentic Commerce Trust Protocol) is not configured on this SettleGrid instance.',
      },
    }
  }

  const token = extractAlipayToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_TOKEN_MISSING',
        message:
          'No Alipay agent token found in request. Provide x-alipay-agent-token header or Authorization: Bearer alipay_* header.',
      },
    }
  }

  if (token.length < MIN_ALIPAY_TOKEN_LENGTH) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_TOKEN_INVALID',
        message:
          'Alipay agent token is too short. Ensure a valid token from the Alipay Agent Authorization flow.',
      },
    }
  }

  const sessionId = request.headers.get(ALIPAY_HEADERS.SESSION_ID) ?? undefined

  try {
    // TODO: Call Alipay Open Platform API to verify the agent token
    //   POST https://openapi.alipay.com/gateway.do
    //   method: alipay.agent.token.verify
    //   app_id: ALIPAY_APP_ID
    //   sign_type: RSA2
    //   sign: <RSA signature>
    //   biz_content: { agent_token: token, amount: costCents }
    const transactionRef = randomUUID()

    logger.info('alipay.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      tokenPrefix: token.slice(0, 12) + '...',
      sessionId,
      transactionRef,
      note: 'Alipay validation is stub; requires Alipay partnership.',
    })

    return {
      valid: true,
      transactionRef,
      agentId: token.slice(0, 12),
      amountCents: toolConfig.costCents,
      sessionId,
    }
  } catch (err) {
    logger.error('alipay.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'ALIPAY_API_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected error during Alipay payment validation.',
      },
    }
  }
}

// ─── Module-level 402 generation ───────────────────────────────────────────

export function generateAlipay402Response(options: Alipay402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  const amountCnyFen = Math.ceil(costCents * CNY_FEN_PER_USD_CENT)

  const body = {
    error: 'payment_required',
    protocol: 'alipay-trust',
    version: ALIPAY_PROTOCOL_VERSION,
    amount_cents: costCents,
    amount_cny_fen: amountCnyFen,
    currencies: ['USD', 'CNY'],
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['alipay-agent-token'],
    settlement: {
      type: 'alipay-rails',
      supported_methods: ['balance', 'credit', 'huabei'],
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain an Alipay Agent Token via the Alipay Agent Authorization flow and re-send the request with x-alipay-agent-token header or Authorization: Bearer alipay_<token>.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'alipay',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
