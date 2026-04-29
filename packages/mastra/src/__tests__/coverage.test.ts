/**
 * P2.FMT2 test close-out — coverage fill.
 *
 * Mirrors packages/ai-sdk/src/__tests__/coverage.test.ts: closes the
 * same class of gaps for the Mastra adapter.
 *
 *   - Public API surface pinning (accidental-removal tripwire).
 *   - Execute-function signature variants (sync / async / thenable /
 *     throws-sync / rejects-async).
 *   - Independence + concurrency (multiple wrapMastraTool calls,
 *     parallel wrapper invocations, no shared state).
 *   - Full Mastra options fields pass through even though the
 *     adapter ignores most of them.
 *   - settlegrid.init + wrap wiring cardinality pins (init once per
 *     wrapMastraTool, not per-invocation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInit, MockInvalidKeyError, MockInsufficientCreditsError } = vi.hoisted(
  () => {
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
      mockInit: vi.fn(),
      MockInvalidKeyError: _MockInvalidKeyError,
      MockInsufficientCreditsError: _MockInsufficientCreditsError,
    }
  },
)

vi.mock('@settlegrid/mcp', () => ({
  settlegrid: {
    version: '0.2.0',
    init: (opts: unknown) => mockInit(opts),
    extractApiKey: vi.fn(),
  },
  InvalidKeyError: MockInvalidKeyError,
  InsufficientCreditsError: MockInsufficientCreditsError,
}))

import * as mod from '../index'

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

function makeCtx(key = 'sg_live_x') {
  const rc = new MockRuntimeContext()
  rc.set('settlegridKey', key)
  return rc
}

beforeEach(() => {
  mockInit.mockReset()
  mockInit.mockImplementation(() => ({
    wrap: (execute: (input: unknown) => unknown) =>
      async (input: unknown, ctx: { headers?: Record<string, string> }) => {
        if (!ctx?.headers?.['x-api-key']) {
          throw new MockInvalidKeyError('no key')
        }
        return execute(input)
      },
  }))
})

// ─── 1. Public API pinning ────────────────────────────────────────────────

describe('@settlegrid/mastra — public API pinning', () => {
  // Mirrors packages/mcp/exports.test.ts + packages/ai-sdk/coverage.test.ts.
  // Every export is referenced here so an accidental removal during
  // refactor fails a specific, readable test.

  it('exports wrapMastraTool as a function', () => {
    expect(typeof mod.wrapMastraTool).toBe('function')
  })

  it('does NOT export a default — only named exports', () => {
    // Consumers should use `import { wrapMastraTool } from '@settlegrid/mastra'`.
    expect((mod as { default?: unknown }).default).toBeUndefined()
  })

  it('type exports: WrapMastraToolOptions accepts all 3 documented fields', () => {
    const opts: mod.WrapMastraToolOptions = {
      toolSlug: 's',
      pricing: { defaultCostCents: 1 },
      method: 'm',
    }
    expect(opts.toolSlug).toBe('s')
    expect(opts.method).toBe('m')
  })

  it('type exports: MastraExecuteInput carries the canonical Mastra shape', () => {
    const opts: mod.MastraExecuteInput<{ q: string }> = {
      context: { q: 'hello' },
      runtimeContext: new MockRuntimeContext(),
      mastra: { internal: 'instance' },
      threadId: 'thread-1',
      resourceId: 'resource-2',
    }
    expect(opts.context.q).toBe('hello')
    expect(opts.threadId).toBe('thread-1')
  })

  it('type exports: MastraToolExecute is a 1-arg function type (Mastra single-destructured-param contract)', () => {
    const fn: mod.MastraToolExecute<{ q: string }, { ok: boolean }> = async ({
      context: _context,
    }) => ({ ok: true })
    expect(typeof fn).toBe('function')
    expect(fn.length).toBe(1)
  })
})

// ─── 2. Execute-function signature variants ──────────────────────────────

describe('wrapMastraTool — execute function signature variants', () => {
  it('supports async execute returning a Promise', async () => {
    const wrapped = mod.wrapMastraTool(async () => ({ mode: 'async' }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({ context: {}, runtimeContext: makeCtx() }),
    ).resolves.toEqual({ mode: 'async' })
  })

  it('supports sync execute returning a plain value', async () => {
    const wrapped = mod.wrapMastraTool(() => ({ mode: 'sync' }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const promise = wrapped({ context: {}, runtimeContext: makeCtx() })
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).resolves.toEqual({ mode: 'sync' })
  })

  it('supports execute returning a thenable (non-Promise but Promise-like)', async () => {
    const thenable = {
      then: <R>(onFulfilled: (value: { mode: string }) => R) =>
        onFulfilled({ mode: 'thenable' }),
    }
    const wrapped = mod.wrapMastraTool(
      () => thenable as unknown as { mode: string },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    const result = await wrapped({ context: {}, runtimeContext: makeCtx() })
    expect(result).toEqual({ mode: 'thenable' })
  })

  it('propagates exceptions thrown synchronously from execute', async () => {
    const wrapped = mod.wrapMastraTool(
      () => {
        throw new Error('sync boom')
      },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    await expect(
      wrapped({ context: {}, runtimeContext: makeCtx() }),
    ).rejects.toThrowError('sync boom')
  })

  it('propagates rejections from async execute', async () => {
    const wrapped = mod.wrapMastraTool(
      async () => {
        throw new Error('async boom')
      },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    await expect(
      wrapped({ context: {}, runtimeContext: makeCtx() }),
    ).rejects.toThrowError('async boom')
  })
})

// ─── 3. Independence + concurrency ────────────────────────────────────────

describe('wrapMastraTool — independence + concurrency', () => {
  it('two wrapMastraTool calls produce independent wrappers (different closures)', async () => {
    const execute1 = vi.fn(async () => ({ from: 'one' }))
    const execute2 = vi.fn(async () => ({ from: 'two' }))

    const wrapped1 = mod.wrapMastraTool(execute1, {
      toolSlug: 'tool-one',
      pricing: { defaultCostCents: 1 },
    })
    const wrapped2 = mod.wrapMastraTool(execute2, {
      toolSlug: 'tool-two',
      pricing: { defaultCostCents: 2 },
    })

    const runtimeContext = makeCtx()
    const [r1, r2] = await Promise.all([
      wrapped1({ context: {}, runtimeContext }),
      wrapped2({ context: {}, runtimeContext }),
    ])

    expect(r1).toEqual({ from: 'one' })
    expect(r2).toEqual({ from: 'two' })
    expect(execute1).toHaveBeenCalledTimes(1)
    expect(execute2).toHaveBeenCalledTimes(1)
    expect(mockInit).toHaveBeenCalledTimes(2)
  })

  it('parallel invocations of the same wrapper do not share state', async () => {
    let callCount = 0
    const argsSeen: unknown[] = []
    const execute = async (args: { idx: number }) => {
      callCount++
      argsSeen.push(args)
      await new Promise((resolve) => setTimeout(resolve, 5))
      return { echoed: args.idx, callCount }
    }

    const wrapped = mod.wrapMastraTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = makeCtx()

    const results = await Promise.all([
      wrapped({ context: { idx: 1 }, runtimeContext }),
      wrapped({ context: { idx: 2 }, runtimeContext }),
      wrapped({ context: { idx: 3 }, runtimeContext }),
    ])

    expect(results.map((r) => r.echoed).sort()).toEqual([1, 2, 3])
    expect(argsSeen).toHaveLength(3)
    expect(callCount).toBe(3)
  })

  it('different settlegridKey values from different runtimeContexts route cleanly', async () => {
    const seenHeaders: Array<Record<string, string> | undefined> = []
    mockInit.mockImplementationOnce(() => ({
      wrap: (execute: (args: unknown) => unknown) =>
        async (args: unknown, ctx: { headers?: Record<string, string> }) => {
          seenHeaders.push(ctx?.headers)
          return execute(args)
        },
    }))

    const wrapped = mod.wrapMastraTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await Promise.all([
      wrapped({ context: {}, runtimeContext: makeCtx('sg_live_A') }),
      wrapped({ context: {}, runtimeContext: makeCtx('sg_live_B') }),
      wrapped({ context: {}, runtimeContext: makeCtx('sg_live_C') }),
    ])

    const keys = seenHeaders.map((h) => h?.['x-api-key']).sort()
    expect(keys).toEqual(['sg_live_A', 'sg_live_B', 'sg_live_C'])
  })
})

// ─── 4. Full Mastra options pass-through ─────────────────────────────────

describe('wrapMastraTool — full Mastra options pass-through', () => {
  // Mastra passes a bunch of fields on the execute input the adapter
  // ignores (mastra instance, threadId, resourceId, anything else the
  // framework evolves to include). Pin that extra fields don't crash
  // the wrapper.

  it('accepts a call with every canonical Mastra field populated', async () => {
    const wrapped = mod.wrapMastraTool(
      async (input: { q: string }) => ({ ok: input.q }),
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    const result = await wrapped({
      context: { q: 'hi' },
      runtimeContext: makeCtx(),
      mastra: { _internal: 'framework-instance' },
      threadId: 'thread_xyz',
      resourceId: 'resource_abc',
    })
    expect(result).toEqual({ ok: 'hi' })
  })

  it('accepts a call with forward-compat future fields (index-signature pass-through)', async () => {
    const wrapped = mod.wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({
        context: {},
        runtimeContext: makeCtx(),
        // Hypothetical future Mastra field — must not break the wrapper.
        agentId: 'agent-1',
        workflowId: 'workflow-2',
        sessionToken: 'token-3',
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('extra fields on runtimeContext (beyond settlegridKey) are ignored', async () => {
    const wrapped = mod.wrapMastraTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const runtimeContext = makeCtx()
    runtimeContext.set('unrelatedValue', 'xyz')
    runtimeContext.set('userId', 'user-42')
    await expect(
      wrapped({ context: {}, runtimeContext }),
    ).resolves.toBe('ok')
  })

  it('accepts plain-object runtimeContext with extra fields', async () => {
    const wrapped = mod.wrapMastraTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({
        context: {},
        runtimeContext: {
          settlegridKey: 'sg_live_plain',
          userId: 'user-42',
          sessionToken: 'token',
        },
      }),
    ).resolves.toBe('ok')
  })
})

// ─── 5. settlegrid.init + wrap cardinality pins ─────────────────────────

describe('wrapMastraTool — settlegrid.init + wrap cardinality', () => {
  it('settlegrid.init is called exactly once per wrapMastraTool call (not per invocation)', async () => {
    const execute = async () => 'ok'
    const wrapped = mod.wrapMastraTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const initCallsAfterWrap = mockInit.mock.calls.length

    const runtimeContext = makeCtx()
    await Promise.all([
      wrapped({ context: {}, runtimeContext }),
      wrapped({ context: {}, runtimeContext }),
      wrapped({ context: {}, runtimeContext }),
      wrapped({ context: {}, runtimeContext }),
      wrapped({ context: {}, runtimeContext }),
    ])
    expect(mockInit.mock.calls.length).toBe(initCallsAfterWrap)
  })

  it('sg.wrap is called exactly once per wrapMastraTool call', () => {
    const wrapFn = vi.fn(() => async () => 'ok')
    mockInit.mockImplementationOnce(() => ({ wrap: wrapFn }))

    mod.wrapMastraTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(wrapFn).toHaveBeenCalledTimes(1)
  })

  it('passes the original execute (not a rewrapped version) to sg.wrap', () => {
    const wrapFn = vi.fn(() => async () => 'ok')
    mockInit.mockImplementationOnce(() => ({ wrap: wrapFn }))

    const execute = async () => 'ok'
    mod.wrapMastraTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    // First positional arg to sg.wrap is the user's execute function
    // by reference — we don't clone / rewrap it.
    expect(wrapFn).toHaveBeenCalledWith(execute, {})
  })
})
