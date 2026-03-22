/**
 * MPP Protocol Adapter — Machine Payments Protocol (Stripe + Tempo)
 *
 * Extracts payment context from MPP protocol requests.
 * MPP launched March 18, 2026, enabling Stripe-powered card payments (SPT)
 * and Tempo blockchain crypto payments for machine-to-machine commerce.
 *
 * Detects requests via:
 *   1. x-mpp-credential header (MPP session credential)
 *   2. x-settlegrid-protocol: mpp header
 *   3. Authorization header containing MPP credential format (mpp_*)
 */

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
import { randomUUID } from 'crypto'

export class MPPAdapter implements ProtocolAdapter {
  readonly name = 'mpp' as const
  readonly displayName = 'Machine Payments Protocol (Stripe + Tempo)'

  /**
   * Detect if this request is an MPP payment.
   * MPP requests have:
   *   - x-mpp-credential header (MPP session credential)
   *   - OR x-settlegrid-protocol: mpp
   *   - OR Authorization: Bearer mpp_* token
   */
  canHandle(request: Request): boolean {
    const hasMppCredential = request.headers.get('x-mpp-credential') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'mpp'
    const hasAuthMpp = request.headers.get('authorization')?.includes('mpp_') === true
    return hasMppCredential || hasProtocolHeader || hasAuthMpp
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const credential =
      request.headers.get('x-mpp-credential') ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      null

    if (!credential) {
      throw new Error('No MPP credential found in request')
    }

    // Determine payment type from the credential or body
    let paymentType: 'spt' | 'crypto' = 'spt'
    let method = 'payment'
    let service = 'mpp-session'
    let sessionId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      // MPP uses paymentType field to distinguish Stripe SPT vs Tempo crypto
      if (body?.paymentType === 'crypto' || body?.paymentType === 'tempo') {
        paymentType = 'crypto'
      }
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.sessionId) sessionId = String(body.sessionId)
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'mpp',
      identity: {
        type: 'mpp-session',
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
}
