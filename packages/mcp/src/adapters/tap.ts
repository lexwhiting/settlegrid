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

import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { PaymentContext, ProtocolAdapter, SettlementResult } from './types'
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

  formatResponse(_result: SettlementResult, request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message:
            'Visa TAP integration is not yet available. Visa sandbox access is required. ' +
            'Please use SettleGrid balance or AP2 credentials instead.',
          protocol: 'visa-tap' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
          sandboxInfo: {
            status: 'pending',
            alternative: ['mcp', 'ap2'],
            documentation: 'https://developer.visa.com/capabilities/visa-token-service',
          },
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  formatError(error: Error, request: Request): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VISA_TAP_NOT_AVAILABLE',
          message: error.message || 'Visa TAP integration is not yet available.',
          protocol: 'visa-tap' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  /**
   * Build the `accepts[]` challenge entry for the Visa TAP rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateVisaTap402Response` in `apps/web/src/lib/visa-tap-proxy.ts`
   * (protocol + amount_cents + currency + accepted_tokens
   * ['visa_agent_token']). The real implementation is still blocked
   * on Visa sandbox access — today's stub carries the accepted-tokens
   * list so a client can recognize the rail and the token type it
   * would need to obtain out-of-band.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const costCents = resolveOperationCost(options.pricing, method)
    return {
      scheme: 'visa-tap',
      provider: 'visa',
      costCents,
      currency: 'USD',
      acceptedTokens: ['visa-agent-token'],
    }
  }
}
