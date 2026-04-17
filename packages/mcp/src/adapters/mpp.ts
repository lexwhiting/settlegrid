/**
 * MPP Protocol Adapter — Machine Payments Protocol (Stripe + Tempo)
 *
 * Extracts payment context from MPP protocol requests.
 * MPP launched March 18, 2026, enabling Stripe-powered card payments (SPT)
 * and Tempo blockchain crypto payments for machine-to-machine commerce.
 *
 * Deep integration: SettleGrid natively accepts Stripe Shared Payment Tokens
 * (SPTs) via the Smart Proxy. See lib/mpp.ts for the full payment handler.
 *
 * Detects requests via:
 *   1. X-Payment-Protocol: MPP/1.0 header
 *   2. X-Payment-Token: spt_* header (Shared Payment Token)
 *   3. x-mpp-credential header (MPP session credential)
 *   4. x-settlegrid-protocol: mpp header
 *   5. Authorization: Bearer spt_* or Bearer mpp_* token
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

// ─── MPP Constants (P2.K2 — migrated from apps/web/src/lib/mpp.ts) ─────────

const MPP_PROTOCOL_VERSION = '1.0'
const MPP_TOKEN_PREFIX = 'spt_'
const MPP_CREDENTIAL_PREFIX = 'mpp_'

const MPP_HTTP_HEADERS = {
  PROTOCOL: 'X-Payment-Protocol',
  TOKEN: 'X-Payment-Token',
  AMOUNT: 'X-Payment-Amount',
  CURRENCY: 'X-Payment-Currency',
  DESCRIPTION: 'X-Payment-Description',
  RECIPIENT: 'X-Payment-Recipient',
  MAX_AMOUNT: 'X-Payment-Max-Amount',
  SESSION_ID: 'X-MPP-Session-Id',
} as const

export class MPPAdapter implements ProtocolAdapter {
  readonly name = 'mpp' as const
  readonly displayName = 'Machine Payments Protocol (Stripe + Tempo)'

  /**
   * Detect if this request is an MPP payment.
   * Extended detection to cover all MPP header patterns including
   * the deep SPT integration headers.
   */
  canHandle(request: Request): boolean {
    // Deep integration: X-Payment-Protocol header
    const protocolHeader = request.headers.get('x-payment-protocol')
    if (protocolHeader?.startsWith('MPP')) return true

    // Deep integration: X-Payment-Token with SPT prefix
    const paymentToken = request.headers.get('x-payment-token')
    if (paymentToken?.startsWith('spt_')) return true

    // Legacy: x-mpp-credential header
    const hasMppCredential = request.headers.get('x-mpp-credential') !== null

    // Legacy: explicit protocol header
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'mpp'

    // Authorization bearer with MPP or SPT prefix
    const auth = request.headers.get('authorization')
    const hasAuthMpp = auth?.includes('mpp_') === true || auth?.includes('spt_') === true

    return hasMppCredential || hasProtocolHeader || hasAuthMpp
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    // Extract credential from multiple possible header locations
    const credential =
      request.headers.get('x-payment-token') ??
      request.headers.get('x-mpp-credential') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null

    if (!credential) {
      throw new Error('No MPP credential found in request')
    }

    // Determine payment type from the credential or body. The default is
    // 'spt' (Stripe Shared Payment Token — MPP's primary payment path); the
    // body's `paymentType` field checked below can upgrade to 'crypto' when
    // the caller is using Tempo blockchain. The original code here was
    // `credential.startsWith('spt_') ? 'spt' : 'spt'` — a degenerate ternary
    // whose both branches returned 'spt'. It is simplified here to a straight
    // assignment so the observed behavior is preserved without the dead-code
    // smell; the identity.type ternary below continues to discriminate
    // 'spt_'-prefixed credentials from generic mpp-session credentials.
    let paymentType: 'spt' | 'crypto' = 'spt'
    let method = 'payment'
    let service = 'mpp-session'
    let sessionId: string | undefined

    // Check for MPP session ID header
    sessionId = request.headers.get('x-mpp-session-id') ?? undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      // MPP uses paymentType field to distinguish Stripe SPT vs Tempo crypto
      if (body?.paymentType === 'crypto' || body?.paymentType === 'tempo') {
        paymentType = 'crypto'
      }
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.sessionId && !sessionId) sessionId = String(body.sessionId)
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'mpp',
      identity: {
        type: credential.startsWith('spt_') ? 'spt' : 'mpp-session',
        value: credential,
        metadata: { paymentType },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: paymentType,
      },
      ...(sessionId ? { session: { id: sessionId } } : {}),
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'mpp',
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        txHash: result.txHash ?? null,
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
    const isCredentialError =
      error.message.includes('credential') ||
      error.message.includes('invalid') ||
      error.message.includes('expired') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isCredentialError) {
      status = 401
      code = 'MPP_CREDENTIAL_INVALID'
    } else if (isPaymentError) {
      status = 402
      code = 'MPP_PAYMENT_REQUIRED'
    } else {
      status = 500
      code = 'MPP_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mpp' as const,
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
   * Build the `accepts[]` challenge entry for the MPP (Machine Payments
   * Protocol) rail. Renamed from `toAcceptEntry` in P1.K4 to match the
   * spec's "buildChallenge" terminology. Hardcoded Stripe provider and
   * USD currency are P1.K3 stubs; a future pass will let the tool
   * choose between Stripe and Tempo and pick a currency.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'mpp',
      provider: 'stripe',
      amountCents: costCents,
      currency: 'USD',
    }
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

