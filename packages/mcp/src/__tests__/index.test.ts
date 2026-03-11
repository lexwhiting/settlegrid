import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so the mock is available when vi.mock factories run
const { mockMiddleware } = vi.hoisted(() => {
  const mockMiddleware = {
    execute: vi.fn().mockImplementation((_key: string, _method: string, handler: () => unknown) => handler()),
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

import { settlegrid } from '../index'
import type { SettleGridInstance } from '../index'

describe('settlegrid.init()', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('returns an instance with wrap method', () => {
    expect(sg).toBeDefined()
    expect(typeof sg.wrap).toBe('function')
  })

  it('returns an instance with validateKey method', () => {
    expect(typeof sg.validateKey).toBe('function')
  })

  it('returns an instance with meter method', () => {
    expect(typeof sg.meter).toBe('function')
  })

  it('returns an instance with clearCache method', () => {
    expect(typeof sg.clearCache).toBe('function')
  })

  it('accepts custom apiUrl', () => {
    const custom = settlegrid.init({
      toolSlug: 'custom-tool',
      apiUrl: 'https://custom.settlegrid.ai',
      pricing: { defaultCostCents: 1 },
    })
    expect(custom).toBeDefined()
    expect(typeof custom.wrap).toBe('function')
  })

  it('accepts debug mode', () => {
    const debug = settlegrid.init({
      toolSlug: 'debug-tool',
      debug: true,
      pricing: { defaultCostCents: 1 },
    })
    expect(debug).toBeDefined()
  })

  it('accepts custom cache TTL', () => {
    const custom = settlegrid.init({
      toolSlug: 'cached-tool',
      cacheTtlMs: 10000,
      pricing: { defaultCostCents: 1 },
    })
    expect(custom).toBeDefined()
  })
})

describe('settlegrid.init().wrap()', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('creates a wrapper function', () => {
    const handler = async (args: { query: string }) => ({ result: args.query })
    const wrapped = sg.wrap(handler, { method: 'search' })
    expect(typeof wrapped).toBe('function')
  })

  it('wrapped function calls the original handler', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'test' })
    const wrapped = sg.wrap(handler, { method: 'test' })

    const result = await wrapped(
      { query: 'hello' },
      { metadata: { 'settlegrid-api-key': 'sg_live_test123' } }
    )

    expect(handler).toHaveBeenCalledWith({ query: 'hello' })
    expect(result).toEqual({ data: 'test' })
  })

  it('throws InvalidKeyError when no API key provided', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'test' })
    const wrapped = sg.wrap(handler)

    await expect(wrapped({ query: 'hello' }, { headers: {} })).rejects.toThrow('No API key provided')
  })

  it('passes through handler return value', async () => {
    const handler = async () => ({ answer: 42 })
    const wrapped = sg.wrap(handler, { method: 'compute' })

    const result = await wrapped(
      {},
      { metadata: { 'settlegrid-api-key': 'sg_live_key' } }
    )

    expect(result).toEqual({ answer: 42 })
  })
})

describe('settlegrid.init().validateKey()', () => {
  let sg: SettleGridInstance

  beforeEach(() => {
    vi.clearAllMocks()
    sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
  })

  it('returns validation result with consumerId and balance', async () => {
    const result = await sg.validateKey('sg_live_test123')
    expect(result.valid).toBe(true)
    expect(result.consumerId).toBe('con-123')
    expect(result.balanceCents).toBe(5000)
  })
})

describe('settlegrid.init().clearCache()', () => {
  it('calls middleware clearCache', () => {
    const sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 1 },
    })

    sg.clearCache()
    expect(mockMiddleware.clearCache).toHaveBeenCalled()
  })
})

describe('settlegrid.extractApiKey', () => {
  it('extracts key from metadata', () => {
    const key = settlegrid.extractApiKey(
      undefined,
      { 'settlegrid-api-key': 'sg_live_meta_key' }
    )
    expect(key).toBe('sg_live_meta_key')
  })

  it('returns null when no key available', () => {
    const key = settlegrid.extractApiKey({})
    expect(key).toBeNull()
  })
})

describe('settlegrid default export', () => {
  it('is the same as named export', async () => {
    const defaultExport = (await import('../index')).default
    expect(defaultExport).toBe(settlegrid)
  })
})
