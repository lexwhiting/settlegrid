import { describe, it, expect } from 'vitest'
import {
  createPaymentCapability,
  PAYMENT_ERROR_CODES,
} from '../payment-capability'
import type {
  PaymentCapability,
  PaymentMeta,
  PaymentResultMeta,
} from '../payment-capability'
import type { GeneralizedPricingConfig } from '../types'

describe('createPaymentCapability', () => {
  const defaultPricing: GeneralizedPricingConfig = {
    model: 'per-invocation',
    defaultCostCents: 5,
  }

  it('returns correct provider', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(cap.provider).toBe('settlegrid')
  })

  it('returns version 1.0', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(cap.version).toBe('1.0')
  })

  it('includes pricing config', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 10,
      methods: {
        search: { costCents: 2, displayName: 'Search' },
        analyze: { costCents: 15 },
      },
    }

    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing,
    })

    expect(cap.pricing).toEqual(pricing)
    expect(cap.pricing.model).toBe('per-invocation')
    expect(cap.pricing.defaultCostCents).toBe(10)
    expect(cap.pricing.methods?.search.costCents).toBe(2)
  })

  it('generates default topUpUrl from toolSlug', () => {
    const cap = createPaymentCapability({
      toolSlug: 'my-awesome-tool',
      pricing: defaultPricing,
    })
    expect(cap.topUpUrl).toBe('https://settlegrid.ai/top-up?tool=my-awesome-tool')
  })

  it('uses custom topUpUrl when provided', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
      topUpUrl: 'https://custom.example.com/buy-credits',
    })
    expect(cap.topUpUrl).toBe('https://custom.example.com/buy-credits')
  })

  it('defaults to credit-balance payment method', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(cap.acceptedPaymentMethods).toEqual(['credit-balance'])
  })

  it('accepts custom payment methods', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
      acceptedPaymentMethods: ['credit-balance', 'x402'],
    })
    expect(cap.acceptedPaymentMethods).toEqual(['credit-balance', 'x402'])
  })

  it('includes pricingUrl when provided', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
      pricingUrl: 'https://example.com/pricing',
    })
    expect(cap.pricingUrl).toBe('https://example.com/pricing')
  })

  it('omits pricingUrl when not provided', () => {
    const cap = createPaymentCapability({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(cap.pricingUrl).toBeUndefined()
  })

  it('works with tiered pricing model', () => {
    const tieredPricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [
        { upTo: 100, costCents: 5 },
        { upTo: 1000, costCents: 3 },
        { upTo: 10000, costCents: 1 },
      ],
    }

    const cap = createPaymentCapability({
      toolSlug: 'tiered-tool',
      pricing: tieredPricing,
    })

    expect(cap.pricing.model).toBe('tiered')
    expect(cap.pricing.tiers).toHaveLength(3)
  })
})

describe('PAYMENT_ERROR_CODES', () => {
  it('INSUFFICIENT_CREDITS is -32001', () => {
    expect(PAYMENT_ERROR_CODES.INSUFFICIENT_CREDITS).toBe(-32001)
  })

  it('PAYMENT_REQUIRED is -32002', () => {
    expect(PAYMENT_ERROR_CODES.PAYMENT_REQUIRED).toBe(-32002)
  })

  it('BUDGET_EXCEEDED is -32003', () => {
    expect(PAYMENT_ERROR_CODES.BUDGET_EXCEEDED).toBe(-32003)
  })

  it('INVALID_PAYMENT_KEY is -32004', () => {
    expect(PAYMENT_ERROR_CODES.INVALID_PAYMENT_KEY).toBe(-32004)
  })

  it('PAYMENT_PROVIDER_ERROR is -32005', () => {
    expect(PAYMENT_ERROR_CODES.PAYMENT_PROVIDER_ERROR).toBe(-32005)
  })

  it('has exactly 5 error codes', () => {
    expect(Object.keys(PAYMENT_ERROR_CODES)).toHaveLength(5)
  })

  it('all values are unique negative numbers', () => {
    const values = Object.values(PAYMENT_ERROR_CODES)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
    values.forEach((v) => expect(v).toBeLessThan(0))
  })
})

describe('PaymentCapability interface validation', () => {
  it('validates all fields on a capability object', () => {
    const cap: PaymentCapability = {
      provider: 'settlegrid',
      version: '1.0',
      pricing: {
        model: 'per-invocation',
        defaultCostCents: 5,
      },
      topUpUrl: 'https://settlegrid.ai/top-up?tool=test',
      acceptedPaymentMethods: ['credit-balance'],
    }

    expect(cap.provider).toBe('settlegrid')
    expect(cap.version).toBe('1.0')
    expect(cap.pricing.model).toBe('per-invocation')
    expect(cap.topUpUrl).toContain('settlegrid.ai')
    expect(cap.acceptedPaymentMethods).toContain('credit-balance')
  })
})

describe('PaymentMeta interface', () => {
  it('supports all meta fields', () => {
    const meta: PaymentMeta = {
      'settlegrid-api-key': 'sg_live_test',
      'settlegrid-session-id': 'sess_abc',
      'settlegrid-max-cost-cents': 100,
    }

    expect(meta['settlegrid-api-key']).toBe('sg_live_test')
    expect(meta['settlegrid-session-id']).toBe('sess_abc')
    expect(meta['settlegrid-max-cost-cents']).toBe(100)
  })

  it('allows partial meta (all fields optional)', () => {
    const meta: PaymentMeta = {
      'settlegrid-api-key': 'sg_live_test',
    }
    expect(meta['settlegrid-session-id']).toBeUndefined()
    expect(meta['settlegrid-max-cost-cents']).toBeUndefined()
  })
})

describe('PaymentResultMeta interface', () => {
  it('supports result meta fields', () => {
    const result: PaymentResultMeta = {
      'settlegrid-cost-cents': 5,
      'settlegrid-remaining-cents': 4995,
      'settlegrid-test-mode': false,
    }

    expect(result['settlegrid-cost-cents']).toBe(5)
    expect(result['settlegrid-remaining-cents']).toBe(4995)
    expect(result['settlegrid-test-mode']).toBe(false)
  })
})
