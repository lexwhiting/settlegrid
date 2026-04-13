/**
 * ACP Protocol Adapter — Agentic Commerce Protocol (OpenAI + Stripe)
 *
 * Extracts payment context from ACP checkout requests.
 * ACP handles checkout in ChatGPT via Stripe Shared Payment Tokens (SPTs).
 * Stripe-locked in v1.
 *
 * Detects requests via:
 *   1. x-acp-token header (ACP checkout token)
 *   2. x-settlegrid-protocol: acp header
 */

import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
import { randomUUID } from 'crypto'

export class ACPAdapter implements ProtocolAdapter {
  readonly name = 'acp' as const
  readonly displayName = 'Agentic Commerce Protocol (OpenAI + Stripe)'

  /**
   * Detect if this request is an ACP checkout.
   * ACP requests have:
   *   - x-acp-token header (ACP checkout token)
   *   - OR x-settlegrid-protocol: acp
   */
  canHandle(request: Request): boolean {
    const hasAcpToken = request.headers.get('x-acp-token') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'acp'
    return hasAcpToken || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const acpToken = request.headers.get('x-acp-token') ?? ''
    let method = 'checkout'
    let service = 'acp-checkout'
    let checkoutId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.checkoutId) checkoutId = String(body.checkoutId)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'acp',
      identity: {
        type: 'spt',
        value: acpToken || 'anonymous',
        metadata: { checkoutId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'spt',
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'acp',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        checkoutId: result.operationId,
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
    const isCheckoutError =
      error.message.includes('checkout') ||
      error.message.includes('session') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isCheckoutError) {
      status = 401
      code = 'ACP_CHECKOUT_ERROR'
    } else if (isPaymentError) {
      status = 402
      code = 'ACP_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'ACP_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'acp' as const,
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
   * Build the `accepts[]` challenge entry for the ACP (Agentic
   * Commerce Protocol) rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateAcp402Response` in `apps/web/src/lib/acp-proxy.ts`
   * (protocol + amount_cents + currency + checkout.url + recipient).
   * A future pass will replace this with the Stripe SPT checkout-
   * specific entry (OpenAI ChatGPT connector, merchant callback URL,
   * SPT issuer config) — today's stub carries provider + currency.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const costCents = resolveOperationCost(options.pricing, method)
    return {
      scheme: 'acp',
      provider: 'openai-stripe',
      costCents,
      currency: 'USD',
    }
  }
}
