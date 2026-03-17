/**
 * Tests verifying all public exports from @settlegrid/mcp.
 * Ensures no type or function is accidentally removed from the public API.
 */
import { describe, it, expect } from 'vitest'

describe('public value exports', () => {
  it('exports settlegrid namespace', async () => {
    const mod = await import('../index')
    expect(mod.settlegrid).toBeDefined()
    expect(typeof mod.settlegrid.init).toBe('function')
    expect(typeof mod.settlegrid.extractApiKey).toBe('function')
    expect(typeof mod.settlegrid.version).toBe('string')
  })

  it('exports default as settlegrid', async () => {
    const mod = await import('../index')
    expect(mod.default).toBe(mod.settlegrid)
  })

  it('exports SDK_VERSION', async () => {
    const mod = await import('../index')
    expect(mod.SDK_VERSION).toBeDefined()
    expect(typeof mod.SDK_VERSION).toBe('string')
    expect(mod.SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('exports all error classes', async () => {
    const mod = await import('../index')
    expect(mod.SettleGridError).toBeDefined()
    expect(mod.InvalidKeyError).toBeDefined()
    expect(mod.InsufficientCreditsError).toBeDefined()
    expect(mod.ToolNotFoundError).toBeDefined()
    expect(mod.ToolDisabledError).toBeDefined()
    expect(mod.RateLimitedError).toBeDefined()
    expect(mod.SettleGridUnavailableError).toBeDefined()
    expect(mod.NetworkError).toBeDefined()
    expect(mod.TimeoutError).toBeDefined()
  })

  it('exports settlegridMiddleware', async () => {
    const mod = await import('../index')
    expect(typeof mod.settlegridMiddleware).toBe('function')
  })

  it('exports createPaymentCapability', async () => {
    const mod = await import('../index')
    expect(typeof mod.createPaymentCapability).toBe('function')
  })

  it('exports PAYMENT_ERROR_CODES', async () => {
    const mod = await import('../index')
    expect(mod.PAYMENT_ERROR_CODES).toBeDefined()
    expect(typeof mod.PAYMENT_ERROR_CODES).toBe('object')
  })

  it('exports generateServerCardBilling', async () => {
    const mod = await import('../index')
    expect(typeof mod.generateServerCardBilling).toBe('function')
  })

  it('exports generateServerCard', async () => {
    const mod = await import('../index')
    expect(typeof mod.generateServerCard).toBe('function')
  })

  it('exports extractApiKey directly', async () => {
    const mod = await import('../index')
    expect(typeof mod.extractApiKey).toBe('function')
  })

  it('exports normalizeConfig', async () => {
    const mod = await import('../index')
    expect(typeof mod.normalizeConfig).toBe('function')
  })

  it('exports validatePricingConfig', async () => {
    const mod = await import('../index')
    expect(typeof mod.validatePricingConfig).toBe('function')
  })

  it('exports getMethodCost', async () => {
    const mod = await import('../index')
    expect(typeof mod.getMethodCost).toBe('function')
  })

  it('exports resolveOperationCost', async () => {
    const mod = await import('../index')
    expect(typeof mod.resolveOperationCost).toBe('function')
  })

  it('exports pricingConfigSchema', async () => {
    const mod = await import('../index')
    expect(mod.pricingConfigSchema).toBeDefined()
    expect(typeof mod.pricingConfigSchema.parse).toBe('function')
  })

  it('exports generalizedPricingConfigSchema', async () => {
    const mod = await import('../index')
    expect(mod.generalizedPricingConfigSchema).toBeDefined()
    expect(typeof mod.generalizedPricingConfigSchema.parse).toBe('function')
  })

  it('exports LRUCache class', async () => {
    const mod = await import('../index')
    expect(mod.LRUCache).toBeDefined()
    const cache = new mod.LRUCache(10, 1000)
    expect(cache.size).toBe(0)
  })
})

describe('public type exports (compile-time)', () => {
  // These tests verify types are exported by importing and using them.
  // If any type is not exported, TypeScript compilation will fail.

  it('SettleGridConfig type is usable', async () => {
    const { settlegrid } = await import('../index')
    // This implicitly tests SettleGridConfig and InitOptions
    const sg = settlegrid.init({
      toolSlug: 'type-test',
      pricing: { defaultCostCents: 1 },
    })
    expect(sg).toBeDefined()
  })

  it('error class instances have correct types', async () => {
    const mod = await import('../index')
    const err = new mod.InvalidKeyError('test')
    // Verifies SettleGridErrorCode type is accessible through the error
    expect(err.code).toBe('INVALID_KEY')
    expect(err.statusCode).toBe(401)
    const json = err.toJSON()
    expect(json.error).toBe('test')
    expect(json.code).toBe('INVALID_KEY')
    expect(json.statusCode).toBe(401)
  })
})

describe('settlegrid namespace has all expected members', () => {
  it('has exactly init, extractApiKey, and version', async () => {
    const { settlegrid } = await import('../index')
    const keys = Object.keys(settlegrid).sort()
    expect(keys).toEqual(['extractApiKey', 'init', 'version'])
  })
})
