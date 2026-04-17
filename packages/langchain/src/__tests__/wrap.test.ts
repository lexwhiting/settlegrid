/**
 * P2.FMT3 — wrapLangchainTool unit tests.
 *
 * Mocks @settlegrid/mcp so the adapter is tested in isolation.
 * Mirrors the test pattern from @settlegrid/ai-sdk and
 * @settlegrid/mastra.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWrap, mockInit, MockInvalidKeyError, MockInsufficientCreditsError } =
  vi.hoisted(() => {
    class _MockInvalidKeyError extends Error {
      readonly code = 'INVALID_KEY'
      readonly statusCode = 401
      constructor(message: string) {
        super(message)
        this.name = 'InvalidKeyError'
      }
    }
    class _MockInsufficientCreditsError extends Error {
      readonly code = 'INSUFFICIENT_CREDITS'
      readonly statusCode = 402
      constructor(message: string) {
        super(message)
        this.name = 'InsufficientCreditsError'
      }
    }
    return {
      mockWrap: vi.fn(),
      mockInit: vi.fn(),
      MockInvalidKeyError: _MockInvalidKeyError,
      MockInsufficientCreditsError: _MockInsufficientCreditsError,
    }
  })

vi.mock('@settlegrid/mcp', () => ({
  settlegrid: {
    version: '0.2.0',
    init: (opts: unknown) => mockInit(opts),
    extractApiKey: vi.fn(),
  },
  InvalidKeyError: MockInvalidKeyError,
  InsufficientCreditsError: MockInsufficientCreditsError,
}))

import { wrapLangchainTool } from '../wrap'

beforeEach(() => {
  mockWrap.mockReset()
  mockInit.mockReset()
  mockInit.mockImplementation(() => ({
    wrap: (execute: (input: unknown) => unknown) =>
      async (input: unknown, context: { headers?: Record<string, string> }) => {
        mockWrap(input, context)
        if (!context?.headers?.['x-api-key']) {
          throw new MockInvalidKeyError('no key')
        }
        return execute(input)
      },
  }))
})

describe('wrapLangchainTool — happy path', () => {
  it('returns the execute result when configurable carries a valid key', async () => {
    const wrapped = wrapLangchainTool(
      async (input: { q: string }) => ({ results: [input.q] }),
      { toolSlug: 'my-tool', pricing: { defaultCostCents: 2 } },
    )
    const result = await wrapped(
      { q: 'hello' },
      { configurable: { settlegridKey: 'sg_live_abc' } },
    )
    expect(result).toEqual({ results: ['hello'] })
  })
})

describe('wrapLangchainTool — missing key (401)', () => {
  it('throws InvalidKeyError when config is undefined', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({ q: 'x' })).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError when configurable is missing', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({ q: 'x' }, {})).rejects.toMatchObject({
      code: 'INVALID_KEY',
    })
  })

  it('throws InvalidKeyError when settlegridKey is missing from configurable', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ q: 'x' }, { configurable: { other: 'field' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('throws InvalidKeyError when settlegridKey is empty string', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ q: 'x' }, { configurable: { settlegridKey: '' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('rejects control-char keys (header-injection defense)', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped(
        { q: 'x' },
        { configurable: { settlegridKey: 'sg_live\r\nEvil: x' } },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('trims whitespace before forwarding', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped(
      { q: 'x' },
      { configurable: { settlegridKey: '  sg_live_abc  ' } },
    )
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_abc' } },
    )
  })
})

describe('wrapLangchainTool — insufficient credits (402)', () => {
  it('propagates InsufficientCreditsError from sg.wrap', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw new MockInsufficientCreditsError('balance 0c, required 5c')
      },
    }))
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })
    await expect(
      wrapped({ q: 'x' }, { configurable: { settlegridKey: 'sg_live_abc' } }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 })
  })
})

describe('wrapLangchainTool — wrap-time validation', () => {
  it('throws TypeError when options is missing', () => {
    expect(() =>
      wrapLangchainTool(async () => 'ok', undefined as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options.*required/)
  })

  it('throws TypeError when toolSlug is whitespace-only', () => {
    expect(() =>
      wrapLangchainTool(async () => 'ok', {
        toolSlug: '   ',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError when pricing is an array', () => {
    expect(() =>
      wrapLangchainTool(async () => 'ok', {
        toolSlug: 'my-tool',
        // @ts-expect-error — arrays shouldn't match PricingConfig
        pricing: [],
      }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError for empty-string method', () => {
    expect(() =>
      wrapLangchainTool(async () => 'ok', {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
        method: '',
      }),
    ).toThrowError(/method/)
  })
})

describe('wrapLangchainTool — options + args forwarding', () => {
  it('forwards method to sg.wrap WrapOptions', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)
    wrapLangchainTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
      method: 'deep-search',
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {
      method: 'deep-search',
    })
  })

  it('passes apiKey to sg.wrap via x-api-key header', async () => {
    const wrapped = wrapLangchainTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped(
      { q: 'x' },
      { configurable: { settlegridKey: 'sg_live_XYZ' } },
    )
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_XYZ' } },
    )
  })
})

describe('wrapLangchainTool — public API', () => {
  it('returns a function with arity 2 (input, config)', () => {
    const wrapped = wrapLangchainTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(typeof wrapped).toBe('function')
    expect(wrapped.length).toBe(2)
  })
})
