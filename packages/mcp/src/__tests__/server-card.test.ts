import { describe, it, expect } from 'vitest'
import {
  generateServerCardBilling,
  generateServerCard,
} from '../server-card'
import type {
  ServerCardBilling,
  MCPServerCard,
  ServerCardPricingMethod,
} from '../server-card'
import type { GeneralizedPricingConfig } from '../types'

describe('generateServerCardBilling', () => {
  const defaultPricing: GeneralizedPricingConfig = {
    model: 'per-invocation',
    defaultCostCents: 5,
  }

  it('returns valid billing structure', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })

    expect(billing.provider).toBe('settlegrid')
    expect(billing.providerUrl).toBe('https://settlegrid.ai')
    expect(billing.model).toBe('per-invocation')
    expect(billing.currency).toBe('USD')
    expect(billing.defaultCostCents).toBe(5)
    expect(billing.topUpUrl).toBe('https://settlegrid.ai/top-up?tool=test-tool')
  })

  it('includes billing provider', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(billing.provider).toBe('settlegrid')
  })

  it('includes method pricing', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 1,
      methods: {
        search: { costCents: 2, displayName: 'Web Search' },
        analyze: { costCents: 10, displayName: 'Deep Analysis' },
      },
    }

    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing,
    })

    expect(billing.methods).toBeDefined()
    expect(billing.methods!.search.costCents).toBe(2)
    expect(billing.methods!.search.displayName).toBe('Web Search')
    expect(billing.methods!.analyze.costCents).toBe(10)
    expect(billing.methods!.analyze.displayName).toBe('Deep Analysis')
  })

  it('includes currency', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 5,
      currencyCode: 'EUR',
    }

    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing,
    })

    expect(billing.currency).toBe('EUR')
  })

  it('defaults currency to USD', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(billing.currency).toBe('USD')
  })

  it('includes topUpUrl', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'my-tool',
      pricing: defaultPricing,
    })
    expect(billing.topUpUrl).toBe('https://settlegrid.ai/top-up?tool=my-tool')
  })

  it('uses custom providerUrl', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
      providerUrl: 'https://custom.settlegrid.ai',
    })
    expect(billing.providerUrl).toBe('https://custom.settlegrid.ai')
  })

  it('includes free tier when provided', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
      freeTier: {
        invocationsPerMonth: 100,
        description: '100 free calls per month',
      },
    })

    expect(billing.freeTier).toBeDefined()
    expect(billing.freeTier!.invocationsPerMonth).toBe(100)
    expect(billing.freeTier!.description).toBe('100 free calls per month')
  })

  it('omits free tier when not provided', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(billing.freeTier).toBeUndefined()
  })

  it('omits methods when not provided', () => {
    const billing = generateServerCardBilling({
      toolSlug: 'test-tool',
      pricing: defaultPricing,
    })
    expect(billing.methods).toBeUndefined()
  })
})

