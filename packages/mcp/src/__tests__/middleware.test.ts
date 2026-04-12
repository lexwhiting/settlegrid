import { describe, it, expect } from 'vitest'
import { createMiddleware, extractApiKey } from '../middleware'
import type { NormalizedConfig } from '../config'
import type { GeneralizedPricingConfig, PricingConfig } from '../types'

const baseConfig: NormalizedConfig = {
  apiUrl: 'https://settlegrid.ai',
  toolSlug: 'test-tool',
  debug: false,
  cacheTtlMs: 0,
  timeoutMs: 5000,
}

describe('extractApiKey', () => {
  it('extracts from MCP metadata settlegrid-api-key', () => {
    const key = extractApiKey(undefined, { 'settlegrid-api-key': 'sk_test_123' })
    expect(key).toBe('sk_test_123')
  })

  it('extracts from MCP metadata x-api-key', () => {
    const key = extractApiKey(undefined, { 'x-api-key': 'sk_test_456' })
    expect(key).toBe('sk_test_456')
  })

  it('prefers settlegrid-api-key over x-api-key in metadata', () => {
    const key = extractApiKey(undefined, {
      'settlegrid-api-key': 'preferred',
      'x-api-key': 'fallback',
    })
    expect(key).toBe('preferred')
  })

  it('extracts from Authorization Bearer header', () => {
    const key = extractApiKey({ authorization: 'Bearer sk_test_789' })
    expect(key).toBe('sk_test_789')
  })

  it('extracts from x-api-key header', () => {
    const key = extractApiKey({ 'x-api-key': 'sk_test_abc' })
    expect(key).toBe('sk_test_abc')
  })

  it('extracts from X-Api-Key header (case variation)', () => {
    const key = extractApiKey({ 'X-Api-Key': 'sk_test_def' })
    expect(key).toBe('sk_test_def')
  })

  it('handles array header values', () => {
    const key = extractApiKey({ 'x-api-key': ['sk_test_arr'] })
    expect(key).toBe('sk_test_arr')
  })

  it('returns null when no key found', () => {
    const key = extractApiKey({})
    expect(key).toBeNull()
  })

  it('returns null for undefined headers and metadata', () => {
    const key = extractApiKey(undefined, undefined)
    expect(key).toBeNull()
  })

  it('returns null for no arguments', () => {
    const key = extractApiKey()
    expect(key).toBeNull()
  })

  it('ignores non-Bearer authorization', () => {
    const key = extractApiKey({ authorization: 'Basic abc123' })
    expect(key).toBeNull()
  })

  it('prefers metadata over headers', () => {
    const key = extractApiKey(
      { 'x-api-key': 'header-key' },
      { 'settlegrid-api-key': 'metadata-key' }
    )
    expect(key).toBe('metadata-key')
  })
})

// ─── checkCredits: all 6 pricing models resolve through resolveOperationCost ─
//
// Before P1.SDK1, middleware.ts called getMethodCost() at line 176, which
// only supports the legacy per-invocation model. These tests verify that
// the new createMiddleware wiring correctly delegates to
// resolveOperationCost and that all six pricing models charge the right
// amount through the checkCredits path that sg.wrap() calls.
describe('createMiddleware.checkCredits — 6 pricing models', () => {
  it('per-invocation (legacy PricingConfig): falls back to defaultCostCents', () => {
    const pricing: PricingConfig = {
      defaultCostCents: 5,
      methods: { search: { costCents: 10 } },
    }
    const mw = createMiddleware(baseConfig, pricing)
    expect(mw.checkCredits(1000, 'default').costCents).toBe(5)
    expect(mw.checkCredits(1000, 'search').costCents).toBe(10)
    expect(mw.checkCredits(1000, 'unknown').costCents).toBe(5)
  })

  it('per-invocation (generalized): ignores units, returns defaultCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 7,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // units is ignored for per-invocation — cost is flat defaultCostCents
    expect(mw.checkCredits(1000, 'any-method').costCents).toBe(7)
    expect(mw.checkCredits(1000, 'any-method', 100).costCents).toBe(7)
  })

  it('per-token with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 100 tokens × 1¢ = 100¢
    expect(mw.checkCredits(1000, 'generate', 100).costCents).toBe(100)
    // Without units, defaults to 1 token × 1¢ = 1¢
    expect(mw.checkCredits(1000, 'generate').costCents).toBe(1)
  })

  it('per-byte with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-byte',
      defaultCostCents: 2,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 50 bytes × 2¢ = 100¢
    expect(mw.checkCredits(1000, 'download', 50).costCents).toBe(100)
  })

  it('tiered with units: walks tier schedule and sums per-tier costs', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [
        { upTo: 100, costCents: 2 },
        { upTo: 900, costCents: 1 },
      ],
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 150 units = 100 at 2¢ + 50 at 1¢ = 250¢
    expect(mw.checkCredits(1000, 'api', 150).costCents).toBe(250)
  })

  it('outcome: returns successCostCents as pre-auth quote', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'outcome',
      defaultCostCents: 10,
      outcomeConfig: {
        successCostCents: 50,
        failureCostCents: 0,
        successCondition: 'result.success === true',
      },
    }
    const mw = createMiddleware(baseConfig, pricing)
    // Outcome pricing authorizes for the success price up front; the
    // real per-call cost is resolved after execution but checkCredits
    // needs a number to gate the pipeline.
    expect(mw.checkCredits(1000, 'classify').costCents).toBe(50)
  })

  it('per-second with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-second',
      defaultCostCents: 3,
    }
    const mw = createMiddleware(baseConfig, pricing)
    expect(mw.checkCredits(1000, 'compute', 10).costCents).toBe(30)
  })

  it('method override in per-token model multiplies override by units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
      methods: { embed: { costCents: 5 } },
    }
    const mw = createMiddleware(baseConfig, pricing)
    // embed method: 5¢/token × 10 tokens = 50¢
    expect(mw.checkCredits(1000, 'embed', 10).costCents).toBe(50)
    // default: 1¢/token × 10 tokens = 10¢
    expect(mw.checkCredits(1000, 'other', 10).costCents).toBe(10)
  })

  it('sufficient flag reflects balance vs. resolved cost for unit-based pricing', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 1000¢ balance, 500 tokens @ 1¢ = 500¢: sufficient
    expect(mw.checkCredits(1000, 'gen', 500).sufficient).toBe(true)
    // 1000¢ balance, 2000 tokens @ 1¢ = 2000¢: insufficient
    expect(mw.checkCredits(1000, 'gen', 2000).sufficient).toBe(false)
  })
})
