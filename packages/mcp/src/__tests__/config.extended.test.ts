import { describe, it, expect } from 'vitest'
import { normalizeConfig, validatePricingConfig, getMethodCost } from '../config'
import type { PricingConfig, SettleGridConfig } from '../types'

describe('normalizeConfig (extended)', () => {
  it('uses default API URL when not provided', () => {
    const result = normalizeConfig({ toolSlug: 'test' } as SettleGridConfig)
    expect(result.apiUrl).toBe('https://settlegrid.ai')
  })

  it('strips trailing slash from apiUrl', () => {
    const result = normalizeConfig({
      toolSlug: 'test',
      apiUrl: 'https://custom.api.com/',
    } as SettleGridConfig)
    expect(result.apiUrl).toBe('https://custom.api.com')
  })

  it('defaults debug to false', () => {
    const result = normalizeConfig({ toolSlug: 'test' } as SettleGridConfig)
    expect(result.debug).toBe(false)
  })

  it('sets debug to true when specified', () => {
    const result = normalizeConfig({ toolSlug: 'test', debug: true } as SettleGridConfig)
    expect(result.debug).toBe(true)
  })

  it('defaults cacheTtlMs to 5 minutes', () => {
    const result = normalizeConfig({ toolSlug: 'test' } as SettleGridConfig)
    expect(result.cacheTtlMs).toBe(300000)
  })

  it('uses custom cacheTtlMs', () => {
    const result = normalizeConfig({ toolSlug: 'test', cacheTtlMs: 10000 } as SettleGridConfig)
    expect(result.cacheTtlMs).toBe(10000)
  })

  it('defaults timeoutMs to 5000', () => {
    const result = normalizeConfig({ toolSlug: 'test' } as SettleGridConfig)
    expect(result.timeoutMs).toBe(5000)
  })

  it('uses custom timeoutMs', () => {
    const result = normalizeConfig({ toolSlug: 'test', timeoutMs: 15000 } as SettleGridConfig)
    expect(result.timeoutMs).toBe(15000)
  })

  it('throws for empty toolSlug', () => {
    expect(() => normalizeConfig({ toolSlug: '' } as SettleGridConfig)).toThrow()
  })

  it('throws for toolSlug over 128 chars', () => {
    expect(() => normalizeConfig({ toolSlug: 'a'.repeat(129) } as SettleGridConfig)).toThrow()
  })

  it('throws for invalid apiUrl', () => {
    expect(() => normalizeConfig({ toolSlug: 'test', apiUrl: 'not-a-url' } as SettleGridConfig)).toThrow()
  })

  it('throws for timeoutMs below 100', () => {
    expect(() => normalizeConfig({ toolSlug: 'test', timeoutMs: 50 } as SettleGridConfig)).toThrow()
  })

  it('throws for timeoutMs above 30000', () => {
    expect(() => normalizeConfig({ toolSlug: 'test', timeoutMs: 31000 } as SettleGridConfig)).toThrow()
  })

  it('accepts timeoutMs at boundary 100', () => {
    const result = normalizeConfig({ toolSlug: 'test', timeoutMs: 100 } as SettleGridConfig)
    expect(result.timeoutMs).toBe(100)
  })

  it('accepts timeoutMs at boundary 30000', () => {
    const result = normalizeConfig({ toolSlug: 'test', timeoutMs: 30000 } as SettleGridConfig)
    expect(result.timeoutMs).toBe(30000)
  })

  it('accepts cacheTtlMs of 0', () => {
    const result = normalizeConfig({ toolSlug: 'test', cacheTtlMs: 0 } as SettleGridConfig)
    expect(result.cacheTtlMs).toBe(0)
  })
})

describe('validatePricingConfig (extended)', () => {
  it('accepts valid pricing with defaultCostCents only', () => {
    const result = validatePricingConfig({ defaultCostCents: 5 })
    expect(result.defaultCostCents).toBe(5)
  })

  it('accepts pricing with methods', () => {
    const result = validatePricingConfig({
      defaultCostCents: 5,
      methods: {
        search: { costCents: 10, displayName: 'Search' },
        query: { costCents: 3 },
      },
    })
    expect(result.methods?.search.costCents).toBe(10)
    expect(result.methods?.query.costCents).toBe(3)
  })

  it('rejects negative defaultCostCents', () => {
    expect(() => validatePricingConfig({ defaultCostCents: -1 })).toThrow()
  })

  it('rejects non-integer defaultCostCents', () => {
    expect(() => validatePricingConfig({ defaultCostCents: 5.5 })).toThrow()
  })

  it('accepts zero defaultCostCents (free)', () => {
    const result = validatePricingConfig({ defaultCostCents: 0 })
    expect(result.defaultCostCents).toBe(0)
  })

  it('rejects negative method costCents', () => {
    expect(() =>
      validatePricingConfig({
        defaultCostCents: 5,
        methods: { bad: { costCents: -1 } },
      })
    ).toThrow()
  })

  it('rejects missing defaultCostCents', () => {
    expect(() => validatePricingConfig({})).toThrow()
  })

  it('rejects non-object input', () => {
    expect(() => validatePricingConfig('invalid')).toThrow()
  })
})

describe('getMethodCost (extended)', () => {
  const pricing: PricingConfig = {
    defaultCostCents: 5,
    methods: {
      search: { costCents: 10, displayName: 'Search' },
      query: { costCents: 3 },
      free: { costCents: 0 },
    },
  }

  it('returns method-specific cost for known method', () => {
    expect(getMethodCost(pricing, 'search')).toBe(10)
    expect(getMethodCost(pricing, 'query')).toBe(3)
  })

  it('returns 0 for free method', () => {
    expect(getMethodCost(pricing, 'free')).toBe(0)
  })

  it('returns defaultCostCents for unknown method', () => {
    expect(getMethodCost(pricing, 'unknown')).toBe(5)
  })

  it('returns defaultCostCents when no methods defined', () => {
    const simple: PricingConfig = { defaultCostCents: 7 }
    expect(getMethodCost(simple, 'anything')).toBe(7)
  })

  it('returns defaultCostCents for empty methods map', () => {
    const empty: PricingConfig = { defaultCostCents: 2, methods: {} }
    expect(getMethodCost(empty, 'test')).toBe(2)
  })
})
