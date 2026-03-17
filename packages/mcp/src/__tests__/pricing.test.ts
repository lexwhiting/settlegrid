import { describe, it, expect } from 'vitest'
import { resolveOperationCost, generalizedPricingConfigSchema } from '../config'
import type { GeneralizedPricingConfig, PricingConfig } from '../types'

describe('resolveOperationCost', () => {
  it('per-invocation returns defaultCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 5,
    }
    expect(resolveOperationCost(pricing, 'any-method')).toBe(5)
  })

  it('per-invocation with method override', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 5,
      methods: { search: { costCents: 10 } },
    }
    expect(resolveOperationCost(pricing, 'search')).toBe(10)
    expect(resolveOperationCost(pricing, 'other')).toBe(5)
  })

  it('per-token multiplies by units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
    }
    expect(resolveOperationCost(pricing, 'generate', 100)).toBe(100)
  })

  it('per-byte multiplies by units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-byte',
      defaultCostCents: 2,
    }
    expect(resolveOperationCost(pricing, 'download', 50)).toBe(100)
  })

  it('per-second multiplies by units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-second',
      defaultCostCents: 3,
    }
    expect(resolveOperationCost(pricing, 'compute', 10)).toBe(30)
  })

  it('tiered pricing with 2 tiers', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [
        { upTo: 100, costCents: 2 },
        { upTo: 900, costCents: 1 },
      ],
    }
    // 100 units at 2¢ + 50 units at 1¢ = 250
    expect(resolveOperationCost(pricing, 'api', 150)).toBe(250)
  })

  it('tiered pricing with units exceeding all tiers', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [
        { upTo: 100, costCents: 3 },
        { upTo: 200, costCents: 2 },
      ],
    }
    // 100 at 3¢ + 200 at 2¢ + 200 overflow at 2¢ (last tier price) = 300 + 400 + 400 = 1100
    expect(resolveOperationCost(pricing, 'api', 500)).toBe(1100)
  })

  it('tiered pricing with 0 units returns 0', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 5,
      tiers: [{ upTo: 100, costCents: 2 }],
    }
    expect(resolveOperationCost(pricing, 'api', 0)).toBe(0)
  })

  it('outcome returns successCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'outcome',
      defaultCostCents: 10,
      outcomeConfig: {
        successCostCents: 50,
        failureCostCents: 0,
        successCondition: 'result.success === true',
      },
    }
    expect(resolveOperationCost(pricing, 'classify')).toBe(50)
  })

  it('outcome falls back to defaultCostCents without config', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'outcome',
      defaultCostCents: 10,
    }
    expect(resolveOperationCost(pricing, 'classify')).toBe(10)
  })

  it('legacy PricingConfig format still works', () => {
    const pricing: PricingConfig = {
      defaultCostCents: 5,
      methods: { search: { costCents: 15 } },
    }
    expect(resolveOperationCost(pricing, 'search')).toBe(15)
    expect(resolveOperationCost(pricing, 'other')).toBe(5)
  })

  it('method override takes precedence in per-token model', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
      methods: { embed: { costCents: 5 } },
    }
    // Method override for per-token with units: costCents * units
    expect(resolveOperationCost(pricing, 'embed', 10)).toBe(50)
    expect(resolveOperationCost(pricing, 'other', 10)).toBe(10)
  })

  it('per-token with no units defaults to 1', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 3,
    }
    expect(resolveOperationCost(pricing, 'generate')).toBe(3)
  })

  it('tiered with no tiers array returns defaultCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 7,
    }
    expect(resolveOperationCost(pricing, 'api', 100)).toBe(7)
  })

  it('tiered with no units returns defaultCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 7,
      tiers: [{ upTo: 100, costCents: 2 }],
    }
    expect(resolveOperationCost(pricing, 'api')).toBe(7)
  })
})

describe('generalizedPricingConfigSchema', () => {
  it('validates correct per-invocation config', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'per-invocation',
      defaultCostCents: 5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currencyCode).toBe('USD')
    }
  })

  it('validates config with all fields', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'tiered',
      defaultCostCents: 1,
      currencyCode: 'EUR',
      methods: { search: { costCents: 10, displayName: 'Search' } },
      tiers: [{ upTo: 100, costCents: 2 }, { upTo: 1000, costCents: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it('validates outcome config', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'outcome',
      defaultCostCents: 0,
      outcomeConfig: {
        successCostCents: 50,
        failureCostCents: 0,
        successCondition: 'result.ok',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid model', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'invalid-model',
      defaultCostCents: 5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative costs', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'per-invocation',
      defaultCostCents: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer costs', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'per-invocation',
      defaultCostCents: 5.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects tier with upTo < 1', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [{ upTo: 0, costCents: 2 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currencyCode length', () => {
    const result = generalizedPricingConfigSchema.safeParse({
      model: 'per-invocation',
      defaultCostCents: 5,
      currencyCode: 'US',
    })
    expect(result.success).toBe(false)
  })
})
