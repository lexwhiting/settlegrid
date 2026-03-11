/**
 * @settlegrid/mcp - Configuration validation
 */

import { z } from 'zod'
import type { PricingConfig, SettleGridConfig } from './types'

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
