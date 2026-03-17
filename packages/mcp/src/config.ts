/**
 * @settlegrid/mcp - Configuration validation
 */

import { z } from 'zod'
import type { PricingConfig, SettleGridConfig, GeneralizedPricingConfig } from './types'

const DEFAULT_API_URL = 'https://settlegrid.ai'
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_TIMEOUT_MS = 5000

/** Zod schema for method pricing */
const methodPricingSchema = z.object({
  costCents: z.number().int().min(0),
  displayName: z.string().optional(),
})

/** Zod schema for pricing config */
export const pricingConfigSchema = z.object({
  defaultCostCents: z.number().int().min(0),
  methods: z.record(z.string(), methodPricingSchema).optional(),
})

/** Zod schema for SDK config */
const sdkConfigSchema = z.object({
  apiUrl: z.string().url().optional(),
  toolSlug: z.string().min(1).max(128),
  debug: z.boolean().optional(),
  cacheTtlMs: z.number().int().min(0).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
})

/** Validated and normalized SDK configuration */
export interface NormalizedConfig {
  apiUrl: string
  toolSlug: string
  debug: boolean
  cacheTtlMs: number
  timeoutMs: number
}

/** Validate and normalize SDK config */
export function normalizeConfig(config: SettleGridConfig): NormalizedConfig {
  const parsed = sdkConfigSchema.parse(config)
  return {
    apiUrl: (parsed.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, ''),
    toolSlug: parsed.toolSlug,
    debug: parsed.debug ?? false,
    cacheTtlMs: parsed.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    timeoutMs: parsed.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
}

/** Validate pricing config */
export function validatePricingConfig(config: unknown): PricingConfig {
  return pricingConfigSchema.parse(config)
}

/** Get cost for a specific method from pricing config */
export function getMethodCost(pricing: PricingConfig, method: string): number {
  if (pricing.methods && method in pricing.methods) {
    return pricing.methods[method].costCents
  }
  return pricing.defaultCostCents
}

// ─── Generalized Pricing ─────────────────────────────────────────────────────

/** Zod schema for generalized pricing config */
export const generalizedPricingConfigSchema = z.object({
  model: z.enum(['per-invocation', 'per-token', 'per-byte', 'per-second', 'tiered', 'outcome']),
  defaultCostCents: z.number().int().min(0),
  currencyCode: z.string().length(3).optional().default('USD'),
  methods: z.record(z.string(), z.object({
    costCents: z.number().int().min(0),
    unitType: z.string().optional(),
    displayName: z.string().optional(),
  })).optional(),
  tiers: z.array(z.object({
    upTo: z.number().int().min(1),
    costCents: z.number().int().min(0),
  })).optional(),
  outcomeConfig: z.object({
    successCostCents: z.number().int().min(0),
    failureCostCents: z.number().int().min(0),
    successCondition: z.string(),
  }).optional(),
})

/**
 * Resolve cost for an operation using the generalized pricing model.
 * Supports both legacy PricingConfig and new GeneralizedPricingConfig.
 *
 * @param pricing - Pricing configuration (legacy or generalized)
 * @param method - Method name within the service
 * @param units - Number of units consumed (tokens, bytes, seconds) for non-invocation models
 * @returns Cost in cents
 */
export function resolveOperationCost(
  pricing: GeneralizedPricingConfig | PricingConfig,
  method: string,
  units?: number
): number {
  // If legacy PricingConfig (no 'model' field), delegate to getMethodCost
  if (!('model' in pricing)) {
    return getMethodCost(pricing as PricingConfig, method)
  }

  const config = pricing as GeneralizedPricingConfig

  // Check method-specific pricing first
  if (config.methods && method in config.methods) {
    const methodPrice = config.methods[method].costCents
    if (config.model === 'per-invocation' || !units) return methodPrice
    return methodPrice * (units ?? 1)
  }

  switch (config.model) {
    case 'per-invocation':
      return config.defaultCostCents

    case 'per-token':
    case 'per-byte':
    case 'per-second':
      return config.defaultCostCents * (units ?? 1)

    case 'tiered': {
      if (!config.tiers || units == null) return config.defaultCostCents
      let totalCost = 0
      let remainingUnits = units
      for (const tier of config.tiers) {
        const tierUnits = Math.min(remainingUnits, tier.upTo)
        totalCost += tierUnits * tier.costCents
        remainingUnits -= tierUnits
        if (remainingUnits <= 0) break
      }
      // Remaining units beyond last tier use the last tier's price
      if (remainingUnits > 0 && config.tiers.length > 0) {
        totalCost += remainingUnits * config.tiers[config.tiers.length - 1].costCents
      }
      return totalCost
    }

    case 'outcome':
      // Outcome pricing resolved after execution; return success cost as pre-auth
      return config.outcomeConfig?.successCostCents ?? config.defaultCostCents

    default:
      return config.defaultCostCents
  }
}
