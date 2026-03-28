/**
 * Pricing Extraction Utilities for SettleGrid Cost-Based Routing
 *
 * Extracts the effective per-call cost from a tool's pricingConfig across
 * all 6 supported pricing models. This is the core logic that enables
 * cost-based routing — SettleGrid's unique moat.
 *
 * Also provides getSuggestedPricing() for auto-pricing from category benchmarks.
 */

import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'

interface PricingConfigShape {
  model?: string
  defaultCostCents?: number
  costPerToken?: number
  costPerMB?: number
  costPerSecond?: number
  methods?: Record<string, { costCents: number }>
  tiers?: Array<{ upTo: number; costCents: number }>
  outcomeConfig?: {
    successCostCents: number
    failureCostCents?: number
  }
}

/**
 * Extract the effective per-call cost from a tool's pricingConfig.
 * Returns cents or null if pricing can't be determined.
 *
 * Handles all 6 pricing models:
 * - per-invocation: returns defaultCostCents directly
 * - per-token: returns null (variable cost depends on input size)
 * - per-byte: returns null (variable cost depends on data size)
 * - per-second: returns null (variable cost depends on compute time)
 * - tiered: returns the lowest method cost (best-case for the caller)
 * - outcome: returns successCostCents (pay-on-success model)
 */
export function getEffectiveCostCents(pricingConfig: unknown): number | null {
  if (!pricingConfig || typeof pricingConfig !== 'object') {
    return null
  }

  const config = pricingConfig as PricingConfigShape

  if (!config.model || typeof config.model !== 'string') {
    // Fall back to defaultCostCents if present
    if (
      typeof config.defaultCostCents === 'number' &&
      Number.isFinite(config.defaultCostCents) &&
      config.defaultCostCents >= 0
    ) {
      return config.defaultCostCents
    }
    return null
  }

  switch (config.model) {
    case 'per-invocation': {
      const cost = config.defaultCostCents
      if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
        return cost
      }
      return null
    }

    case 'per-token':
      // Variable cost — depends on token count per request
      return null

    case 'per-byte':
      // Variable cost — depends on data transfer size
      return null

    case 'per-second':
      // Variable cost — depends on compute duration
      return null

    case 'tiered': {
      // Return the lowest method cost across all methods
      if (!config.methods || typeof config.methods !== 'object') {
        return null
      }
      const entries = Object.values(config.methods)
      if (entries.length === 0) {
        return null
      }
      let lowestCost: number | null = null
      for (const entry of entries) {
        if (
          entry &&
          typeof entry.costCents === 'number' &&
          Number.isFinite(entry.costCents) &&
          entry.costCents >= 0
        ) {
          if (lowestCost === null || entry.costCents < lowestCost) {
            lowestCost = entry.costCents
          }
        }
      }
      return lowestCost
    }

    case 'outcome': {
      const successCost = config.outcomeConfig?.successCostCents
      if (typeof successCost === 'number' && Number.isFinite(successCost) && successCost >= 0) {
        return successCost
      }
      return null
    }

    default: {
      // Unknown model — try defaultCostCents as fallback
      const cost = config.defaultCostCents
      if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
        return cost
      }
      return null
    }
  }
}

// ─── Auto-Pricing from Category Benchmarks ────────────────────────────────────

/** Default pricing when no category data is available */
const DEFAULT_SUGGESTED_CENTS = 5

/**
 * Queries the tools table for all active tools in the given category,
 * computes pricing percentiles, and returns the median as the suggestion.
 *
 * Used by the auto-detect API to provide "Tools in this category charge $X-$Y/call"
 * context to developers during onboarding.
 */
export async function getSuggestedPricing(category: string): Promise<{
  suggestedCents: number
  p25Cents: number
  p75Cents: number
  toolCount: number
}> {
  // Fetch all active tools in this category with their pricing configs
  const categoryTools = await db
    .select({
      pricingConfig: tools.pricingConfig,
    })
    .from(tools)
    .where(and(eq(tools.category, category), eq(tools.status, 'active')))
    .limit(1000)

  // Extract effective costs from each tool
  const costs: number[] = []
  for (const t of categoryTools) {
    const cost = getEffectiveCostCents(t.pricingConfig)
    if (cost !== null && cost > 0 && Number.isFinite(cost)) {
      costs.push(cost)
    }
  }

  if (costs.length === 0) {
    return {
      suggestedCents: DEFAULT_SUGGESTED_CENTS,
      p25Cents: DEFAULT_SUGGESTED_CENTS,
      p75Cents: DEFAULT_SUGGESTED_CENTS,
      toolCount: 0,
    }
  }

  // Sort for percentile calculations
  costs.sort((a, b) => a - b)

  const p25Index = Math.floor(costs.length * 0.25)
  const p50Index = Math.floor(costs.length * 0.5)
  const p75Index = Math.floor(costs.length * 0.75)

  const p25Cents = costs[p25Index]
  const medianCents = costs[p50Index]
  const p75Cents = costs[p75Index]

  return {
    suggestedCents: medianCents,
    p25Cents,
    p75Cents,
    toolCount: costs.length,
  }
}
