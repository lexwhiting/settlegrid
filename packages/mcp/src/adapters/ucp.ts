/**
 * UCP Protocol Adapter — Universal Commerce Protocol (Google + Shopify)
 *
 * Extracts payment context from UCP session-based checkout requests.
 * UCP uses .well-known/ucp for discovery and session-based checkout
 * (create -> update -> complete).
 *
 * Detects requests via:
 *   1. x-ucp-session header (UCP session ID)
 *   2. x-settlegrid-protocol: ucp header
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

export class UCPAdapter implements ProtocolAdapter {
  readonly name = 'ucp' as const
  readonly displayName = 'Universal Commerce Protocol (Google + Shopify)'

  /**
   * Detect if this request is a UCP checkout.
   * UCP requests have:
   *   - x-ucp-session header (session-based checkout)
   *   - OR x-settlegrid-protocol: ucp
   */
  canHandle(request: Request): boolean {
    const hasUcpSession = request.headers.get('x-ucp-session') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'ucp'
    return hasUcpSession || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const sessionId = request.headers.get('x-ucp-session') ?? ''
    let method = 'checkout'
    let service = 'ucp-session'
    let handler = 'unknown'

    try {
      const clone = request.clone()
      const body = await clone.json()

      // UCP session lifecycle: create -> update -> complete
      if (body?.action) method = String(body.action)
      if (body?.service) service = String(body.service)
      // Payment handler: Google Pay, Shop Pay, Stripe, etc.
      if (body?.paymentHandler) handler = String(body.paymentHandler)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'ucp',
      identity: {
        type: 'ucp-session',
        value: sessionId || 'anonymous',
        metadata: { paymentHandler: handler },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'payment-handler',
      },
      ...(sessionId ? { session: { id: sessionId } } : {}),
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'ucp',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        sessionId: result.metadata.protocol === 'ucp' ? result.operationId : null,
        status: result.status,
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
    const isSessionError =
      error.message.includes('session') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isSessionError) {
      status = 401
      code = 'UCP_SESSION_ERROR'
    } else if (isPaymentError) {
      status = 402
      code = 'UCP_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'UCP_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'ucp' as const,
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
   * Build the `accepts[]` challenge entry for the UCP (Universal
   * Commerce Protocol) rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateUcp402Response` in `apps/web/src/lib/ucp-proxy.ts`
   * (protocol + amount_cents + currency + checkout.supported_payment_handlers).
   * A future pass will replace this with a full session-based
   * checkout entry (create/update/complete session URLs,
   * .well-known/ucp discovery info) — today's stub carries the
   * list of supported handlers so a client can pick one.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'ucp',
      provider: 'google-shopify',
      costCents,
      currency: 'USD',
      supportedPaymentHandlers: ['google-pay', 'shop-pay', 'stripe'],
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(request: Request, options: UcpValidateOptions): Promise<UcpPaymentResult> {
    return validateUcpPayment(request, options)
  }

  /** P2.K2 — generate a full UCP 402 Payment Required response. */
  build402Response(options: Ucp402Options): Response {
    return generateUcp402Response(options)
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const UCP_PROTOCOL_VERSION = '1.0'

const UCP_HTTP_HEADERS = {
  SESSION: 'x-ucp-session',
  PAYMENT_HANDLER: 'x-ucp-payment-handler',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface UcpPaymentResult {
  valid: boolean
  sessionId?: string
  paymentHandler?: string
  amountCents?: number
  error?: { code: UcpErrorCode; message: string }
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

export interface UcpValidateOptions {
  enabled: boolean
  toolConfig: UcpToolConfig
  logger?: AdapterLogger
}

export interface Ucp402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
}

export function isUcpRequest(request: Request): boolean {
  if (request.headers.get(UCP_HTTP_HEADERS.SESSION)) return true
  if (request.headers.get(UCP_HTTP_HEADERS.PROTOCOL) === 'ucp') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('ucp_')) return true
  }

  return false
}

export async function validateUcpPayment(
  request: Request,
  options: UcpValidateOptions,
): Promise<UcpPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'UCP_NOT_CONFIGURED',
        message: 'UCP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const sessionId = request.headers.get(UCP_HTTP_HEADERS.SESSION)
  if (!sessionId) {
    return {
      valid: false,
      error: {
        code: 'UCP_SESSION_MISSING',
        message: 'No UCP session ID found in request. Provide x-ucp-session header.',
      },
    }
  }

  const paymentHandler = request.headers.get(UCP_HTTP_HEADERS.PAYMENT_HANDLER) ?? undefined

  try {
    // TODO: Call UCP API to verify session status and payment completion
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

export function generateUcp402Response(options: Ucp402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
