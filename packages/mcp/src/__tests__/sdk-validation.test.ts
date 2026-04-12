/**
 * Tests for input validation on all public SDK functions.
 * Verifies that actionable error messages are thrown for invalid inputs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock middleware so we can test validation without network calls
const { mockMiddleware } = vi.hoisted(() => {
  const mockMiddleware = {
    execute: vi.fn().mockImplementation(
      (_key: string, _method: string, handler: () => unknown, _units?: number) => handler(),
    ),
    validateKey: vi.fn().mockResolvedValue({
      valid: true,
      consumerId: 'con-123',
      toolId: 'tool-123',
      keyId: 'key-123',
      balanceCents: 5000,
    }),
    checkCredits: vi.fn().mockReturnValue({ sufficient: true, costCents: 5 }),
    meter: vi.fn().mockResolvedValue({
      success: true,
      remainingBalanceCents: 4995,
      costCents: 5,
      invocationId: 'inv-123',
    }),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
  }
  return { mockMiddleware }
})

vi.mock('../middleware', () => ({
  createMiddleware: vi.fn().mockReturnValue(mockMiddleware),
  extractApiKey: vi.fn().mockImplementation(
    (headers?: Record<string, string | string[] | undefined>, metadata?: Record<string, unknown>) => {
      if (metadata?.['settlegrid-api-key']) return String(metadata['settlegrid-api-key'])
      if (metadata?.['x-api-key']) return String(metadata['x-api-key'])
      if (!headers) return null
      const apiKeyHeader = headers['x-api-key'] ?? headers['X-Api-Key']
      if (apiKeyHeader) return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] ?? null : apiKeyHeader
      return null
    }
  ),
}))

import { settlegrid, SDK_VERSION } from '../index'
import type { SettleGridInstance } from '../index'

// ─── settlegrid.version ──────────────────────────────────────────────────────

describe('settlegrid.version', () => {
  it('exposes the SDK version string', () => {
    expect(settlegrid.version).toBe('0.1.1')
  })

  it('matches SDK_VERSION constant', () => {
    expect(settlegrid.version).toBe(SDK_VERSION)
  })

  it('is a non-empty string', () => {
    expect(typeof settlegrid.version).toBe('string')
    expect(settlegrid.version.length).toBeGreaterThan(0)
  })

  it('follows semver format', () => {
    expect(settlegrid.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

// ─── SDK_VERSION export ──────────────────────────────────────────────────────

describe('SDK_VERSION export', () => {
  it('is exported from the package', () => {
    expect(SDK_VERSION).toBeDefined()
    expect(typeof SDK_VERSION).toBe('string')
  })

  it('is 0.1.0', () => {
    expect(SDK_VERSION).toBe('0.1.1')
  })
})

// ─── settlegrid.init() validation ────────────────────────────────────────────

describe('settlegrid.init() input validation', () => {
  it('throws with actionable message when toolSlug is empty string', () => {
    expect(() => settlegrid.init({
      toolSlug: '',
      pricing: { defaultCostCents: 1 },
    })).toThrow('toolSlug')
  })

  it('throws with actionable message when toolSlug is whitespace', () => {
    expect(() => settlegrid.init({
      toolSlug: '   ',
      pricing: { defaultCostCents: 1 },
    })).toThrow('toolSlug')
  })

  it('throws with actionable message when pricing is null', () => {
    expect(() => settlegrid.init({
      toolSlug: 'test',
      pricing: null as unknown as { defaultCostCents: number },
    })).toThrow('pricing')
  })

  it('throws with actionable message when pricing is undefined', () => {
    expect(() => settlegrid.init({
      toolSlug: 'test',
      pricing: undefined as unknown as { defaultCostCents: number },
    })).toThrow('pricing')
  })

  it('error message includes settlegrid.ai URL for toolSlug', () => {
    expect(() => settlegrid.init({
      toolSlug: '',
      pricing: { defaultCostCents: 1 },
    })).toThrow('settlegrid.ai')
  })

  it('error message includes example for pricing', () => {
    expect(() => settlegrid.init({
      toolSlug: 'test',
      pricing: 'invalid' as unknown as { defaultCostCents: number },
    })).toThrow('defaultCostCents')
  })

  it('succeeds with valid minimal config', () => {
    const sg = settlegrid.init({
      toolSlug: 'valid-tool',
      pricing: { defaultCostCents: 1 },
    })
    expect(sg).toBeDefined()
    expect(typeof sg.wrap).toBe('function')
    expect(typeof sg.validateKey).toBe('function')
    expect(typeof sg.meter).toBe('function')
    expect(typeof sg.clearCache).toBe('function')
  })
})

// ─── sg.wrap() validation ────────────────────────────────────────────────────

describe('sg.wrap() input validation', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('throws when handler is not a function', () => {
    expect(() => sg.wrap('not-a-function' as unknown as () => Promise<unknown>))
      .toThrow('function')
  })

  it('throws when handler is null', () => {
    expect(() => sg.wrap(null as unknown as () => Promise<unknown>))
      .toThrow('function')
  })

  it('throws when handler is undefined', () => {
    expect(() => sg.wrap(undefined as unknown as () => Promise<unknown>))
      .toThrow('function')
  })

  it('includes the received type in error message', () => {
    expect(() => sg.wrap(42 as unknown as () => Promise<unknown>))
      .toThrow('number')
  })

  it('succeeds with valid sync handler', () => {
    const wrapped = sg.wrap((args: { x: number }) => ({ result: args.x * 2 }))
    expect(typeof wrapped).toBe('function')
  })

  it('succeeds with valid async handler', () => {
    const wrapped = sg.wrap(async (args: { x: number }) => ({ result: args.x * 2 }))
    expect(typeof wrapped).toBe('function')
  })
})

// ─── sg.validateKey() validation ─────────────────────────────────────────────

describe('sg.validateKey() input validation', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('throws when apiKey is empty string', async () => {
    await expect(sg.validateKey('')).rejects.toThrow('non-empty')
  })

  it('throws when apiKey is whitespace only', async () => {
    await expect(sg.validateKey('   ')).rejects.toThrow('non-empty')
  })

  it('throws InvalidKeyError for empty key', async () => {
    const { InvalidKeyError } = await import('../errors')
    await expect(sg.validateKey('')).rejects.toBeInstanceOf(InvalidKeyError)
  })

  it('error message includes the received value', async () => {
    await expect(sg.validateKey('')).rejects.toThrow('""')
  })

  it('succeeds with valid key', async () => {
    const result = await sg.validateKey('sg_live_valid')
    expect(result.valid).toBe(true)
    expect(result.consumerId).toBe('con-123')
    expect(result.balanceCents).toBe(5000)
  })
})

// ─── sg.meter() validation ───────────────────────────────────────────────────

describe('sg.meter() input validation', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('throws when apiKey is empty string', async () => {
    await expect(sg.meter('', 'search')).rejects.toThrow('non-empty')
  })

  it('throws when apiKey is whitespace only', async () => {
    await expect(sg.meter('   ', 'search')).rejects.toThrow('non-empty')
  })

  it('throws when method is empty string', async () => {
    await expect(sg.meter('sg_live_test', '')).rejects.toThrow('non-empty method')
  })

  it('throws when method is whitespace only', async () => {
    await expect(sg.meter('sg_live_test', '   ')).rejects.toThrow('method')
  })

  it('error message mentions pricing config for method errors', async () => {
    await expect(sg.meter('sg_live_test', '')).rejects.toThrow('pricing config')
  })

  it('succeeds with valid apiKey and method', async () => {
    const result = await sg.meter('sg_live_valid', 'search')
    expect(result.success).toBe(true)
    expect(result.costCents).toBe(5)
    expect(result.remainingBalanceCents).toBe(4995)
  })
})

// ─── Wrapped handler no-API-key message ──────────────────────────────────────

describe('wrapped handler error messages', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('throws actionable error when no API key provided', async () => {
    const wrapped = sg.wrap(async () => ({ ok: true }))
    await expect(wrapped({}, {})).rejects.toThrow('x-api-key')
  })

  it('error mentions Bearer token option', async () => {
    const wrapped = sg.wrap(async () => ({ ok: true }))
    await expect(wrapped({}, {})).rejects.toThrow('Bearer')
  })

  it('error mentions MCP metadata option', async () => {
    const wrapped = sg.wrap(async () => ({ ok: true }))
    await expect(wrapped({}, {})).rejects.toThrow('metadata')
  })
})

// ─── settlegrid.init() accepts generalized pricing configs ──────────────────
//
// Before P1.SDK1, pricingConfigSchema only accepted the legacy
// `{ defaultCostCents, methods? }` shape. Zod would strip any extra
// fields, silently losing the `model` discriminator and falling back to
// per-invocation. These tests verify the schema now preserves the
// `model` field and the other generalized fields end-to-end through
// `settlegrid.init()` without throwing.

describe('settlegrid.init() accepts generalized pricing', () => {
  it('accepts per-token config without Zod errors', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'lm-proxy',
        pricing: {
          model: 'per-token',
          defaultCostCents: 1,
        },
      }),
    ).not.toThrow()
  })

  it('accepts per-byte config without Zod errors', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'bandwidth-proxy',
        pricing: {
          model: 'per-byte',
          defaultCostCents: 2,
        },
      }),
    ).not.toThrow()
  })

  it('accepts per-second config without Zod errors', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'compute-proxy',
        pricing: {
          model: 'per-second',
          defaultCostCents: 3,
        },
      }),
    ).not.toThrow()
  })

  it('accepts tiered config with tiers array', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'tiered-svc',
        pricing: {
          model: 'tiered',
          defaultCostCents: 1,
          tiers: [
            { upTo: 100, costCents: 2 },
            { upTo: 1000, costCents: 1 },
          ],
        },
      }),
    ).not.toThrow()
  })

  it('accepts outcome config with outcomeConfig', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'classifier',
        pricing: {
          model: 'outcome',
          defaultCostCents: 0,
          outcomeConfig: {
            successCostCents: 50,
            failureCostCents: 0,
            successCondition: 'result.confident === true',
          },
        },
      }),
    ).not.toThrow()
  })

  it('accepts optional currencyCode', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'eur-tool',
        pricing: {
          model: 'per-invocation',
          defaultCostCents: 5,
          currencyCode: 'EUR',
        },
      }),
    ).not.toThrow()
  })

  it('rejects invalid model enum', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'bad-model',
        pricing: {
          model: 'per-gigabyte' as 'per-byte',
          defaultCostCents: 1,
        },
      }),
    ).toThrow()
  })

  it('still accepts legacy PricingConfig without `model`', () => {
    // Regression guard — backward compat.
    expect(() =>
      settlegrid.init({
        toolSlug: 'legacy-tool',
        pricing: { defaultCostCents: 1, methods: { search: { costCents: 5 } } },
      }),
    ).not.toThrow()
  })

  it('rejects orphan generalized fields without model discriminator', () => {
    // `tiers` is a generalized-only field. Without a `model` discriminator
    // this shape matches neither branch of the union: generalized rejects
    // because `model` is required, and strict legacy rejects because
    // `tiers` is an unknown key. Before the .strict() fix on legacy, this
    // would silently parse as legacy and lose the `tiers` array.
    expect(() =>
      settlegrid.init({
        toolSlug: 'orphan-tiers',
        pricing: {
          defaultCostCents: 1,
          tiers: [{ upTo: 100, costCents: 2 }],
        } as unknown as { defaultCostCents: number },
      }),
    ).toThrow()
  })

  it('rejects orphan outcomeConfig without model discriminator', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'orphan-outcome',
        pricing: {
          defaultCostCents: 1,
          outcomeConfig: {
            successCostCents: 50,
            failureCostCents: 0,
            successCondition: 'foo',
          },
        } as unknown as { defaultCostCents: number },
      }),
    ).toThrow()
  })

  it('rejects orphan currencyCode without model discriminator', () => {
    expect(() =>
      settlegrid.init({
        toolSlug: 'orphan-currency',
        pricing: {
          defaultCostCents: 1,
          currencyCode: 'EUR',
        } as unknown as { defaultCostCents: number },
      }),
    ).toThrow()
  })
})

// ─── sg.wrap() threads units from WrapOptions into middleware.execute ───────

describe('sg.wrap() threads units through the pipeline', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { model: 'per-token', defaultCostCents: 1 },
    })
  })

  it('passes units from WrapOptions as the 4th arg to middleware.execute', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = sg.wrap(handler, { method: 'generate', units: 42 })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } })

    // mockMiddleware.execute is (apiKey, method, handler, units)
    expect(mockMiddleware.execute).toHaveBeenCalledTimes(1)
    const call = mockMiddleware.execute.mock.calls[0]
    expect(call[0]).toBe('sg_live_test')
    expect(call[1]).toBe('generate')
    expect(typeof call[2]).toBe('function')
    expect(call[3]).toBe(42)
  })

  it('passes undefined units when WrapOptions.units is omitted', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = sg.wrap(handler, { method: 'default' })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } })

    const call = mockMiddleware.execute.mock.calls[0]
    expect(call[3]).toBeUndefined()
  })

  it('passes undefined units when WrapOptions is omitted entirely', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = sg.wrap(handler)
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } })

    const call = mockMiddleware.execute.mock.calls[0]
    expect(call[3]).toBeUndefined()
  })
})
