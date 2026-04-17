/**
 * ACP Protocol Adapter — Agentic Commerce Protocol (OpenAI + Stripe)
 *
 * Extracts payment context from ACP checkout requests.
 * ACP handles checkout in ChatGPT via Stripe Shared Payment Tokens (SPTs).
 * Stripe-locked in v1.
 *
 * Detects requests via:
 *   1. x-acp-token header (ACP checkout token)
 *   2. x-settlegrid-protocol: acp header
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

export class ACPAdapter implements ProtocolAdapter {
  readonly name = 'acp' as const
  readonly displayName = 'Agentic Commerce Protocol (OpenAI + Stripe)'

  /**
   * Detect if this request is an ACP checkout.
   * ACP requests have:
   *   - x-acp-token header (ACP checkout token)
   *   - OR x-settlegrid-protocol: acp
   */
  canHandle(request: Request): boolean {
    const hasAcpToken = request.headers.get('x-acp-token') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'acp'
    return hasAcpToken || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const acpToken = request.headers.get('x-acp-token') ?? ''
    let method = 'checkout'
    let service = 'acp-checkout'
    let checkoutId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.checkoutId) checkoutId = String(body.checkoutId)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'acp',
      identity: {
        type: 'spt',
        value: acpToken || 'anonymous',
        metadata: { checkoutId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'spt',
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'acp',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        checkoutId: result.operationId,
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
    const isCheckoutError =
      error.message.includes('checkout') ||
      error.message.includes('session') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isCheckoutError) {
      status = 401
      code = 'ACP_CHECKOUT_ERROR'
    } else if (isPaymentError) {
      status = 402
      code = 'ACP_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'ACP_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'acp' as const,
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
   * Build the `accepts[]` challenge entry for the ACP (Agentic
   * Commerce Protocol) rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateAcp402Response` in `apps/web/src/lib/acp-proxy.ts`
   * (protocol + amount_cents + currency + checkout.url + recipient).
   * A future pass will replace this with the Stripe SPT checkout-
   * specific entry (OpenAI ChatGPT connector, merchant callback URL,
   * SPT issuer config) — today's stub carries provider + currency.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'acp',
      provider: 'openai-stripe',
      costCents,
      currency: 'USD',
    }
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const ACP_PROTOCOL_VERSION = '1.0'
const ACP_TOKEN_PREFIX = 'acp_'

const ACP_HTTP_HEADERS = {
  TOKEN: 'x-acp-token',
  SESSION_ID: 'x-acp-session-id',
  MERCHANT_REF: 'x-acp-merchant-ref',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface AcpPaymentResult {
  valid: boolean
  checkoutSessionId?: string
  paymentIntentId?: string
  customerId?: string
  amountCents?: number
  currency?: string
  error?: { code: AcpErrorCode; message: string }
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
  slug: string
  costCents: number
  displayName: string
  recipientId?: string
}

export interface AcpValidateOptions {
  enabled: boolean
  toolConfig: AcpToolConfig
  /** Stripe API key used to retrieve checkout sessions (ACP_STRIPE_KEY). */
  acpStripeKey?: string
  logger?: AdapterLogger
}

export interface Acp402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  recipientId?: string
  appUrl: string
}

export function isAcpRequest(request: Request): boolean {
  if (request.headers.get(ACP_HTTP_HEADERS.TOKEN)) return true
  if (request.headers.get(ACP_HTTP_HEADERS.SESSION_ID)) return true
  if (request.headers.get(ACP_HTTP_HEADERS.PROTOCOL) === 'acp') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(ACP_TOKEN_PREFIX)) return true
  }

  return false
}

function extractAcpToken(request: Request): string | null {
  const acpToken = request.headers.get(ACP_HTTP_HEADERS.TOKEN)
  if (acpToken) return acpToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(ACP_TOKEN_PREFIX)) return bearer
  }

  return request.headers.get(ACP_HTTP_HEADERS.SESSION_ID)
}

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

async function retrieveCheckoutSession(
  apiKey: string,
  token: string,
  sessionId: string | undefined,
  logger: AdapterLogger,
): Promise<CheckoutSessionResult> {
  let lookupId = token
  if (token.startsWith(ACP_TOKEN_PREFIX)) lookupId = token.slice(ACP_TOKEN_PREFIX.length)
  if (sessionId && sessionId.startsWith('cs_')) lookupId = sessionId

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(lookupId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) return { found: false, error: 'Checkout session not found.' }
      if (response.status === 401) return { found: false, error: 'Invalid ACP Stripe API key.' }

      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined
      return {
        found: false,
        error: (errorObj?.message as string) ?? `Stripe returned HTTP ${response.status}`,
      }
    }

    const data = (await response.json()) as Record<string, unknown>
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

export async function validateAcpPayment(
  request: Request,
  options: AcpValidateOptions,
): Promise<AcpPaymentResult> {
  const { enabled, toolConfig, acpStripeKey } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'ACP_NOT_CONFIGURED',
        message: 'ACP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const token = extractAcpToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'ACP_TOKEN_MISSING',
        message:
          'No ACP token found in request. Provide x-acp-token header with a valid ACP checkout token.',
      },
    }
  }

  if (!acpStripeKey) {
    return {
      valid: false,
      error: {
        code: 'ACP_NOT_CONFIGURED',
        message: 'ACP Stripe API key is not configured.',
      },
    }
  }

  const sessionId = request.headers.get(ACP_HTTP_HEADERS.SESSION_ID) ?? undefined

  try {
    const session = await retrieveCheckoutSession(acpStripeKey, token, sessionId, logger)

    if (!session.found) {
      return {
        valid: false,
        error: {
          code: 'ACP_TOKEN_INVALID',
          message: session.error ?? 'ACP checkout session not found.',
        },
      }
    }

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
    logger.error(
      'acp.validation_error',
      { toolSlug: toolConfig.slug, token: token.slice(0, 12) + '...', sessionId },
      err,
    )
    return {
      valid: false,
      error: {
        code: 'ACP_STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during ACP payment validation.',
      },
    }
  }
}

export function generateAcp402Response(options: Acp402Options): Response {
  const { toolSlug, costCents, toolName, recipientId, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