export interface MppPaymentResult {
  valid: boolean
  paymentId?: string
  amountCents?: number
  currency?: string
  payerCustomerId?: string
  sessionId?: string
  error?: { code: MppErrorCode; message: string }
}

export type MppErrorCode =
  | 'MPP_NOT_CONFIGURED'
  | 'MPP_TOKEN_MISSING'
  | 'MPP_TOKEN_INVALID'
  | 'MPP_TOKEN_EXPIRED'
  | 'MPP_AMOUNT_MISMATCH'
  | 'MPP_INSUFFICIENT_AUTHORIZATION'
  | 'MPP_CAPTURE_FAILED'
  | 'MPP_STRIPE_ERROR'

export interface MppToolConfig {
  slug: string
  costCents: number
  displayName: string
  recipientId?: string
}

export interface MppValidateOptions {
  enabled: boolean
  toolConfig: MppToolConfig
  /** Stripe MPP API secret (STRIPE_MPP_SECRET). */
  stripeMppSecret?: string
  logger?: AdapterLogger
}

export interface Mpp402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  recipientId?: string
  appUrl: string
}

/** Check if a request contains MPP payment headers (module-level helper). */
export function isMppRequest(request: Request): boolean {
  const protocol = request.headers.get(MPP_HTTP_HEADERS.PROTOCOL)
  if (protocol?.startsWith('MPP')) return true

  const token = request.headers.get(MPP_HTTP_HEADERS.TOKEN)
  if (token && (token.startsWith(MPP_TOKEN_PREFIX) || token.startsWith(MPP_CREDENTIAL_PREFIX))) {
    return true
  }

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) return true
  }

  if (request.headers.get('x-mpp-credential')) return true
  return false
}

function extractMppToken(request: Request): string | null {
  const paymentToken = request.headers.get(MPP_HTTP_HEADERS.TOKEN)
  if (paymentToken) return paymentToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) {
      return bearer
    }
  }

  return request.headers.get('x-mpp-credential')
}

function extractRequestedAmount(request: Request): number | null {
  const amountHeader = request.headers.get(MPP_HTTP_HEADERS.AMOUNT)
  if (amountHeader) {
    const parsed = parseInt(amountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const maxAmountHeader = request.headers.get(MPP_HTTP_HEADERS.MAX_AMOUNT)
  if (maxAmountHeader) {
    const parsed = parseInt(maxAmountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

interface SptVerifyResult {
  valid: boolean
  expired?: boolean
  maxAmountCents?: number
  currency?: string
  payerCustomerId?: string
  error?: string
}

async function verifySharedPaymentToken(
  apiKey: string,
  token: string,
  logger: AdapterLogger,
): Promise<SptVerifyResult> {
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
      },
    )

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined

      if (response.status === 404) return { valid: false, error: 'SPT not found or already consumed.' }
      if (response.status === 401) return { valid: false, error: 'Invalid Stripe MPP API key.' }

      const stripeMessage = (errorObj?.message as string) ?? `Stripe returned HTTP ${response.status}`
      const isExpired = stripeMessage.toLowerCase().includes('expired')

      return { valid: false, expired: isExpired, error: stripeMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      valid: true,
      maxAmountCents: typeof data.max_amount === 'number' ? data.max_amount : undefined,
      currency: typeof data.currency === 'string' ? data.currency : 'usd',
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error('mpp.stripe_verify_error', { tokenId: tokenId.slice(0, 12) + '...' }, err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to reach Stripe MPP API.',
    }
  }
}

interface SptCaptureParams {
  amountCents: number
  currency: string
  description: string
  recipientId?: string
  sessionId?: string
}

interface SptCaptureResult {
  success: boolean
  paymentId?: string
  payerCustomerId?: string
  error?: string
}

async function capturePayment(
  apiKey: string,
  token: string,
  params: SptCaptureParams,
  logger: AdapterLogger,
): Promise<SptCaptureResult> {
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const formData = new URLSearchParams({
      amount: String(params.amountCents),
      currency: params.currency,
      description: params.description,
    })
    if (params.recipientId) formData.set('destination', params.recipientId)
    if (params.sessionId) formData.set('metadata[mpp_session_id]', params.sessionId)
    formData.set('metadata[platform]', 'settlegrid')
    formData.set('metadata[version]', MPP_PROTOCOL_VERSION)

    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
        body: formData.toString(),
      },
    )

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined
      const stripeMessage = (errorObj?.message as string) ?? `Capture failed with HTTP ${response.status}`
      return { success: false, error: stripeMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      paymentId:
        typeof data.id === 'string'
          ? data.id
          : typeof data.payment_intent === 'string'
            ? data.payment_intent
            : undefined,
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error(
      'mpp.stripe_capture_error',
      { tokenId: tokenId.slice(0, 12) + '...', amountCents: params.amountCents },
      err,
    )
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture payment via Stripe MPP API.',
    }
  }
}

