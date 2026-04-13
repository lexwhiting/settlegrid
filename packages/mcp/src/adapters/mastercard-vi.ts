/**
 * Mastercard Verifiable Intent Adapter — Mastercard Agent Pay
 *
 * Extracts payment context from Mastercard Agent Pay requests using
 * SD-JWT selective disclosure with ES256 signatures.
 * Three-layer delegation chain: Credential Provider -> User -> Agent.
 *
 * Detects requests via:
 *   1. x-mc-verifiable-intent header (SD-JWT credential chain)
 *   2. x-settlegrid-protocol: mastercard-vi header
 */

import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
import { randomUUID } from 'crypto'

export class MastercardVIAdapter implements ProtocolAdapter {
  readonly name = 'mastercard-vi' as const
  readonly displayName = 'Mastercard Agent Pay (Verifiable Intent)'

  /**
   * Detect if this request is a Mastercard Verifiable Intent payment.
   * MC VI requests have:
   *   - x-mc-verifiable-intent header (SD-JWT credential chain)
   *   - OR x-settlegrid-protocol: mastercard-vi
   */
  canHandle(request: Request): boolean {
    const hasIntentHeader = request.headers.get('x-mc-verifiable-intent') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'mastercard-vi'
    return hasIntentHeader || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const intentHeader = request.headers.get('x-mc-verifiable-intent') ?? ''
    let method = 'payment'
    let service = 'mastercard-agent-pay'
    let intentId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.intentId) intentId = String(body.intentId)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'mastercard-vi',
      identity: {
        type: 'sd-jwt',
        value: intentHeader || 'unknown',
        metadata: { intentId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'agentic-token',
        proof: intentHeader || undefined,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'mastercard-vi',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        intentId: result.operationId,
        verified: result.status === 'settled',
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
    const isIntentError =
      error.message.includes('intent') ||
      error.message.includes('credential') ||
      error.message.includes('expired') ||
      error.message.includes('invalid') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isIntentError) {
      status = 401
      code = 'MC_VI_INVALID_INTENT'
    } else if (isPaymentError) {
      status = 402
      code = 'MC_VI_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'MC_VI_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mastercard-vi' as const,
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
   * Build the `accepts[]` challenge entry for the Mastercard
   * Verifiable Intent rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateMastercard402Response` in
   * `apps/web/src/lib/mastercard-proxy.ts` (protocol + amount_cents +
   * currency + accepted_credentials + credential_requirements).
   * A future pass will replace this with the full SD-JWT credential
   * chain challenge (ES256 issuer key, three-layer delegation chain,
   * Mastercard Agent Pay endpoint) — today's stub carries the
   * accepted_credentials list so a client can recognize the rail.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const costCents = resolveOperationCost(options.pricing, method)
    return {
      scheme: 'mastercard-vi',
      provider: 'mastercard',
      costCents,
      currency: 'USD',
      acceptedCredentials: ['sd-jwt-verifiable-intent'],
    }
  }
}
