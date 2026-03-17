// /Users/lex/settlegrid/packages/mcp/src/payment-capability.ts

/**
 * MCP experimental.payment capability
 *
 * Defines the payment capability that MCP servers can declare and
 * clients can use to communicate billing context.
 *
 * Server declares: capabilities.experimental.payment = { ... }
 * Client sends: _meta["settlegrid-api-key"] in tool call
 * Server responds with: cost, remaining balance in _meta
 */

import type { GeneralizedPricingConfig } from './types'

/** Payment capability declaration (server -> client during initialization) */
export interface PaymentCapability {
  /** Billing provider identifier */
  provider: 'settlegrid'
  /** API version */
  version: '1.0'
  /** Pricing configuration */
  pricing: GeneralizedPricingConfig
  /** URL where consumers can purchase credits */
  topUpUrl: string
  /** URL for pricing details */
  pricingUrl?: string
  /** Accepted payment methods */
  acceptedPaymentMethods: Array<'credit-balance' | 'x402'>
}

/** Payment context in tool call _meta (client -> server) */
export interface PaymentMeta {
  /** Consumer's API key for billing */
  'settlegrid-api-key'?: string
  /** Workflow session ID for budget tracking */
  'settlegrid-session-id'?: string
  /** Maximum amount the client is willing to pay for this call */
  'settlegrid-max-cost-cents'?: number
}

/** Payment result in tool response _meta (server -> client) */
export interface PaymentResultMeta {
  /** Actual cost charged */
  'settlegrid-cost-cents': number
  /** Remaining balance after this call */
  'settlegrid-remaining-cents': number
  /** Whether this was a test/sandbox call */
  'settlegrid-test-mode'?: boolean
}

/** Standard MCP error codes for payment failures */
export const PAYMENT_ERROR_CODES = {
  INSUFFICIENT_CREDITS: -32001,
  PAYMENT_REQUIRED: -32002,
  BUDGET_EXCEEDED: -32003,
  INVALID_PAYMENT_KEY: -32004,
  PAYMENT_PROVIDER_ERROR: -32005,
} as const

/**
 * Create the payment capability object for MCP server initialization.
 *
 * @example
 * const server = new Server({
 *   capabilities: {
 *     experimental: {
 *       payment: createPaymentCapability({
 *         toolSlug: 'my-tool',
 *         pricing: { model: 'per-invocation', defaultCostCents: 5 },
 *       }),
 *     },
 *   },
 * })
 */
export function createPaymentCapability(options: {
  toolSlug: string
  pricing: GeneralizedPricingConfig
  topUpUrl?: string
  pricingUrl?: string
  acceptedPaymentMethods?: Array<'credit-balance' | 'x402'>
}): PaymentCapability {
  return {
    provider: 'settlegrid',
    version: '1.0',
    pricing: options.pricing,
    topUpUrl:
      options.topUpUrl ?? `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
    ...(options.pricingUrl ? { pricingUrl: options.pricingUrl } : {}),
    acceptedPaymentMethods: options.acceptedPaymentMethods ?? ['credit-balance'],
  }
}
