/**
 * P2.FMT2 — wrapMastraTool unit tests.
 *
 * Mocks @settlegrid/mcp so the adapter is tested in isolation. The
 * underlying billing pipeline is tested in the @settlegrid/mcp
 * package; here we verify:
 *
 *   - settlegridKey extraction from both RuntimeContext-class and
 *     plain-object shapes.
 *   - Missing / empty keys throw InvalidKeyError (→ 401).
 *   - InsufficientCreditsError from sg.wrap propagates (→ 402).
 *   - Options forwarding (toolSlug, pricing, method) to settlegrid.init
 *     and sg.wrap.
 *   - Wrap-time option validation (TypeError with actionable messages).
 *   - Header-injection defense (CRLF / control chars / non-ASCII).
 *
 * ## Mastra execute shape note (P2.FMT2 spec-diff)
 *
 * The adapter's returned function takes a single destructured
 * argument: `({ context, runtimeContext, mastra? }) => result`. All
 * tests pass an input like `{ context: { q: 'hello' }, runtimeContext }`
 * — NOT the earlier `(input, { runtimeContext })` two-arg shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted so the mock factory can reference these bindings.
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

import { wrapMastraTool, type MastraExecuteInput } from '../index'

beforeEach(() => {
  mockWrap.mockReset()
  mockInit.mockReset()
  mockInit.mockImplementation(() => {
    const wrapFn = vi.fn((execute: (input: unknown) => unknown, _opts: unknown) => {
      return async (input: unknown, context: { headers?: Record<string, string> }) => {
        mockWrap(input, context)
        return execute(input)
      }
    })
    return { wrap: wrapFn }
  })
})

// ─── A canonical RuntimeContext mock matching Mastra's class shape ───────
class MockRuntimeContext {
  private store = new Map<string, unknown>()
  set(key: string, value: unknown): this {
    this.store.set(key, value)
    return this
  }
  get(key: string): unknown {
    return this.store.get(key)
  }
}

// ─── 1. Happy path ─────────────────────────────────────────────────────────

describe('wrapMastraTool — happy path', () => {
  it('returns the execute result when runtimeContext carries a valid key', async () => {
    const execute = vi.fn(async (args: { q: string }) => ({ results: [args.q] }))
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 2 },
    })

    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')

    const result = await wrapped({ context: { q: 'hello' }, runtimeContext })
    expect(result).toEqual({ results: ['hello'] })
    expect(execute).toHaveBeenCalledWith({ q: 'hello' })
  })

  it('supports the plain-object runtimeContext shape too', async () => {
    const execute = vi.fn(async () => ({ ok: true }))
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const result = await wrapped({
      context: { q: 'x' },
      runtimeContext: { settlegridKey: 'sg_live_abc' },
    })
    expect(result).toEqual({ ok: true })
  })
})

// ─── 2. Missing / empty key → InvalidKeyError (401) ───────────────────────

describe('wrapMastraTool — missing key (401 bucket)', () => {
  const execute = vi.fn(async () => ({ ok: true }))

  it('throws InvalidKeyError when runtimeContext is undefined', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(wrapped({ context: { q: 'x' } })).rejects.toMatchObject({
      code: 'INVALID_KEY',
      statusCode: 401,
    })
  })

  it('throws InvalidKeyError when runtimeContext.get returns undefined', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: new MockRuntimeContext() }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('throws InvalidKeyError when plain-object runtimeContext lacks settlegridKey', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: { other: 'field' } }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('throws InvalidKeyError when settlegridKey is empty string', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', '')
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('throws InvalidKeyError when settlegridKey is not a string', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 12345)
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('error message references runtimeContext explicitly', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    try {
      await wrapped({ context: { q: 'x' } })
      expect.unreachable('should throw')
    } catch (err) {
      expect((err as Error).message).toContain('runtimeContext')
      expect((err as Error).message).toContain('settlegridKey')
    }
  })

  it('does NOT call execute when key is missing (no wasted work)', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const callsBefore = execute.mock.calls.length
    await wrapped({ context: { q: 'x' } }).catch(() => {})
    expect(execute.mock.calls.length).toBe(callsBefore)
  })

  it('does not crash when runtimeContext.get throws (defective context)', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const defective = {
      get: () => {
        throw new Error('context internal failure')
      },
    }
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: defective }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })
})

// ─── 3. Insufficient credits → InsufficientCreditsError (402) ─────────────

describe('wrapMastraTool — insufficient credits (402 bucket)', () => {
  it('propagates InsufficientCreditsError from sg.wrap', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw new MockInsufficientCreditsError('balance 0c, required 5c')
      },
    }))

    const wrapped = wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')
    await expect(
      wrapped({ context: { q: 'hello' }, runtimeContext }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 })
  })

  it('propagates the original error — does not swallow or rewrap', async () => {
    const original = new MockInsufficientCreditsError('balance 0c, required 5c')
    mockInit.mockImplementationOnce(() => ({
      wrap: () => async () => {
        throw original
      },
    }))
    const wrapped = wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 5 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')
    let caught: unknown
    try {
      await wrapped({ context: { q: 'hello' }, runtimeContext })
    } catch (err) {
      caught = err
    }
    expect(caught).toBe(original)
  })
})

// ─── 4. Options + args forwarding ─────────────────────────────────────────

describe('wrapMastraTool — options + args forwarding', () => {
  it('forwards toolSlug + pricing to settlegrid.init', () => {
    wrapMastraTool(async () => 'ok', {
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
    wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
      method: 'expensive-op',
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {
      method: 'expensive-op',
    })
  })

  it('omits method in WrapOptions when not provided', () => {
    const instance = { wrap: vi.fn(() => async () => 'ok') }
    mockInit.mockImplementationOnce(() => instance)
    wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    expect(instance.wrap).toHaveBeenCalledWith(expect.any(Function), {})
  })

  it('forwards context (as input) to the execute function without mutation', async () => {
    const receivedArgs: unknown[] = []
    const execute = async (args: { q: string; count: number }) => {
      receivedArgs.push(args)
      return { ok: true }
    }
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const input = { q: 'hello', count: 3 }
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')
    await wrapped({ context: input, runtimeContext })
    expect(receivedArgs).toEqual([input])
    // Reference-equal: the wrapper doesn't clone.
    expect(receivedArgs[0]).toBe(input)
  })

  it('passes the extracted apiKey via headers.x-api-key to sg.wrap', async () => {
    const wrapped = wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_XYZ')
    await wrapped({ context: { q: 'x' }, runtimeContext })
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_XYZ' } },
    )
  })

  it('ignores extra Mastra fields (threadId, resourceId, mastra) without crashing', async () => {
    const wrapped = wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')
    await expect(
      wrapped({
        context: { q: 'x' },
        runtimeContext,
        threadId: 'thread-1',
        resourceId: 'resource-2',
        mastra: { internal: 'instance' },
      }),
    ).resolves.toEqual({ ok: true })
  })
})

// ─── 5. Wrap-time option validation ──────────────────────────────────────

describe('wrapMastraTool — wrap-time option validation', () => {
  it('throws TypeError when options is missing entirely', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', undefined as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options.*required/)
  })

  it('throws TypeError when options is an array', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', [] as unknown as {
        toolSlug: string
        pricing: { defaultCostCents: number }
      }),
    ).toThrowError(/options.*object/)
  })

  it('throws TypeError when toolSlug is missing', () => {
    expect(() =>
      // @ts-expect-error — missing required field
      wrapMastraTool(async () => 'ok', { pricing: { defaultCostCents: 1 } }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError when toolSlug is empty string', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', {
        toolSlug: '',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError for whitespace-only toolSlug', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', {
        toolSlug: '   ',
        pricing: { defaultCostCents: 1 },
      }),
    ).toThrowError(/toolSlug/)
  })

  it('throws TypeError when pricing is missing', () => {
    expect(() =>
      // @ts-expect-error — missing required field
      wrapMastraTool(async () => 'ok', { toolSlug: 'my-tool' }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError when pricing is an array', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', {
        toolSlug: 'my-tool',
        // @ts-expect-error — arrays shouldn't match PricingConfig
        pricing: [],
      }),
    ).toThrowError(/pricing/)
  })

  it('throws TypeError for empty-string method', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
        method: '',
      }),
    ).toThrowError(/method/)
  })

  it('throws TypeError for non-string method', () => {
    expect(() =>
      wrapMastraTool(async () => 'ok', {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
        method: 42 as unknown as string,
      }),
    ).toThrowError(/method/)
  })
})

// ─── 6. Public API shape ─────────────────────────────────────────────────

describe('wrapMastraTool — public API shape', () => {
  it('returns a function with arity 1 (matches Mastra createTool execute signature)', () => {
    const wrapped = wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    expect(typeof wrapped).toBe('function')
    // Mastra's execute is ({context, runtimeContext, mastra}) => result
    // — a single destructured parameter. arity = 1.
    expect(wrapped.length).toBe(1)
  })

  it('always returns a Promise (even when execute is sync)', async () => {
    const wrapped = wrapMastraTool(() => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc')
    const p = wrapped({ context: {}, runtimeContext })
    expect(p).toBeInstanceOf(Promise)
    await expect(p).resolves.toBe('ok')
  })
})

// ─── 7. Header-injection defense ─────────────────────────────────────────

describe('wrapMastraTool — settlegridKey format validation', () => {
  const execute = vi.fn(async () => ({ ok: true }))

  beforeEach(() => execute.mockClear())

  const injectionPayloads = [
    ['CRLF', 'sg_live_valid\r\nEvil-Header: x'],
    ['LF', 'sg_live_valid\nEvil-Header: x'],
    ['CR', 'sg_live_valid\rEvil-Header: x'],
    ['NUL byte', 'sg_live_valid\x00xxx'],
    ['DEL', 'sg_live_valid\x7F'],
    ['Unicode mathematical', '𝐬𝐠_𝐥𝐢𝐯𝐞_xyz'],
    ['emoji', 'sg_live_🔑xyz'],
  ] as const

  it.each(injectionPayloads)(
    'rejects %s in RuntimeContext settlegridKey',
    async (_label, badKey) => {
      const wrapped = wrapMastraTool(execute, {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
      })
      const runtimeContext = new MockRuntimeContext()
      runtimeContext.set('settlegridKey', badKey)
      await expect(
        wrapped({ context: { q: 'x' }, runtimeContext }),
      ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
      expect(execute).not.toHaveBeenCalled()
    },
  )

  it.each(injectionPayloads)(
    'rejects %s in plain-object settlegridKey',
    async (_label, badKey) => {
      const wrapped = wrapMastraTool(execute, {
        toolSlug: 'my-tool',
        pricing: { defaultCostCents: 1 },
      })
      await expect(
        wrapped({ context: { q: 'x' }, runtimeContext: { settlegridKey: badKey } }),
      ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
      expect(execute).not.toHaveBeenCalled()
    },
  )

  it('rejects an array as runtimeContext', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: [] }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('accepts well-formed sg_live_* keys via RuntimeContext', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_abc123XYZ_789')
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepts well-formed sg_live_* keys via plain object', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({
        context: { q: 'x' },
        runtimeContext: { settlegridKey: 'sg_live_plain_object' },
      }),
    ).resolves.toEqual({ ok: true })
  })
})

// ─── 8. Hostile-review L1: whitespace trimming on settlegridKey ──────────

describe('wrapMastraTool — L1 fix: whitespace-tolerant key extraction', () => {
  const execute = vi.fn(async () => ({ ok: true }))

  beforeEach(() => execute.mockClear())

  it('trims leading whitespace before forwarding to x-api-key', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: (userExecute: (input: unknown) => unknown) =>
        async (input: unknown, ctx: { headers?: Record<string, string> }) => {
          mockWrap(input, ctx)
          return userExecute(input)
        },
    }))
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', '   sg_live_abc')
    await wrapped({ context: { q: 'x' }, runtimeContext })
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_abc' } },
    )
  })

  it('trims trailing whitespace', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: (userExecute: (input: unknown) => unknown) =>
        async (input: unknown, ctx: { headers?: Record<string, string> }) => {
          mockWrap(input, ctx)
          return userExecute(input)
        },
    }))
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped({
      context: { q: 'x' },
      runtimeContext: { settlegridKey: 'sg_live_abc   ' },
    })
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_abc' } },
    )
  })

  it('trims both leading and trailing whitespace', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: (userExecute: (input: unknown) => unknown) =>
        async (input: unknown, ctx: { headers?: Record<string, string> }) => {
          mockWrap(input, ctx)
          return userExecute(input)
        },
    }))
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await wrapped({
      context: { q: 'x' },
      runtimeContext: { settlegridKey: '\t sg_live_abc \n' },
    })
    expect(mockWrap).toHaveBeenCalledWith(
      { q: 'x' },
      { headers: { 'x-api-key': 'sg_live_abc' } },
    )
  })

  it('rejects whitespace-only key as InvalidKeyError', async () => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', '   ')
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })
})

// ─── 9. Hostile-review L2: precedence when both .get and .settlegridKey ──

describe('wrapMastraTool — L2 pin: .get method takes precedence over .settlegridKey', () => {
  it('uses .get() when both .get method and .settlegridKey property exist', async () => {
    mockInit.mockImplementationOnce(() => ({
      wrap: (_execute: unknown) =>
        async (_input: unknown, ctx: { headers?: Record<string, string> }) => {
          mockWrap(null, ctx)
          return 'ok'
        },
    }))
    const wrapped = wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    // An unusual runtimeContext with both surfaces. The .get method
    // wins (Mastra-canonical path). The .settlegridKey field is
    // ignored.
    const contextWithBoth = {
      get: (k: string) => (k === 'settlegridKey' ? 'sg_live_from_get' : undefined),
      settlegridKey: 'sg_live_from_property',
    }
    await wrapped({ context: { q: 'x' }, runtimeContext: contextWithBoth })
    expect(mockWrap).toHaveBeenCalledWith(
      null,
      { headers: { 'x-api-key': 'sg_live_from_get' } },
    )
  })
})

// ─── 10. Hostile-review L3: Proxy with throwing `has` trap ───────────────

describe('wrapMastraTool — L3 fix: defensive against throwing Proxy `has` trap', () => {
  it('does not crash when `in` probe throws', async () => {
    // Construct a proxy whose `has` trap throws — an evil context.
    // The adapter should degrade gracefully (reject with
    // InvalidKeyError) instead of propagating the throw.
    const evilProxy = new Proxy(
      {},
      {
        has() {
          throw new Error('has trap crashed')
        },
      },
    )
    const wrapped = wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: evilProxy }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })
})

// ─── 11. Hostile-review L4: primitive runtimeContext values ──────────────

describe('wrapMastraTool — L4 coverage: primitive runtimeContext values', () => {
  const execute = vi.fn(async () => ({ ok: true }))

  it.each([
    ['string', 'sg_live_abc'],
    ['number', 42],
    ['boolean true', true],
    ['boolean false', false],
    ['bigint', BigInt(100)],
    ['symbol', Symbol('x')],
  ] as const)('rejects %s as runtimeContext', async (_label, value) => {
    const wrapped = wrapMastraTool(execute, {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: value as unknown }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })
})

// ─── 12. Hostile-review L5: native Map instance as runtimeContext ────────

describe('wrapMastraTool — L5 coverage: native Map instance works as runtimeContext', () => {
  it('accepts a native Map with settlegridKey set', async () => {
    const wrapped = wrapMastraTool(async (input: { q: string }) => ({ got: input.q }), {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new Map<string, unknown>([
      ['settlegridKey', 'sg_live_map_abc'],
    ])
    await expect(
      wrapped({ context: { q: 'hello' }, runtimeContext }),
    ).resolves.toEqual({ got: 'hello' })
  })

  it('rejects an empty Map (no settlegridKey)', async () => {
    const wrapped = wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext: new Map() }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })

  it('rejects a Map whose settlegridKey value is not a string', async () => {
    const wrapped = wrapMastraTool(async () => 'ok', {
      toolSlug: 'my-tool',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = new Map<string, unknown>([['settlegridKey', 42]])
    await expect(
      wrapped({ context: { q: 'x' }, runtimeContext }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY', statusCode: 401 })
  })
})

// ─── Type export sanity check ────────────────────────────────────────────

describe('type exports', () => {
  it('MastraExecuteInput<TInput> accepts a RuntimeContext-shaped object', () => {
    const opts: MastraExecuteInput<{ q: string }> = {
      context: { q: 'x' },
      runtimeContext: new MockRuntimeContext(),
    }
    expect(opts.context).toEqual({ q: 'x' })
  })

  it('MastraExecuteInput<TInput> accepts plain-object runtimeContext', () => {
    const opts: MastraExecuteInput<{ q: string }> = {
      context: { q: 'x' },
      runtimeContext: { settlegridKey: 'sg_live_abc' },
    }
    expect(opts.runtimeContext).toBeDefined()
  })

  it('MastraExecuteInput<TInput> accepts extra pass-through fields', () => {
    const opts: MastraExecuteInput<{ q: string }> = {
      context: { q: 'x' },
      runtimeContext: {},
      threadId: 'thread-1',
      resourceId: 'resource-2',
    }
    expect(opts.threadId).toBe('thread-1')
  })
})
