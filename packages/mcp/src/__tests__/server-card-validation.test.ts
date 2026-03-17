/**
 * Tests for input validation on generateServerCard and generateServerCardBilling.
 */
import { describe, it, expect } from 'vitest'
import { generateServerCard, generateServerCardBilling } from '../server-card'
import type { GeneralizedPricingConfig } from '../types'

const validPricing: GeneralizedPricingConfig = {
  model: 'per-invocation',
  defaultCostCents: 5,
}

const validTools = [
  { name: 'search', description: 'Search the web', inputSchema: { type: 'object' } },
]

describe('generateServerCardBilling input validation', () => {
  it('throws when toolSlug is empty', () => {
    expect(() => generateServerCardBilling({
      toolSlug: '',
      pricing: validPricing,
    })).toThrow('toolSlug')
  })

  it('throws when toolSlug is not a string', () => {
    expect(() => generateServerCardBilling({
      toolSlug: 42 as unknown as string,
      pricing: validPricing,
    })).toThrow('toolSlug')
  })

  it('error mentions settlegrid.ai/tools', () => {
    expect(() => generateServerCardBilling({
      toolSlug: '',
      pricing: validPricing,
    })).toThrow('settlegrid.ai/tools')
  })

  it('throws when pricing is null', () => {
    expect(() => generateServerCardBilling({
      toolSlug: 'test',
      pricing: null as unknown as GeneralizedPricingConfig,
    })).toThrow('pricing')
  })

  it('throws when pricing is undefined', () => {
    expect(() => generateServerCardBilling({
      toolSlug: 'test',
      pricing: undefined as unknown as GeneralizedPricingConfig,
    })).toThrow('pricing')
  })

  it('error includes example for pricing', () => {
    expect(() => generateServerCardBilling({
      toolSlug: 'test',
      pricing: null as unknown as GeneralizedPricingConfig,
    })).toThrow('GeneralizedPricingConfig')
  })
})

describe('generateServerCard input validation', () => {
  it('throws when name is empty', () => {
    expect(() => generateServerCard({
      name: '',
      description: 'A tool',
      version: '1.0.0',
      tools: validTools,
      toolSlug: 'test',
      pricing: validPricing,
    })).toThrow('name is required')
  })

  it('throws when name is not a string', () => {
    expect(() => generateServerCard({
      name: 123 as unknown as string,
      description: 'A tool',
      version: '1.0.0',
      tools: validTools,
      toolSlug: 'test',
      pricing: validPricing,
    })).toThrow('name is required')
  })

  it('throws when version is empty', () => {
    expect(() => generateServerCard({
      name: 'My Tool',
      description: 'A tool',
      version: '',
      tools: validTools,
      toolSlug: 'test',
      pricing: validPricing,
    })).toThrow('version is required')
  })

  it('throws when tools is not an array', () => {
    expect(() => generateServerCard({
      name: 'My Tool',
      description: 'A tool',
      version: '1.0.0',
      tools: 'not-array' as unknown as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>,
      toolSlug: 'test',
      pricing: validPricing,
    })).toThrow('tools must be an array')
  })

  it('error includes example for tools validation', () => {
    expect(() => generateServerCard({
      name: 'My Tool',
      description: 'A tool',
      version: '1.0.0',
      tools: null as unknown as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>,
      toolSlug: 'test',
      pricing: validPricing,
    })).toThrow('name: "search"')
  })

  it('propagates toolSlug validation from billing function', () => {
    expect(() => generateServerCard({
      name: 'My Tool',
      description: 'A tool',
      version: '1.0.0',
      tools: validTools,
      toolSlug: '',
      pricing: validPricing,
    })).toThrow('toolSlug')
  })

  it('succeeds with valid inputs', () => {
    const card = generateServerCard({
      name: 'My Tool',
      description: 'A great tool',
      version: '1.0.0',
      tools: validTools,
      toolSlug: 'my-tool',
      pricing: validPricing,
    })

    expect(card.name).toBe('My Tool')
    expect(card.version).toBe('1.0.0')
    expect(card.billing).toBeDefined()
    expect(card.billing!.provider).toBe('settlegrid')
  })
})

describe('generateServerCard .well-known/mcp-server format', () => {
  it('produces valid .well-known/mcp-server format with all required fields', () => {
    const card = generateServerCard({
      name: 'Weather API',
      description: 'Get weather data for any city',
      version: '2.1.0',
      tools: [
        {
          name: 'get-weather',
          description: 'Get current weather',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
        {
          name: 'get-forecast',
          description: 'Get 5-day forecast',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' }, days: { type: 'number' } },
          },
        },
      ],
      toolSlug: 'weather-api',
      pricing: {
        model: 'per-invocation',
        defaultCostCents: 1,
        methods: {
          'get-weather': { costCents: 1, displayName: 'Current Weather' },
          'get-forecast': { costCents: 3, displayName: '5-Day Forecast' },
        },
      },
      freeTier: { invocationsPerMonth: 100, description: '100 free calls/month' },
    })

    // Verify top-level fields
    expect(card.name).toBe('Weather API')
    expect(card.description).toBe('Get weather data for any city')
    expect(card.version).toBe('2.1.0')
    expect(card.tools).toHaveLength(2)

    // Verify billing section
    expect(card.billing).toBeDefined()
    expect(card.billing!.provider).toBe('settlegrid')
    expect(card.billing!.model).toBe('per-invocation')
    expect(card.billing!.currency).toBe('USD')
    expect(card.billing!.methods).toBeDefined()
    expect(card.billing!.methods!['get-weather'].costCents).toBe(1)
    expect(card.billing!.methods!['get-forecast'].costCents).toBe(3)
    expect(card.billing!.freeTier!.invocationsPerMonth).toBe(100)
    expect(card.billing!.topUpUrl).toContain('weather-api')

    // Verify JSON serialization round-trip
    const json = JSON.stringify(card)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(card)
  })

  it('produces minimal valid card with empty tools array', () => {
    const card = generateServerCard({
      name: 'Minimal Tool',
      description: 'A minimal tool',
      version: '0.0.1',
      tools: [],
      toolSlug: 'minimal',
      pricing: validPricing,
    })

    expect(card.tools).toHaveLength(0)
    expect(card.billing).toBeDefined()
  })
})
