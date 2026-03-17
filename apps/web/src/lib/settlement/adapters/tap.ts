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

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
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

  formatResponse(_result: SettlementResult, _request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message:
            'Visa TAP integration is not yet available. Visa sandbox access is required. ' +
            'Please use SettleGrid balance or AP2 credentials instead.',
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  formatError(error: Error, _request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message: error.message || 'Visa TAP integration is not yet available.',
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
