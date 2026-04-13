/**
 * x402 Protocol Adapter
 *
 * Extracts payment context from x402 protocol requests (Coinbase).
 * Detects requests via:
 *   1. PAYMENT-SIGNATURE header (base64-encoded payment payload)
 *   2. x-settlegrid-protocol: x402 header
 */

import type {
  AcceptEntry,
  PaymentRequiredOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
import { randomUUID } from 'crypto'

/**
 * Default x402 network identifier — `eip155:8453` is Base mainnet,
 * the most common USDC x402 deployment target. P1.K4 will make this
 * configurable per-tool.
 */
const DEFAULT_X402_NETWORK = 'eip155:8453'

/** Base-mainnet USDC contract address, used by the P1.K3 stub. */
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/**
 * Zero-address placeholder for the x402 `payTo` field. P1.K4 will
 * read the tool's real payout address from config.
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * USDC has 6 decimal places of precision, so one USD cent is 10_000
 * base units. Used to convert `costCents` (integer cents) into the
 * `amount` string (base units of USDC).
 */
const USDC_BASE_UNITS_PER_CENT = 10_000n

/**
 * Maximum time an x402 payment authorization is valid for. Matches the
 * 300-second default used by the existing `apps/web/src/lib/x402-proxy.ts`
 * `generateX402_402Response` implementation.
 */
const X402_MAX_TIMEOUT_SECONDS = 300

export class X402Adapter implements ProtocolAdapter {
  readonly name = 'x402' as const
  readonly displayName = 'x402 Protocol (Coinbase)'

  /**
   * Detect if this request is an x402 payment.
   * x402 requests have:
   *   - A PAYMENT-SIGNATURE header (base64-encoded payment proof)
   *   - OR x-settlegrid-protocol: x402
   */
  canHandle(request: Request): boolean {
    const hasPaymentSig = request.headers.get('payment-signature') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'x402'
    return hasPaymentSig || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const paymentSigHeader = request.headers.get('payment-signature')

    if (!paymentSigHeader) {
      throw new Error('Missing PAYMENT-SIGNATURE header for x402 request')
    }

    // Decode the base64 payment payload
    let payload: {
      scheme?: string
      network?: string
      payload?: {
        authorization?: { from?: string }
        witness?: { recipient?: string }
      }
    }

    try {
      const decoded = Buffer.from(paymentSigHeader, 'base64').toString('utf-8')
      payload = JSON.parse(decoded)
    } catch {
      throw new Error('Invalid base64 in PAYMENT-SIGNATURE header')
    }

    const scheme = payload.scheme ?? 'exact'
    const network = payload.network ?? 'eip155:8453'

    // Extract payer from the payload based on scheme
    let payerAddress = ''
    if (scheme === 'exact' && payload.payload?.authorization?.from) {
      payerAddress = payload.payload.authorization.from
    } else if (scheme === 'upto' && payload.payload?.witness?.recipient) {
      payerAddress = payload.payload.witness.recipient
    }

    // Determine payment type based on scheme
    const paymentType = scheme === 'upto' ? 'permit2' as const : 'eip3009' as const

    return {
      protocol: 'x402',
      identity: {
        type: 'did:key',
        value: payerAddress || `x402:${network}`,
      },
      operation: {
        service: 'x402-facilitator',
        method: scheme === 'exact' ? 'transferWithAuthorization' : 'permitWitnessTransferFrom',
      },
      payment: {
        type: paymentType,
        proof: paymentSigHeader,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        txHash: result.txHash ?? null,
        operationId: result.operationId,
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
      error.message.includes('PAYMENT') ||
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const status = isPaymentError ? 402 : 500
    const code = isPaymentError ? 'PAYMENT_REQUIRED' : 'SERVER_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'x402' as const,
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
   * Build the `accepts[]` entry for the x402 exact scheme. P1.K3
   * stub — hardcoded network / USDC address / zero payTo. P1.K4 will
   * read these from tool-owned config (network, asset, payTo address).
   * Field order deliberately matches the spec example and the existing
   * canonical `generateX402_402Response` in
   * `apps/web/src/lib/x402-proxy.ts`:
   * `{ scheme, network, amount, asset, payTo, maxTimeoutSeconds }`.
   */
  toAcceptEntry(options: PaymentRequiredOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    // Defensive clamp before BigInt() conversion (hostile-review M2/M3):
    //   - BigInt(NaN) / BigInt(Infinity) / BigInt(1.5) all throw RangeError
    //   - BigInt(-5) succeeds but produces a negative `amount` string,
    //     which is nonsense for a 402 manifest (the client cannot be
    //     asked to pay a negative sum)
    //   - Tiered pricing with fractional `units` can surface a non-integer
    //     rawCost; upstream `validatePricingConfig` guarantees the
    //     per-tier costCents are integers but the total is a sum of
    //     products that can be fractional
    // Math.floor handles the fractional case, the finite+>=0 guard
    // handles the NaN/Infinity/negative cases, and 0 is the safe
    // default for malformed input.
    const safeCost =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    const amountBaseUnits = BigInt(safeCost) * USDC_BASE_UNITS_PER_CENT
    return {
      scheme: 'exact',
      network: DEFAULT_X402_NETWORK,
      amount: amountBaseUnits.toString(),
      asset: BASE_USDC_ADDRESS,
      payTo: ZERO_ADDRESS,
      maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    }
  }
}