export async function validateMppPayment(
  request: Request,
  options: MppValidateOptions,
): Promise<MppPaymentResult> {
  const { enabled, toolConfig, stripeMppSecret } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'MPP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  if (!stripeMppSecret) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'Stripe MPP secret key is not configured.',
      },
    }
  }

  const token = extractMppToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'MPP_TOKEN_MISSING',
        message:
          'No MPP payment token found in request. Provide X-Payment-Token header or Authorization: Bearer spt_* header.',
      },
    }
  }

  const sessionId = request.headers.get(MPP_HTTP_HEADERS.SESSION_ID) ?? undefined

  try {
    const verifyResult = await verifySharedPaymentToken(stripeMppSecret, token, logger)
    if (!verifyResult.valid) {
      return {
        valid: false,
        sessionId,
        error: {
          code: verifyResult.expired ? 'MPP_TOKEN_EXPIRED' : 'MPP_TOKEN_INVALID',
          message: verifyResult.error ?? 'SPT verification failed.',
        },
      }
    }

    const chargeAmount = toolConfig.costCents
    const agentAmount = extractRequestedAmount(request)

    if (agentAmount !== null && agentAmount < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_AMOUNT_MISMATCH',
          message: `Agent authorized ${agentAmount} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    if (verifyResult.maxAmountCents !== undefined && verifyResult.maxAmountCents < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_INSUFFICIENT_AUTHORIZATION',
          message: `SPT authorizes up to ${verifyResult.maxAmountCents} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    const captureResult = await capturePayment(
      stripeMppSecret,
      token,
      {
        amountCents: chargeAmount,
        currency: 'usd',
        description: `${toolConfig.displayName} via SettleGrid (${toolConfig.slug})`,
        recipientId: toolConfig.recipientId,
        sessionId,
      },
      logger,
    )

    if (!captureResult.success) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_CAPTURE_FAILED',
          message: captureResult.error ?? 'Payment capture failed.',
        },
      }
    }

    logger.info('mpp.payment_captured', {
      toolSlug: toolConfig.slug,
      amountCents: chargeAmount,
      paymentId: captureResult.paymentId,
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    })

    return {
      valid: true,
      paymentId: captureResult.paymentId,
      amountCents: chargeAmount,
      currency: 'usd',
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    }
  } catch (err) {
    logger.error(
      'mpp.validation_error',
      { toolSlug: toolConfig.slug, token: token.slice(0, 12) + '...', sessionId },
      err,
    )
    return {
      valid: false,
      sessionId,
      error: {
        code: 'MPP_STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during MPP payment validation.',
      },
    }
  }
}

export function generateMpp402Response(options: Mpp402Options): Response {
  const { toolSlug, costCents, toolName, recipientId, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const effectiveRecipientId = recipientId ?? 'acct_settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'mpp',
    version: MPP_PROTOCOL_VERSION,
    amount: costCents,
    currency: 'usd',
    description,
    recipient: effectiveRecipientId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_tokens: ['spt'],
    network: 'stripe',
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, re-send the request with X-Payment-Token: spt_... header containing a valid Stripe Shared Payment Token authorizing at least ${costCents} cents.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    [MPP_HTTP_HEADERS.PROTOCOL]: `MPP/${MPP_PROTOCOL_VERSION}`,
    [MPP_HTTP_HEADERS.AMOUNT]: String(costCents),
    [MPP_HTTP_HEADERS.CURRENCY]: 'USD',
    [MPP_HTTP_HEADERS.DESCRIPTION]: description,
    [MPP_HTTP_HEADERS.RECIPIENT]: effectiveRecipientId,
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
