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

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
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
      status = 400
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
}
