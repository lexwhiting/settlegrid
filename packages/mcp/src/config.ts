/**
 * @settlegrid/mcp - Configuration validation
 *
 * Handles validation and normalization of SDK configuration using Zod schemas.
 * All public functions throw descriptive errors when given invalid input.
 *
 * @packageDocumentation
 */

import { z } from 'zod'
import type { PricingConfig, SettleGridConfig, GeneralizedPricingConfig } from './types'

const DEFAULT_API_URL = 'https://settlegrid.ai'
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_TIMEOUT_MS = 5000

/** Zod schema for method pricing (legacy shape: costCents + displayName) */
const methodPricingSchema = z.object({
  costCents: z.number().int().min(0),
  displayName: z.string().optional(),
})

/**
 * Zod schema for method pricing with the generalized `unitType` field.
 * Accepts legacy `{ costCents, displayName }` as a strict subset.
 */
const generalizedMethodPricingSchema = z.object({
  costCents: z.number().int().min(0),
  unitType: z.string().optional(),
  displayName: z.string().optional(),
})

/**
 * Zod schema for pricing config validation.
 * Accepts both the legacy `PricingConfig` shape AND the generalized
 * `GeneralizedPricingConfig` shape (with optional `model` discriminator,
 * `currencyCode`, `tiers`, `outcomeConfig`). Legacy configs still parse
 * without the generalized fields; new configs with `model: 'per-token'`
 * or similar are preserved through the parse and passed to
 * `resolveOperationCost`.
 *
 * Exported for advanced users who want to pre-validate pricing config.
 */
export const pricingConfigSchema = z.object({
  defaultCostCents: z.number().int().min(0),
  methods: z.record(z.string(), generalizedMethodPricingSchema).optional(),
  model: z
    .enum(['per-invocation', 'per-token', 'per-byte', 'per-second', 'tiered', 'outcome'])
    .optional(),
  currencyCode: z.string().length(3).optional(),
  tiers: z
    .array(
      z.object({
        upTo: z.number().int().min(1),
        costCents: z.number().int().min(0),
      }),
    )
    .optional(),
  outcomeConfig: z
    .object({
      successCostCents: z.number().int().min(0),
      failureCostCents: z.number().int().min(0),
      successCondition: z.string(),
    })
    .optional(),
})

/** Zod schema for SDK config */
const sdkConfigSchema = z.object({
  apiUrl: z.string().url().optional(),
  toolSlug: z.string().min(1).max(128),
  debug: z.boolean().optional(),
  cacheTtlMs: z.number().int().min(0).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
})

/**
 * Validated and normalized SDK configuration with all defaults applied.
 * Produced by {@link normalizeConfig}.
 */
export interface NormalizedConfig {
  /** SettleGrid API base URL (trailing slash stripped) */
  apiUrl: string
  /** Tool slug identifier */
  toolSlug: string
  /** Whether debug mode is enabled */
  debug: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs: number
  /** Request timeout in milliseconds */
  timeoutMs: number
}

/**
 * Validate and normalize SDK configuration, applying defaults for optional fields.
 *
 * @param config - Raw SDK configuration from the developer
 * @returns Fully resolved configuration with all defaults applied
 * @throws {z.ZodError} If config is invalid (empty toolSlug, invalid URL, timeout out of range, etc.)
 *
 * @example
 * ```typescript
 * const normalized = normalizeConfig({
 *   toolSlug: 'my-tool',
 *   timeoutMs: 10000,
 * })
 * // normalized.apiUrl === 'https://settlegrid.ai'
 * // normalized.debug === false
 * // normalized.cacheTtlMs === 300000
 * ```
 */
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

/**
 * Validate a pricing configuration object using the Zod schema.
 *
 * Accepts both legacy `PricingConfig` and the generalized six-model
 * shape. The `model` field, when present, is preserved so downstream
 * callers (e.g. `resolveOperationCost`) can dispatch on it.
 *
 * @param config - Pricing config to validate (usually from developer input)
 * @returns Validated pricing config — legacy or generalized
 * @throws {z.ZodError} If pricing is invalid (negative costs, non-integer costs, unknown model, etc.)
 *
 * @example
 * ```typescript
 * // Legacy per-invocation config
 * const legacy = validatePricingConfig({
 *   defaultCostCents: 1,
 *   methods: { search: { costCents: 5 } },
 * })
 *
 * // Generalized per-token config
 * const perToken = validatePricingConfig({
 *   model: 'per-token',
 *   defaultCostCents: 1,
 * })
 * ```
 */
export function validatePricingConfig(
  config: unknown,
): PricingConfig | GeneralizedPricingConfig {
  const parsed = pricingConfigSchema.parse(config)
  // If `model` is absent, it's legacy PricingConfig; otherwise generalized.
  // Zod returns the same object shape either way — we just cast for the
  // return type so TypeScript knows which variant callers get.
  if (parsed.model === undefined) {
    return {
      defaultCostCents: parsed.defaultCostCents,
      methods: parsed.methods,
    } as PricingConfig
  }
  return parsed as unknown as GeneralizedPricingConfig
}

/**
 * Get the cost in cents for a specific method from a pricing configuration.
 * Falls back to `defaultCostCents` if the method has no explicit pricing.
 *
 * @param pricing - Pricing configuration to look up
 * @param method - Method name to get pricing for
 * @returns Cost in cents for invoking the given method
 *
 * @example
 * ```typescript
 * const cost = getMethodCost(pricing, 'search')
 * // Returns method-specific cost, or defaultCostCents if 'search' is not configured
 * ```
 */
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
