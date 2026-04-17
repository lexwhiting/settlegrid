/**
 * P2.FMT3 — wrapCursorTool unit tests.
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

import { wrapCursorTool } from '../wrap'

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

describe('wrapCursorTool — happy path', () => {
  it('returns the execute result with a valid key in _meta', async () => {
    const wrapped = wrapCursorTool(
      async (input: { q: string }) => ({ content: [{ type: 'text', text: input.q }] }),
      { toolSlug: 'my-tool', pricing: { defaultCostCents: 1 } },
    )
    const result = await wrapped(
      { q: 'hi' },
      { _meta: { 'settlegrid-api-key': 'sg_live_abc' } },
    )
    expect(result).toEqual({ content: [{ type: 'text', text: 'hi' }] })
  })
})

describe('wrapCursorTool — missing key (401)', () => {
  it('throws InvalidKeyError when extra is undefined', async () => {
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({})).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError when _meta is missing', async () => {
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({}, {})).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('throws InvalidKeyError when settlegrid-api-key missing from _meta', async () => {
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, { _meta: { 'settlegrid-method': 'search' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('rejects control-char keys (header-injection defense)', async () => {
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, { _meta: { 'settlegrid-api-key': 'sg_live\r\nEvil: x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('trims whitespace before forwarding', async () => {
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped(
      {},
      { _meta: { 'settlegrid-api-key': '  sg_live_abc  ' } },
    )
    expect(mockWrap).toHaveBeenCalledWith({}, {
      headers: { 'x-api-key': 'sg_live_abc' },
    })
  })
})

describe('wrapCursorTool — insufficient credits (402)', () => {
  it('propagates InsufficientCreditsError from sg.wrap', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw new MockInsufficientCreditsError('balance 0c, required 5c')
      },
    }))
    const wrapped = wrapCursorTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })
    await expect(
      wrapped({}, { _meta: { 'settlegrid-api-key': 'sg_live_abc' } }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 })
  })
})

describe('wrapCursorTool — wrap-time validation', () => {
  it('throws TypeError when options is missing', () => {
    expect(() =>
      wrapCursorTool(async () => 'ok', undefined as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options/)
  })

  it('throws TypeError for empty toolSlug', () => {
    expect(() =>
      wrapCursorTool(async () => 'ok', {
        toolSlug: '',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError for array pricing', () => {
    expect(() =>
      wrapCursorTool(async () => 'ok', {
        toolSlug: 't',
        // @ts-expect-error — arrays shouldn't match PricingConfig
        pricing: [],
      }),
    ).toThrowError(/pricing/)
  })
})

describe('wrapCursorTool — public API', () => {
  it('returns a function with arity 2 (input, extra)', () => {
    const wrapped = wrapCursorTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(typeof wrapped).toBe('function')
    expect(wrapped.length).toBe(2)
  })
})
