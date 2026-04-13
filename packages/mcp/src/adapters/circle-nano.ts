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
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
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
