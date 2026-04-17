/**
 * Circle Nanopayments Adapter
 *
 * Extracts payment context from Circle Nanopayment requests.
 * Gas-free micropayments as small as $0.000001 using USDC.
 * Off-chain immediate confirmation with periodic on-chain batch settlement.
 * x402-compatible.
 *
 * Detects requests via:
 *   1. x-circle-nano-auth header (EIP-3009 authorization)
 *   2. x-settlegrid-protocol: circle-nano header
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

export class CircleNanoAdapter implements ProtocolAdapter {
  readonly name = 'circle-nano' as const
  readonly displayName = 'Circle Nanopayments (USDC)'

  /**
   * Detect if this request is a Circle Nanopayment.
   * Circle Nano requests have:
   *   - x-circle-nano-auth header (EIP-3009 transferWithAuthorization)
   *   - OR x-settlegrid-protocol: circle-nano
   */
  canHandle(request: Request): boolean {
    const hasNanoAuth = request.headers.get('x-circle-nano-auth') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'circle-nano'
    return hasNanoAuth || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const authHeader = request.headers.get('x-circle-nano-auth')

    if (!authHeader) {
      throw new Error('Missing x-circle-nano-auth header for Circle Nanopayment request')
    }

    // Parse the EIP-3009 authorization payload
    let fromAddress = ''
    let amount: bigint | undefined
    let authorizationId: string | undefined
    let method = 'nanopayment'
    let service = 'circle-nano'

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.from) fromAddress = String(body.from)
      if (body?.amount) amount = BigInt(body.amount)
      if (body?.authorizationId) authorizationId = String(body.authorizationId)
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'circle-nano',
      identity: {
        type: 'eip3009',
        value: fromAddress || authHeader,
        metadata: { authorizationId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'nanopayment',
        proof: authHeader,
        ...(amount != null
          ? { amount: { value: amount, currency: 'USDC' } }
          : {}),
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'circle-nano',
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled' || result.status === 'pending',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        batchId: result.txHash ?? null,
        settlementStatus: result.status === 'settled' ? 'on-chain' : 'off-chain-confirmed',
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
    const isAuthError =
      error.message.includes('auth') ||
      error.message.includes('invalid') ||
      error.message.includes('expired') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('funds')

    let status: number
    let code: string

    if (isAuthError) {
      status = 401
      code = 'NANO_AUTH_INVALID'
    } else if (isPaymentError) {
      status = 402
      code = 'NANO_INSUFFICIENT_FUNDS'
    } else {
      status = 500
      code = 'NANO_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'circle-nano' as const,
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
   * Build the `accepts[]` challenge entry for the Circle Nanopayments
   * rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateCircleNano402Response` in
   * `apps/web/src/lib/circle-nano-proxy.ts`: protocol + amount_cents
   * + amount_usdc_base_units + currency 'usdc' + accepted_payments
   * ['eip3009-nanopayment']. The amount is converted from cents to
   * USDC 6-decimal base units (same conversion x402 uses) with the
   * same defensive clamp so malformed pricing (NaN / Infinity / float
   * / negative) produces `'0'` instead of a RangeError from BigInt().
   *
   * A future pass will replace this with the full Circle Nano
   * x402-compatible entry (off-chain batch config, max nano amount,
   * Circle API endpoint, settlement window).
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const safeCost =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    // 1 cent = 10_000 base units of USDC (6 decimals).
    const USDC_BASE_UNITS_PER_CENT = 10_000n
    const amountBaseUnits = BigInt(safeCost) * USDC_BASE_UNITS_PER_CENT
    return {
      scheme: 'circle-nano',
      provider: 'circle',
      costCents: safeCost,
      currency: 'USDC',
      amountUsdcBaseUnits: amountBaseUnits.toString(),
      acceptedPayments: ['eip3009-nanopayment'],
    }
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const CIRCLE_NANO_PROTOCOL_VERSION = '1.0'

const CIRCLE_NANO_HTTP_HEADERS = {
  AUTH: 'x-circle-nano-auth',
  WALLET: 'x-circle-nano-wallet',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface CircleNanoPaymentResult {
  valid: boolean
  confirmationId?: string
  payerAddress?: string
  amountUsdc?: string
  error?: { code: CircleNanoErrorCode; message: string }
}

export type CircleNanoErrorCode =
  | 'CIRCLE_NANO_NOT_CONFIGURED'
  | 'CIRCLE_NANO_AUTH_MISSING'
  | 'CIRCLE_NANO_AUTH_INVALID'
  | 'CIRCLE_NANO_INSUFFICIENT_FUNDS'
  | 'CIRCLE_NANO_API_ERROR'

export interface CircleNanoToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface CircleNanoValidateOptions {
  enabled: boolean
  toolConfig: CircleNanoToolConfig
  logger?: AdapterLogger
}

export interface CircleNano402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
}

export function isCircleNanoRequest(request: Request): boolean {
  if (request.headers.get(CIRCLE_NANO_HTTP_HEADERS.AUTH)) return true
  if (request.headers.get(CIRCLE_NANO_HTTP_HEADERS.PROTOCOL) === 'circle-nano') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('cnano_')) return true
  }

  return false
}

export async function validateCircleNanoPayment(
  request: Request,
  options: CircleNanoValidateOptions,
): Promise<CircleNanoPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NOT_CONFIGURED',
        message: 'Circle Nanopayments are not configured on this SettleGrid instance.',
      },
    }
  }

  const authHeader = request.headers.get(CIRCLE_NANO_HTTP_HEADERS.AUTH)
  if (!authHeader) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_MISSING',
        message:
          'No Circle Nanopayment authorization found in request. Provide x-circle-nano-auth header with an EIP-3009 authorization.',
      },
    }
  }

  const walletAddress = request.headers.get(CIRCLE_NANO_HTTP_HEADERS.WALLET) ?? undefined

  try {
    // TODO: Verify EIP-3009 authorization payload
    // TODO: Submit to Circle Nanopayments API for off-chain confirmation
    const confirmationId = randomUUID()

    logger.info('circle_nano.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      walletAddress,
      confirmationId,
      note: 'Circle Nano validation is stub; accepted based on structural validation.',
    })

    return {
      valid: true,
      confirmationId,
      payerAddress: walletAddress,
    }
  } catch (err) {
    logger.error('circle_nano.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_API_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected error during Circle Nanopayment validation.',
      },
    }
  }
}

export function generateCircleNano402Response(options: CircleNano402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  const amountBaseUnits = String(costCents * 10_000)

  const body = {
    error: 'payment_required',
    protocol: 'circle-nano',
    version: CIRCLE_NANO_PROTOCOL_VERSION,
    amount_cents: costCents,
    amount_usdc_base_units: amountBaseUnits,
    currency: 'usdc',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['eip3009-nanopayment'],
    settlement: {
      type: 'off-chain-immediate',
      batch_settlement: 'periodic-on-chain',
      network: 'eip155:8453',
      asset: 'USDC',
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, create an EIP-3009 transferWithAuthorization for at least ${amountBaseUnits} USDC base units, then re-send the request with x-circle-nano-auth header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'circle-nano',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
