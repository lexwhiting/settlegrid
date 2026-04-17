/**
 * Visa TAP Protocol Adapter (Stub)
 *
 * Detects Visa TAP protocol requests and returns not-yet-available errors.
 * Visa TAP requires sandbox access and is restricted; this adapter is a
 * placeholder that will be fully implemented once sandbox credentials are obtained.
 *
 * Detects requests via:
 *   1. x-settlegrid-protocol: visa-tap header
 *   2. x-visa-agent-token header
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

export class TAPAdapter implements ProtocolAdapter {
  readonly name = 'visa-tap' as const
  readonly displayName = 'Visa TAP (Trusted Agent Protocol)'

  /**
   * Detect if this request is a Visa TAP payment.
   * TAP requests have:
   *   - x-settlegrid-protocol: visa-tap
   *   - OR x-visa-agent-token header
   */
  canHandle(request: Request): boolean {
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'visa-tap'
    const hasVisaToken = request.headers.get('x-visa-agent-token') !== null
    return hasProtocolHeader || hasVisaToken
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const tokenRef = request.headers.get('x-visa-agent-token') ?? ''

    return {
      protocol: 'visa-tap',
      identity: {
        type: 'tap-token',
        value: tokenRef || 'unknown',
      },
      operation: {
        service: 'visa-tap',
        method: 'payment',
      },
      payment: {
        type: 'card-token',
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(_result: SettlementResult, request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message:
            'Visa TAP integration is not yet available. Visa sandbox access is required. ' +
            'Please use SettleGrid balance or AP2 credentials instead.',
          protocol: 'visa-tap' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
          sandboxInfo: {
            status: 'pending',
            alternative: ['mcp', 'ap2'],
            documentation: 'https://developer.visa.com/capabilities/visa-token-service',
          },
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  formatError(error: Error, request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message: error.message || 'Visa TAP integration is not yet available.',
          protocol: 'visa-tap' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  /**
   * Build the `accepts[]` challenge entry for the Visa TAP rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateVisaTap402Response` in `apps/web/src/lib/visa-tap-proxy.ts`
   * (protocol + amount_cents + currency + accepted_tokens
   * ['visa_agent_token']). The real implementation is still blocked
   * on Visa sandbox access — today's stub carries the accepted-tokens
   * list so a client can recognize the rail and the token type it
   * would need to obtain out-of-band.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'visa-tap',
      provider: 'visa',
      costCents,
      currency: 'USD',
      acceptedTokens: ['visa-agent-token'],
    }
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const VISA_TAP_PROTOCOL_VERSION = '1.0'
const VISA_TAP_TOKEN_PREFIX = 'vtap_'

const VISA_TAP_HTTP_HEADERS = {
  AGENT_TOKEN: 'x-visa-agent-token',
  AGENT_ATTESTATION: 'x-visa-agent-attestation',
  AMOUNT: 'x-visa-amount',
  MERCHANT_ID: 'x-visa-merchant-id',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface VisaTapPaymentResult {
  valid: boolean
  authorizationCode?: string
  networkReferenceId?: string
  tokenReferenceId?: string
  amountCents?: number
  agentId?: string
  error?: { code: VisaTapErrorCode; message: string }
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
  slug: string
  costCents: number
  displayName: string
  merchantId?: string
}

export interface VisaTapValidateOptions {
  enabled: boolean
  toolConfig: VisaTapToolConfig
  visaApiUrl?: string
  visaApiKey?: string
  visaSharedSecret?: string
  logger?: AdapterLogger
}

export interface VisaTap402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  merchantId?: string
  appUrl: string
}

interface AgentAttestation {
  agentId: string
  confidence: number
  decisionContext: string
  userVerificationMethod: 'passkey' | 'pin' | 'biometric' | 'none'
}

export function isVisaTapRequest(request: Request): boolean {
  if (request.headers.get(VISA_TAP_HTTP_HEADERS.AGENT_TOKEN)) return true
  if (request.headers.get(VISA_TAP_HTTP_HEADERS.PROTOCOL) === 'visa-tap') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(VISA_TAP_TOKEN_PREFIX)) return true
  }

  return false
}

function extractVisaTapToken(request: Request): string | null {
  const agentToken = request.headers.get(VISA_TAP_HTTP_HEADERS.AGENT_TOKEN)
  if (agentToken) return agentToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(VISA_TAP_TOKEN_PREFIX)) return bearer
  }

  return null
}

function extractAgentAttestation(request: Request): AgentAttestation | null {
  const attestationHeader = request.headers.get(VISA_TAP_HTTP_HEADERS.AGENT_ATTESTATION)
  if (!attestationHeader) return null

  try {
    return JSON.parse(attestationHeader) as AgentAttestation
  } catch {
    return null
  }
}

interface VisaTokenVerifyResult {
  valid: boolean
  expired?: boolean
  revoked?: boolean
  maxTransactionCents?: number
  dailyLimitCents?: number
  dailySpentCents?: number
  error?: string
}

async function verifyVisaToken(
  apiUrl: string,
  apiKey: string,
  sharedSecret: string | undefined,
  tokenRef: string,
  logger: AdapterLogger,
): Promise<VisaTokenVerifyResult> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${sharedSecret ?? ''}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    const response = await fetch(
      `${apiUrl}/vts/v2/tokenReferenceIds/${encodeURIComponent(tokenRef)}`,
      { method: 'GET', headers },
    )

    if (!response.ok) {
      if (response.status === 404) return { valid: false, error: 'Visa TAP token not found.' }
      if (response.status === 401) return { valid: false, error: 'Invalid Visa API credentials.' }

      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorMessage = (errorBody.message as string) ?? `Visa API returned HTTP ${response.status}`
      const isExpired = errorMessage.toLowerCase().includes('expired')
      const isRevoked =
        errorMessage.toLowerCase().includes('revoked') ||
        errorMessage.toLowerCase().includes('suspended')

      return { valid: false, expired: isExpired, revoked: isRevoked, error: errorMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
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

interface VisaAuthorizationResult {
  authorized: boolean
  authorizationCode?: string
  networkReferenceId?: string
  error?: string
}

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
  },
  logger: AdapterLogger,
): Promise<VisaAuthorizationResult> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${sharedSecret ?? ''}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    const response = await fetch(`${apiUrl}/vts/v2/payments/authorizations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tokenReferenceId: instruction.tokenReferenceId,
        amount: instruction.amountCents,
        currency: instruction.currency,
        merchantId: instruction.merchantId,
        agentAttestation: instruction.agentAttestation,
      }),
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorMessage = (errorBody.message as string) ?? `Visa authorization failed with HTTP ${response.status}`
      return { authorized: false, error: errorMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
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
    logger.error(
      'visa_tap.authorization_error',
      { tokenRef: instruction.tokenReferenceId.slice(0, 12) + '...', amountCents: instruction.amountCents },
      err,
    )
    return {
      authorized: false,
      error: err instanceof Error ? err.message : 'Failed to authorize via Visa TAP API.',
    }
  }
}

export async function validateVisaTapPayment(
  request: Request,
  options: VisaTapValidateOptions,
): Promise<VisaTapPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_NOT_CONFIGURED',
        message: 'Visa TAP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const token = extractVisaTapToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_TOKEN_MISSING',
        message:
          'No Visa TAP token found in request. Provide x-visa-agent-token header with a valid Visa TAP token reference.',
      },
    }
  }

  const apiUrl = options.visaApiUrl ?? 'https://sandbox.api.visa.com'
  const apiKey = options.visaApiKey
  const sharedSecret = options.visaSharedSecret

  if (!apiKey) {
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_NOT_CONFIGURED',
        message: 'Visa TAP API key is not configured.',
      },
    }
  }

  const attestation = extractAgentAttestation(request)

  try {
    const tokenStatus = await verifyVisaToken(apiUrl, apiKey, sharedSecret, token, logger)

    if (!tokenStatus.valid) {
      const errorCode: VisaTapErrorCode = tokenStatus.expired
        ? 'VISA_TAP_TOKEN_EXPIRED'
        : tokenStatus.revoked
          ? 'VISA_TAP_TOKEN_REVOKED'
          : 'VISA_TAP_TOKEN_INVALID'

      return {
        valid: false,
        tokenReferenceId: token,
        error: { code: errorCode, message: tokenStatus.error ?? 'Visa TAP token verification failed.' },
      }
    }

    if (
      tokenStatus.maxTransactionCents !== undefined &&
      tokenStatus.maxTransactionCents < toolConfig.costCents
    ) {
      return {
        valid: false,
        tokenReferenceId: token,
        error: {
          code: 'VISA_TAP_LIMIT_EXCEEDED',
          message: `Visa TAP token per-transaction limit is ${tokenStatus.maxTransactionCents} cents but tool costs ${toolConfig.costCents} cents.`,
        },
      }
    }

    if (
      tokenStatus.dailyLimitCents !== undefined &&
      tokenStatus.dailySpentCents !== undefined &&
      tokenStatus.dailySpentCents + toolConfig.costCents > tokenStatus.dailyLimitCents
    ) {
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

    const authResult = await authorizeVisaPayment(
      apiUrl,
      apiKey,
      sharedSecret,
      {
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
      },
      logger,
    )

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
    logger.error(
      'visa_tap.validation_error',
      { toolSlug: toolConfig.slug, token: token.slice(0, 12) + '...' },
      err,
    )
    return {
      valid: false,
      error: {
        code: 'VISA_TAP_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during Visa TAP payment validation.',
      },
    }
  }
}

export function generateVisaTap402Response(options: VisaTap402Options): Response {
  const { toolSlug, costCents, toolName, merchantId, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