describe('generateServerCard', () => {
  const defaultPricing: GeneralizedPricingConfig = {
    model: 'per-invocation',
    defaultCostCents: 5,
  }

  const defaultTools = [
    {
      name: 'search',
      description: 'Search the web',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    },
  ]

  it('returns valid JSON structure', () => {
    const card = generateServerCard({
      name: 'My Tool',
      description: 'A great tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'my-tool',
      pricing: defaultPricing,
    })

    expect(card.name).toBe('My Tool')
    expect(card.description).toBe('A great tool')
    expect(card.version).toBe('1.0.0')
    expect(card.tools).toHaveLength(1)
    expect(card.billing).toBeDefined()
  })

  it('includes billing provider', () => {
    const card = generateServerCard({
      name: 'My Tool',
      description: 'A great tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'my-tool',
      pricing: defaultPricing,
    })

    expect(card.billing!.provider).toBe('settlegrid')
  })

  it('includes method pricing in billing', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 1,
      methods: {
        search: { costCents: 2, displayName: 'Search' },
      },
    }

    const card = generateServerCard({
      name: 'My Tool',
      description: 'Tool with methods',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'my-tool',
      pricing,
    })

    expect(card.billing!.methods).toBeDefined()
    expect(card.billing!.methods!.search.costCents).toBe(2)
  })

  it('includes currency in billing', () => {
    const card = generateServerCard({
      name: 'My Tool',
      description: 'A great tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'my-tool',
      pricing: { ...defaultPricing, currencyCode: 'GBP' },
    })

    expect(card.billing!.currency).toBe('GBP')
  })

  it('includes topUpUrl in billing', () => {
    const card = generateServerCard({
      name: 'My Tool',
      description: 'A great tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'my-tool',
      pricing: defaultPricing,
    })

    expect(card.billing!.topUpUrl).toBe(
      'https://settlegrid.ai/top-up?tool=my-tool'
    )
  })

  it('works with per-invocation pricing', () => {
    const card = generateServerCard({
      name: 'Simple Tool',
      description: 'A simple per-call tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'simple-tool',
      pricing: {
        model: 'per-invocation',
        defaultCostCents: 3,
      },
    })

    expect(card.billing!.model).toBe('per-invocation')
    expect(card.billing!.defaultCostCents).toBe(3)
  })

  it('works with tiered pricing', () => {
    const card = generateServerCard({
      name: 'Tiered Tool',
      description: 'A volume-discounted tool',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'tiered-tool',
      pricing: {
        model: 'tiered',
        defaultCostCents: 5,
        tiers: [
          { upTo: 100, costCents: 5 },
          { upTo: 1000, costCents: 3 },
        ],
      },
    })

    expect(card.billing!.model).toBe('tiered')
    expect(card.billing!.defaultCostCents).toBe(5)
  })

  it('includes free tier when provided', () => {
    const card = generateServerCard({
      name: 'Freemium Tool',
      description: 'A tool with a free tier',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'freemium-tool',
      pricing: defaultPricing,
      freeTier: { invocationsPerMonth: 50 },
    })

    expect(card.billing!.freeTier).toBeDefined()
    expect(card.billing!.freeTier!.invocationsPerMonth).toBe(50)
  })

  it('is JSON-serializable', () => {
    const card = generateServerCard({
      name: 'Serializable Tool',
      description: 'Can be serialized to JSON',
      version: '1.0.0',
      tools: defaultTools,
      toolSlug: 'serial-tool',
      pricing: defaultPricing,
    })

    const json = JSON.stringify(card)
    const parsed = JSON.parse(json) as MCPServerCard
    expect(parsed.name).toBe('Serializable Tool')
    expect(parsed.billing!.provider).toBe('settlegrid')
  })
})

describe('ServerCardPricingMethod interface', () => {
  it('supports all pricing method fields', () => {
    const method: ServerCardPricingMethod = {
      costCents: 5,
      displayName: 'Search',
      description: 'Search the web for information',
    }

    expect(method.costCents).toBe(5)
    expect(method.displayName).toBe('Search')
    expect(method.description).toBe('Search the web for information')
  })
})

describe('ServerCardBilling interface', () => {
  it('validates a complete billing object', () => {
    const billing: ServerCardBilling = {
      provider: 'settlegrid',
      providerUrl: 'https://settlegrid.ai',
      model: 'per-invocation',
      currency: 'USD',
      defaultCostCents: 5,
      topUpUrl: 'https://settlegrid.ai/top-up?tool=test',
      methods: {
        search: { costCents: 2, displayName: 'Search' },
      },
      freeTier: { invocationsPerMonth: 100 },
    }

    expect(billing.provider).toBe('settlegrid')
    expect(billing.model).toBe('per-invocation')
    expect(billing.methods!.search.costCents).toBe(2)
    expect(billing.freeTier!.invocationsPerMonth).toBe(100)
  })
})
