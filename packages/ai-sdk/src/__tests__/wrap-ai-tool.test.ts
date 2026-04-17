/**
 * P2.FMT1 — wrapAiTool unit tests.
 *
 * Tests the adapter SHIM in isolation by mocking `@settlegrid/mcp`.
 * The underlying billing pipeline (sg.wrap → middleware → API key
 * validation → credit check → handler → meter) is tested in the
 * @settlegrid/mcp package; here we only verify:
 *
 *   - The adapter extracts `settlegridKey` from
 *     `experimental_context` correctly.
 *   - Missing / empty keys throw `InvalidKeyError` (→ 401).
 *   - Errors from sg.wrap (InsufficientCreditsError → 402, etc.)
 *     propagate through unchanged.
 *   - `toolSlug` / `pricing` / `method` are forwarded to
 *     `settlegrid.init` and `sg.wrap` correctly.
 *   - `args` and the returned result flow through without mutation.
 *   - Invalid wrap-time options throw a clear TypeError before any
 *     runtime work happens.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocked @settlegrid/mcp ────────────────────────────────────────────────
//
// `vi.mock` is hoisted to the top of the file so its factory cannot
// reference module-scope bindings defined below. `vi.hoisted` gives us
// a slot that's hoisted AT THE SAME TIME as vi.mock — so the shared
// `mockWrap` / `mockInit` spies + the mock error classes are already
// initialized by the time the mock factory runs.

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

import { wrapAiTool, type AiToolExecuteOptions } from '../index'

beforeEach(() => {
  mockWrap.mockReset()
  mockInit.mockReset()
  // Default: init returns an instance whose `wrap(execute, opts)`
  // returns a pre-captured `mockWrap` fn. Tests customize mockWrap's
  // behavior per case.
  mockInit.mockImplementation(() => {
    const wrapFn = vi.fn((execute: (args: unknown) => unknown, _opts: unknown) => {
      // Default wrap behavior: when the wrapped fn is called, forward
      // args to the execute (unless a test replaces mockWrap).
      return async (args: unknown, context: { headers?: Record<string, string> }) => {
        mockWrap(args, context)
        return execute(args)
      }
    })
    return { wrap: wrapFn }
  })
})

// ─── 1. Happy path ─────────────────────────────────────────────────────────

describe('wrapAiTool — happy path', () => {
  it('returns the execute result when key is present + sg.wrap succeeds', async () => {
    const execute = vi.fn(async (args: { q: string }) => ({ results: [args.q] }))
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 2 },
    })

    const options: AiToolExecuteOptions = {
      experimental_context: { settlegridKey: 'sg_live_abc' },
    }
    const result = await wrapped({ q: 'hello' }, options)

    expect(result).toEqual({ results: ['hello'] })
    expect(execute).toHaveBeenCalledWith({ q: 'hello' })
  })
})

// ─── 2. Missing / empty key → InvalidKeyError (401) ───────────────────────

describe('wrapAiTool — missing key (401 bucket)', () => {
  const execute = vi.fn(async (_args: { q: string }) => ({ ok: true }))

  it('throws InvalidKeyError when options is undefined', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    // @ts-expect-error — intentionally missing options for runtime check
    await expect(wrapped({ q: 'x' }, undefined)).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError when experimental_context is undefined', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({ q: 'x' }, {})).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError when settlegridKey is missing', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ q: 'x' }, { experimental_context: { other: 'field' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('throws InvalidKeyError when settlegridKey is empty string', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ q: 'x' }, { experimental_context: { settlegridKey: '' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('throws InvalidKeyError when settlegridKey is not a string', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ q: 'x' }, {
        experimental_context: { settlegridKey: 12345 as unknown as string },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('error message mentions experimental_context.settlegridKey explicitly', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    try {
      await wrapped({ q: 'x' }, { experimental_context: {} })
      expect.unreachable('should throw')
    } catch (err) {
      expect((err as Error).message).toContain('experimental_context')
      expect((err as Error).message).toContain('settlegridKey')
    }
  })

  it('does NOT call execute when key is missing (no wasted work)', async () => {
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const callsBefore = execute.mock.calls.length
    await wrapped({ q: 'x' }, {}).catch(() => {})
    expect(execute.mock.calls.length).toBe(callsBefore)
  })
})

// ─── 3. Insufficient credits → InsufficientCreditsError (402) ─────────────

describe('wrapAiTool — insufficient credits (402 bucket)', () => {
  it('propagates InsufficientCreditsError from sg.wrap', async () => {
    // Override mockInit so the returned wrap() makes its billed fn
    // throw an InsufficientCreditsError — simulating the middleware's
    // balance check failing.
    mockInit.mockImplementationOnce(() => ({
      wrap: (_execute: unknown, _opts: unknown) => async () => {
        throw new MockInsufficientCreditsError('balance 0c, required 5c')
      },
    }))

    const execute = vi.fn(async () => ({ ok: true }))
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })

    await expect(
      wrapped({ q: 'hello' }, { experimental_context: { settlegridKey: 'sg_live_abc' } }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 })
  })

  it('propagates the original error — does not swallow or rewrap', async () => {
    const original = new MockInsufficientCreditsError('balance 0c, required 5c')
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw original
      },
    }))

    const wrapped = wrapAiTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })

    let caught: unknown
    try {
      await wrapped({ q: 'hello' }, { experimental_context: { settlegridKey: 'sg_live_abc' } })
    } catch (err) {
      caught = err
    }
    expect(caught).toBe(original) // reference equality: no rewrap
  })
})

// ─── 4. Options + args forwarding ─────────────────────────────────────────

describe('wrapAiTool — options + args forwarding', () => {
  it('forwards toolSlug + pricing to settlegrid.init', () => {
    wrapAiTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 7, methods: { search: { costCents: 15 } } },
    })
    expect(mockInit).toHaveBeenCalledWith({
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 7, methods: { search: { costCents: 15 } } },
    })
  })

  it('forwards method to sg.wrap WrapOptions when provided', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)

    wrapAiTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
      method: 'expensive-op',
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {
      method: 'expensive-op',
    })
  })

  it('omits method in WrapOptions when not provided (default method path)', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)

    wrapAiTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {})
  })

  it('forwards args to the execute function without mutation', async () => {
    const receivedArgs: unknown[] = []
    const execute = vi.fn(async (args: { q: string; count: number }) => {
      receivedArgs.push(args)
      return { ok: true }
    })
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })

    const input = { q: 'hello', count: 3 }
    await wrapped(input, { experimental_context: { settlegridKey: 'sg_live_abc' } })
    expect(receivedArgs).toEqual([input])
    // Reference is preserved too (no defensive clone at the adapter layer):
    expect(receivedArgs[0]).toBe(input)
  })

  it('passes the extracted apiKey via headers.x-api-key to sg.wrap', async () => {
    const execute = async () => ({ ok: true })
    const wrapped = wrapAiTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })

    await wrapped(
      { q: 'x' },
      { experimental_context: { settlegridKey: 'sg_live_XYZ' } },
    )

    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_XYZ' } },
    )
  })
})

// ─── 5. Wrap-time option validation (TypeError before any work) ───────────

describe('wrapAiTool — wrap-time option validation', () => {
  it('throws TypeError when options is missing entirely', () => {
    expect(() =>
      wrapAiTool(async () => 'ok', undefined as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options.*required/)
  })

  it('throws TypeError when toolSlug is missing', () => {
    expect(() =>
      // @ts-expect-error — missing required field
      wrapAiTool(async () => 'ok', { pricing: { defaultCostCents: 1 } }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError when toolSlug is empty string', () => {
    expect(() =>
      wrapAiTool(async () => 'ok', {
        toolSlug: '',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError when pricing is missing', () => {
    expect(() =>
      // @ts-expect-error — missing required field
      wrapAiTool(async () => 'ok', { toolSlug: 'my-tool' }),
    ).toThrowError(/pricing/)
  })
})

// ─── 6. Public API shape ─────────────────────────────────────────────────

describe('wrapAiTool — public API shape', () => {
  it('returns a function matching the Vercel AI SDK execute signature', () => {
    const wrapped = wrapAiTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    expect(typeof wrapped).toBe('function')
    // Vercel AI SDK's tool execute is `(args, options) => Promise<result>`
    // — two params.
    expect(wrapped.length).toBe(2)
  })

  it('is async-safe — returns a Promise', async () => {
    const wrapped = wrapAiTool(() => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const result = wrapped(
      {},
      { experimental_context: { settlegridKey: 'sg_live_abc' } },
    )
    expect(result).toBeInstanceOf(Promise)
    await expect(result).resolves.toBe('ok')
  })
})
