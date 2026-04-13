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
  PaymentRequiredOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
import { randomUUID } from 'crypto'

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
   * Build the `accepts[]` entry for the MPP rail. P1.K3 stub —
   * hardcoded Stripe provider and USD currency. P1.K4 will let the
   * tool choose between Stripe and Tempo, and pick a currency.
   */
  toAcceptEntry(options: PaymentRequiredOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const costCents = resolveOperationCost(options.pricing, method)
    return {
      scheme: 'mpp',
      provider: 'stripe',
      amountCents: costCents,
      currency: 'USD',
    }
  }
}
