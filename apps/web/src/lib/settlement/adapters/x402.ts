/**
 * x402 Protocol Adapter
 *
 * Extracts payment context from x402 protocol requests (Coinbase).
 * Detects requests via:
 *   1. PAYMENT-SIGNATURE header (base64-encoded payment payload)
 *   2. x-settlegrid-protocol: x402 header
 */

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
import { randomUUID } from 'crypto'

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

  formatError(error: Error, _request: Request): Response {
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
        },
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
