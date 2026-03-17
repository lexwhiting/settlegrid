/**
 * Tests for input validation on createPaymentCapability.
 */
import { describe, it, expect } from 'vitest'
import { createPaymentCapability, PAYMENT_ERROR_CODES } from '../payment-capability'
import type { GeneralizedPricingConfig } from '../types'

describe('createPaymentCapability input validation', () => {
  const validPricing: GeneralizedPricingConfig = {
    model: 'per-invocation',
    defaultCostCents: 5,
  }

  it('throws when toolSlug is empty', () => {
    expect(() => createPaymentCapability({
      toolSlug: '',
      pricing: validPricing,
    })).toThrow('toolSlug')
  })

  it('throws when toolSlug is not a string', () => {
    expect(() => createPaymentCapability({
      toolSlug: 123 as unknown as string,
      pricing: validPricing,
    })).toThrow('toolSlug')
  })

  it('error message mentions settlegrid.ai for toolSlug', () => {
    expect(() => createPaymentCapability({
      toolSlug: '',
      pricing: validPricing,
    })).toThrow('settlegrid.ai')
  })

  it('throws when pricing is null', () => {
    expect(() => createPaymentCapability({
      toolSlug: 'test',
      pricing: null as unknown as GeneralizedPricingConfig,
    })).toThrow('pricing')
  })

  it('throws when pricing is undefined', () => {
    expect(() => createPaymentCapability({
      toolSlug: 'test',
      pricing: undefined as unknown as GeneralizedPricingConfig,
    })).toThrow('pricing')
  })

  it('error includes example for pricing', () => {
    expect(() => createPaymentCapability({
      toolSlug: 'test',
      pricing: null as unknown as GeneralizedPricingConfig,
    })).toThrow('GeneralizedPricingConfig')
  })

  it('throws when defaultCostCents is negative', () => {
    expect(() => createPaymentCapability({
      toolSlug: 'test',
      pricing: { model: 'per-invocation', defaultCostCents: -1 },
    })).toThrow('defaultCostCents')
  })

  it('succeeds with valid inputs', () => {
    const cap = createPaymentCapability({
      toolSlug: 'my-tool',
      pricing: validPricing,
    })
    expect(cap.provider).toBe('settlegrid')
    expect(cap.version).toBe('1.0')
  })

  it('generates correct MCP-compatible structure', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: {
        model: 'per-invocation',
        defaultCostCents: 5,
        methods: {
          search: { costCents: 2, displayName: 'Search' },
        },
      },
    })

    // MCP expects experimental.payment capability with these exact fields
    expect(cap).toEqual({
      provider: 'settlegrid',
      version: '1.0',
      pricing: {
        model: 'per-invocation',
        defaultCostCents: 5,
        methods: {
          search: { costCents: 2, displayName: 'Search' },
        },
      },
      topUpUrl: 'https://settlegrid.ai/top-up?tool=test-tool',
      acceptedPaymentMethods: ['credit-balance'],
    })
  })

  it('output is JSON serializable', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: validPricing,
    })
    const json = JSON.stringify(cap)
    const parsed = JSON.parse(json)
    expect(parsed.provider).toBe('settlegrid')
    expect(parsed.version).toBe('1.0')
  })

  it('works with all pricing models', () => {
    const models = ['per-invocation', 'per-token', 'per-byte', 'per-second', 'tiered', 'outcome'] as const
    for (const model of models) {
      const cap = createPaymentCapability({
        toolSlug: 'test',
        pricing: { model, defaultCostCents: 1 },
      })
      expect(cap.pricing.model).toBe(model)
    }
  })
})

describe('PAYMENT_ERROR_CODES MCP compatibility', () => {
  it('uses negative integers in the JSON-RPC error code range', () => {
    const values = Object.values(PAYMENT_ERROR_CODES)
    values.forEach(v => {
      expect(v).toBeLessThan(0)
      expect(Number.isInteger(v)).toBe(true)
    })
  })

  it('codes are in the -32000 to -32099 server error range', () => {
    const values = Object.values(PAYMENT_ERROR_CODES)
    values.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-32099)
      expect(v).toBeLessThanOrEqual(-32000)
    })
  })
})
