/**
 * AP2 Protocol Adapter
 *
 * Extracts payment context from AP2 protocol requests (Google Agentic Payments).
 * Detects requests via:
 *   1. x-settlegrid-protocol: ap2 header
 *   2. AP2 mandate body with type field matching ap2.mandates.*
 */

import type { ProtocolAdapter, PaymentContext, SettlementResult } from './types'
import { randomUUID } from 'crypto'

export class AP2Adapter implements ProtocolAdapter {
  readonly name = 'ap2' as const
  readonly displayName = 'AP2 Protocol (Google Agentic Payments)'

  /**
   * Detect if this request is an AP2 payment.
   * AP2 requests have:
   *   - x-settlegrid-protocol: ap2
   *   - OR x-ap2-mandate header
   */
  canHandle(request: Request): boolean {
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'ap2'
    const hasAp2Mandate = request.headers.get('x-ap2-mandate') !== null
    return hasProtocolHeader || hasAp2Mandate
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    // Try to parse mandate from body
    let mandateType = 'unknown'
    let consumerId = ''
    let method = 'default'
    const service = 'ap2-credentials-provider'
    let proof: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      // AP2 skill request format
      if (body?.skill) {
        method = String(body.skill)
      }

      // Extract consumer ID from params
      if (body?.params?.consumerId) {
        consumerId = String(body.params.consumerId)
      }

      // Extract mandate type if present
      if (body?.params?.mandate?.type) {
        mandateType = String(body.params.mandate.type)
      }

      // Extract VDC or mandate ref as proof
      if (body?.mandateRef) {
        proof = String(body.mandateRef)
      }
    } catch {
      // Body may not be JSON
    }

    // Determine payment type from mandate
    const paymentType = mandateType.includes('Payment') ? 'vdc' as const : 'credit-balance' as const

    return {
      protocol: 'ap2',
      identity: {
        type: 'jwt',
        value: consumerId || request.headers.get('x-ap2-consumer-id') || 'anonymous',
        metadata: { mandateType },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: paymentType,
        proof,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'ap2',
    }

    if (result.receipt) {
      headers['X-SettleGrid-VDC'] = result.receipt
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        remainingBalanceCents: result.remainingBalanceCents ?? null,
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
      error.message.includes('mandate') ||
      error.message.includes('credential') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const status = isPaymentError ? 402 : 500
    const code = isPaymentError ? 'AP2_PAYMENT_ERROR' : 'SERVER_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'ap2' as const,
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
}
