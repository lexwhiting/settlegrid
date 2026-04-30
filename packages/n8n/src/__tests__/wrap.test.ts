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

  it('throws TypeError for missing pricing', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: 't',
      } as unknown as { toolSlug: string; pricing: { defaultCostCents: number } }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError for array pricing', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: 't',
        // @ts-expect-error — arrays shouldn't match PricingConfig
        pricing: [],
      }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError for non-object pricing (string)', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: 't',
        // @ts-expect-error — strings shouldn't match PricingConfig
        pricing: 'cheap',
      }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError for non-string method (number)', () => {
    expect(() =>
      wrapN8nTool(async () => 'ok', {
        toolSlug: 't',
        pricing: { defaultCostCents: 1 },
        // @ts-expect-error — method must be a string
        method: 42,
      }),
    ).toThrowError(/method/)
  })
})

describe('wrapN8nTool — fail-fast: no side effects before key validation', () => {
  it('does not invoke execute or call billed when key is missing', async () => {
    const execute = vi.fn(async (input: { url: string }) => ({ url: input.url }))
    const wrapped = wrapN8nTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ url: 'https://example.com' }, {}),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
    expect(execute).not.toHaveBeenCalled()
    expect(mockWrap).not.toHaveBeenCalled()
  })

  it('does not invoke execute when key fails injection check', async () => {
    const execute = vi.fn(async () => ({ ok: true }))
    const wrapped = wrapN8nTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, { settlegridKey: 'sg_live\r\nEvil: x' }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
    expect(execute).not.toHaveBeenCalled()
    expect(mockWrap).not.toHaveBeenCalled()
  })
})

describe('wrapN8nTool — settlegrid.init wiring', () => {
  it('forwards toolSlug and pricing to settlegrid.init', () => {
    wrapN8nTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 3 },
    })
    expect(mockInit).toHaveBeenCalledWith({
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 3 },
    })
  })
})

describe('wrapN8nTool — execute is called with the original input', () => {
  it('forwards the un-transformed input to execute on happy path', async () => {
    const execute = vi.fn(async (input: { items: string[] }) => ({ got: input }))
    const wrapped = wrapN8nTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const input = { items: ['a', 'b'] }
    await wrapped(input, { settlegridKey: 'sg_live_abc' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(input)
  })

  it('supports synchronous execute functions', async () => {
    const execute = vi.fn((input: { n: number }) => input.n + 1)
    const wrapped = wrapN8nTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const result = await wrapped({ n: 10 }, { settlegridKey: 'sg_live_abc' })
    expect(result).toBe(11)
  })
})

describe('wrapN8nTool — header-injection / non-ASCII defense', () => {
  const injectionPayloads = [
    ['CRLF', 'sg_live_valid\r\nEvil: x'],
    ['LF', 'sg_live_valid\nEvil: x'],
    ['CR', 'sg_live_valid\rEvil: x'],
    ['NUL byte', 'sg_live_valid\x00xxx'],
    ['vertical tab', 'sg_live_valid\x0Bxxx'],
    ['form feed', 'sg_live_valid\x0Cxxx'],
    ['DEL', 'sg_live_valid\x7F'],
    ['latin-1 extended', 'sg_live_café'],
    ['unicode mathematical', '𝐬𝐠_𝐥𝐢𝐯𝐞_xyz'],
    ['emoji', 'sg_live_🔑xyz'],
  ] as const

  it.each(injectionPayloads)(
    'rejects %s injection-style key as INVALID_KEY',
    async (_label, badKey) => {
      const wrapped = wrapN8nTool(async () => ({ ok: true }), {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
      })
      await expect(
        wrapped({}, { settlegridKey: badKey }),
      ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
    },
  )

  it('rejects array-shaped context', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, [] as unknown as { settlegridKey: string }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('rejects non-string settlegridKey', async () => {
    const wrapped = wrapN8nTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    for (const bad of [42, true, { nested: 'x' }, null]) {
      await expect(
        wrapped({}, { settlegridKey: bad as unknown as string }),
      ).rejects.toMatchObject({ code: 'INVALID_KEY' })
    }
  })
})

describe('wrapN8nTool — method forwarding', () => {
  it('forwards a valid method to sg.wrap WrapOptions', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)
    wrapN8nTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
      method: 'lookup',
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {
      method: 'lookup',
    })
  })

  it('omits method from WrapOptions when not provided', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)
    wrapN8nTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {})
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
