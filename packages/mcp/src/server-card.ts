// /Users/lex/settlegrid/packages/mcp/src/server-card.ts

/**
 * MCP Server Card pricing metadata
 *
 * Defines the billing section of .well-known/mcp-server that allows
 * clients and registries to discover pricing information for MCP servers.
 */

import type { GeneralizedPricingConfig } from './types'

/** Billing metadata for MCP Server Card */
export interface ServerCardBilling {
  /** Billing provider */
  provider: 'settlegrid'
  /** Provider API URL */
  providerUrl: string
  /** Pricing model */
  model: GeneralizedPricingConfig['model']
  /** Currency (ISO 4217) */
  currency: string
  /** Per-method pricing */
  methods?: Record<
    string,
    {
      costCents: number
      displayName?: string
      description?: string
    }
  >
  /** Default cost (for methods not listed) */
  defaultCostCents: number
  /** URL for purchasing credits */
  topUpUrl: string
  /** Free tier (if any) */
  freeTier?: {
    invocationsPerMonth: number
    description?: string
  }
}

/** Per-method pricing entry for Server Card */
export interface ServerCardPricingMethod {
  costCents: number
  displayName?: string
  description?: string
}

/** Full MCP Server Card with billing extension */
export interface MCPServerCard {
  /** Server name */
  name: string
  /** Server description */
  description: string
  /** Server version */
  version: string
  /** List of tools */
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>
  /** SettleGrid billing metadata */
  billing?: ServerCardBilling
}

/**
 * Generate the billing section for an MCP Server Card.
 *
 * @example
 * // In your .well-known/mcp-server route:
 * export function GET() {
 *   return Response.json({
 *     name: 'my-tool',
 *     description: 'A useful AI tool',
 *     version: '1.0.0',
 *     tools: [...],
 *     billing: generateServerCardBilling({
 *       toolSlug: 'my-tool',
 *       pricing: { model: 'per-invocation', defaultCostCents: 5 },
 *     }),
 *   })
 * }
 */
export function generateServerCardBilling(options: {
  toolSlug: string
  pricing: GeneralizedPricingConfig
  providerUrl?: string
  freeTier?: { invocationsPerMonth: number; description?: string }
}): ServerCardBilling {
  return {
    provider: 'settlegrid',
    providerUrl: options.providerUrl ?? 'https://settlegrid.ai',
    model: options.pricing.model,
    currency: options.pricing.currencyCode ?? 'USD',
    methods: options.pricing.methods
      ? Object.fromEntries(
          Object.entries(options.pricing.methods).map(([method, config]) => [
            method,
            {
              costCents: config.costCents,
              ...(config.displayName ? { displayName: config.displayName } : {}),
            },
          ])
        )
      : undefined,
    defaultCostCents: options.pricing.defaultCostCents,
    topUpUrl: `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
    freeTier: options.freeTier,
  }
}

/**
 * Generate a complete MCP Server Card JSON object.
 *
 * @example
 * export function GET() {
 *   return Response.json(generateServerCard({
 *     name: 'my-tool',
 *     description: 'A useful AI tool',
 *     version: '1.0.0',
 *     tools: [{ name: 'search', description: 'Search the web', inputSchema: {} }],
 *     toolSlug: 'my-tool',
 *     pricing: { model: 'per-invocation', defaultCostCents: 5 },
 *   }))
 * }
 */
export function generateServerCard(options: {
  name: string
  description: string
  version: string
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>
  toolSlug: string
  pricing: GeneralizedPricingConfig
  providerUrl?: string
  freeTier?: { invocationsPerMonth: number; description?: string }
}): MCPServerCard {
  return {
    name: options.name,
    description: options.description,
    version: options.version,
    tools: options.tools,
    billing: generateServerCardBilling({
      toolSlug: options.toolSlug,
      pricing: options.pricing,
      providerUrl: options.providerUrl,
      freeTier: options.freeTier,
    }),
  }
}
