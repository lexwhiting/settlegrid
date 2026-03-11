import { describe, it, expect } from 'vitest'
import { normalizeConfig, validatePricingConfig, getMethodCost } from '../config'

describe('normalizeConfig', () => {
  it('applies defaults for optional fields', () => {
    const config = normalizeConfig({ toolSlug: 'test-tool' })
    expect(config.apiUrl).toBe('https://settlegrid.ai')
    expect(config.toolSlug).toBe('test-tool')
    expect(config.debug).toBe(false)
    expect(config.cacheTtlMs).toBe(300000)
    expect(config.timeoutMs).toBe(5000)
  })

  it('uses provided values', () => {
    const config = normalizeConfig({
      toolSlug: 'my-tool',
      apiUrl: 'https://custom.example.com/',
      debug: true,
      cacheTtlMs: 10000,
      timeoutMs: 3000,
    })
    expect(config.apiUrl).toBe('https://custom.example.com')
    expect(config.debug).toBe(true)
    expect(config.cacheTtlMs).toBe(10000)
    expect(config.timeoutMs).toBe(3000)
  })

  it('strips trailing slash from API URL', () => {
    const config = normalizeConfig({
      toolSlug: 'test',
      apiUrl: 'https://api.example.com/',
    })
    expect(config.apiUrl).toBe('https://api.example.com')
  })

  it('throws on empty toolSlug', () => {
    expect(() => normalizeConfig({ toolSlug: '' })).toThrow()
  })

  it('throws on invalid apiUrl', () => {
    expect(() =>
      normalizeConfig({ toolSlug: 'test', apiUrl: 'not-a-url' })
    ).toThrow()
  })

  it('throws on timeout out of range', () => {
    expect(() =>
      normalizeConfig({ toolSlug: 'test', timeoutMs: 50 })
    ).toThrow()
    expect(() =>
      normalizeConfig({ toolSlug: 'test', timeoutMs: 50000 })
    ).toThrow()
  })
})

describe('validatePricingConfig', () => {
  it('validates valid pricing config', () => {
    const pricing = validatePricingConfig({
      defaultCostCents: 1,
      methods: {
        search: { costCents: 2 },
        analyze: { costCents: 5, displayName: 'Deep Analysis' },
      },
    })
    expect(pricing.defaultCostCents).toBe(1)
    expect(pricing.methods?.search.costCents).toBe(2)
    expect(pricing.methods?.analyze.displayName).toBe('Deep Analysis')
  })

  it('validates config without methods', () => {
    const pricing = validatePricingConfig({ defaultCostCents: 3 })
    expect(pricing.defaultCostCents).toBe(3)
    expect(pricing.methods).toBeUndefined()
  })

  it('rejects negative cost', () => {
    expect(() => validatePricingConfig({ defaultCostCents: -1 })).toThrow()
  })

  it('rejects non-integer cost', () => {
    expect(() => validatePricingConfig({ defaultCostCents: 1.5 })).toThrow()
  })

  it('allows zero cost (free methods)', () => {
    const pricing = validatePricingConfig({
      defaultCostCents: 0,
      methods: { free: { costCents: 0 } },
    })
    expect(pricing.defaultCostCents).toBe(0)
  })
})

describe('getMethodCost', () => {
  const pricing = {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 2 },
      analyze: { costCents: 5 },
    },
  }

  it('returns method-specific cost when defined', () => {
    expect(getMethodCost(pricing, 'search')).toBe(2)
    expect(getMethodCost(pricing, 'analyze')).toBe(5)
  })

  it('returns default cost for unknown methods', () => {
    expect(getMethodCost(pricing, 'unknown')).toBe(1)
    expect(getMethodCost(pricing, 'default')).toBe(1)
  })

  it('returns default cost when no methods defined', () => {
    const simple = { defaultCostCents: 3 }
    expect(getMethodCost(simple, 'anything')).toBe(3)
  })
})
