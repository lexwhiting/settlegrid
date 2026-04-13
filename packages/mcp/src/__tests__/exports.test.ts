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

// ─── Protocol adapter exports (P1.K1 surface lock) ──────────────────────────
//
// P1.K1 bundled the nine protocol adapters into @settlegrid/mcp and added
// three value exports (protocolRegistry singleton, ProtocolRegistry class,
// DETECTION_PRIORITY constant) plus seven type exports (ProtocolAdapter,
// ProtocolName, IdentityType, PaymentType, PaymentContext, SettlementStatus,
// SettlementResult) to the SDK's public surface. These assertions guard
// against accidental removal of any of those exports during a future
// refactor — if a re-export line is deleted from src/index.ts, the
// corresponding assertion below fails at compile-time (type imports) or
// runtime (value imports).

describe('protocol adapter value exports (P1.K1)', () => {
  it('exports protocolRegistry singleton with all 9 adapters registered', async () => {
    const mod = await import('../index')
    expect(mod.protocolRegistry).toBeDefined()
    expect(typeof mod.protocolRegistry.register).toBe('function')
    expect(typeof mod.protocolRegistry.detect).toBe('function')
    expect(typeof mod.protocolRegistry.get).toBe('function')
    expect(typeof mod.protocolRegistry.list).toBe('function')
    expect(typeof mod.protocolRegistry.has).toBe('function')
    expect(typeof mod.protocolRegistry.clear).toBe('function')
    expect(mod.protocolRegistry.list().length).toBe(9)
  })

  it('exports ProtocolRegistry class (constructable)', async () => {
    const mod = await import('../index')
    expect(typeof mod.ProtocolRegistry).toBe('function') // class is a function
    const registry = new mod.ProtocolRegistry()
    expect(registry).toBeInstanceOf(mod.ProtocolRegistry)
    expect(registry.list()).toHaveLength(0) // fresh instance starts empty
  })

  it('exports DETECTION_PRIORITY constant with 9 protocol names', async () => {
    const mod = await import('../index')
    expect(Array.isArray(mod.DETECTION_PRIORITY)).toBe(true)
    expect(mod.DETECTION_PRIORITY).toHaveLength(9)
    // Priority order is load-bearing: most-specific first (mpp) → fallback last (mcp)
    expect(mod.DETECTION_PRIORITY[0]).toBe('mpp')
    expect(mod.DETECTION_PRIORITY[mod.DETECTION_PRIORITY.length - 1]).toBe('mcp')
    // Every entry is one of the 9 known protocol names
    const known = new Set([
      'mcp',
      'x402',
      'ap2',
      'visa-tap',
      'mpp',
      'ucp',
      'acp',
      'mastercard-vi',
      'circle-nano',
    ])
    for (const p of mod.DETECTION_PRIORITY) {
      expect(known.has(p)).toBe(true)
    }
  })
})

describe('protocol adapter type exports (P1.K1, compile-time)', () => {
  // These tests verify that the 7 adapter types are exported from the SDK
  // by importing them and using each in a way that would fail compilation
  // if the type were not reachable via the public re-export.

  it('ProtocolAdapter interface is usable', async () => {
    const mod = await import('../index')
    // Construct a minimal mock adapter whose shape matches ProtocolAdapter.
    // This call-site has no `as` cast and no `any` — TypeScript verifies
    // the structural shape against the re-exported interface at compile time.
    const mock: import('../index').ProtocolAdapter = {
      name: 'mcp',
      displayName: 'Mock MCP',
      canHandle: () => true,
      extractPaymentContext: async () => ({
        protocol: 'mcp',
        identity: { type: 'api-key', value: 'test' },
        operation: { service: 'svc', method: 'm' },
        payment: { type: 'credit-balance' },
        requestId: 'req-1',
      }),
      formatResponse: () => new Response('ok'),
      formatError: () => new Response('err', { status: 500 }),
    }
    expect(mock.name).toBe('mcp')
    // Register in a fresh registry to verify the type is compatible with the class
    const registry = new mod.ProtocolRegistry()
    registry.register(mock)
    expect(registry.has('mcp')).toBe(true)
  })

  it('ProtocolName union covers all 9 protocol slugs', async () => {
    // Every valid ProtocolName literal is assignable to the exported type.
    // If ProtocolName were not exported or its union shrank, this test
    // would fail to compile.
    const names: Array<import('../index').ProtocolName> = [
      'mcp',
      'x402',
      'ap2',
      'visa-tap',
      'mpp',
      'ucp',
      'acp',
      'mastercard-vi',
      'circle-nano',
    ]
    expect(names).toHaveLength(9)
  })

  it('PaymentContext, PaymentType, IdentityType are usable as value types', () => {
    // All three types appear in this one literal — if any is missing,
    // compilation fails.
    const ctx: import('../index').PaymentContext = {
      protocol: 'mcp',
      identity: {
        type: 'api-key' satisfies import('../index').IdentityType,
        value: 'sg_live_abc',
      },
      operation: { service: 'svc', method: 'm' },
      payment: {
        type: 'credit-balance' satisfies import('../index').PaymentType,
      },
      requestId: 'req-1',
    }
    expect(ctx.protocol).toBe('mcp')
    expect(ctx.identity.type).toBe('api-key')
    expect(ctx.payment.type).toBe('credit-balance')
  })

  it('SettlementResult and SettlementStatus are usable as value types', () => {
    const status: import('../index').SettlementStatus = 'settled'
    const result: import('../index').SettlementResult = {
      status,
      operationId: 'op-1',
      costCents: 10,
      metadata: {
        protocol: 'mcp',
        latencyMs: 5,
        settlementType: 'real-time',
      },
    }
    expect(result.status).toBe('settled')
    expect(result.costCents).toBe(10)
    expect(result.metadata.settlementType).toBe('real-time')
  })
})
