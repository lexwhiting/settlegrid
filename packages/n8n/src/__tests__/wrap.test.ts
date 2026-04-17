/**
 * P2.FMT3 — wrapN8nTool unit tests.
 *
 * Mocks @settlegrid/mcp so the adapter is tested in isolation.
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

import { wrapN8nTool } from '../wrap'

beforeEach(() => {
  mockWrap.mockReset()
  mockInit.mockReset()
  mockInit.mockImplementation(() => ({
    wrap: (execute: (input: unknown) => unknown) =>
      async (input: unknown, ctx: { headers?: Record<string, string> }) => {
        mockWrap(input, ctx)
        if (!ctx?.headers?.['x-api-key']) {
          throw new MockInvalidKeyError('no key')
        }
        return execute(input)
      },
  }))
})

describe('wrapN8nTool — happy path', () => {
  it('returns the execute result with a valid key', async () => {
    const wrapped = wrapN8nTool(
      async (input: { url: string }) => ({ status: 200, url: input.url }),
      { toolSlug: 'my-tool', pricing: { defaultCostCents: 1 } },
    )
    const result = await wrapped(
      { url: 'https://example.com' },
      { settlegridKey: 'sg_live_abc' },
    )
    expect(result).toEqual({ status: 200, url: 'https://example.com' })
  })
})

describe('wrapN8nTool — missing key (401)', () => {
  it('throws InvalidKeyError when context has no settlegridKey', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({}, {})).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError for empty key', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({}, { settlegridKey: '' })).rejects.toMatchObject({
      code: 'INVALID_KEY',
    })
  })

  it('rejects CRLF injection attempts', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, { settlegridKey: 'sg_live_valid\r\nEvil-Header: x' }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('trims whitespace before use', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped({}, { settlegridKey: '  sg_live_abc  ' })
    expect(mockWrap).toHaveBeenCalledWith({}, {
      headers: { 'x-api-key': 'sg_live_abc' },
    })
  })
})

describe('wrapN8nTool — insufficient credits (402)', () => {
  it('propagates InsufficientCreditsError from sg.wrap', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw new MockInsufficientCreditsError('balance 0c, required 5c')
      },
    }))
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })
    await expect(
      wrapped({}, { settlegridKey: 'sg_live_abc' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 })
  })
})

describe('wrapN8nTool — wrap-time validation', () => {
  it('throws TypeError when options is missing', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', undefined as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options/)
  })

  it('throws TypeError for empty toolSlug', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: '',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError for empty method', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: 't',
        pricing: { defaultCostCents: 1 },
        method: '',
      }),
    ).toThrowError(/method/)
  })
})

describe('wrapN8nTool — public API', () => {
  it('returns a function with arity 2 (input, context)', () => {
    const wrapped = wrapN8nTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(typeof wrapped).toBe('function')
    expect(wrapped.length).toBe(2)
  })
})
