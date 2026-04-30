/**
 * P2.FMT1 test close-out — coverage fill.
 *
 * Covers paths the scaffold / spec-diff / hostile passes left untested:
 *
 *   - Public API surface pinning (accidental-removal tripwire).
 *   - Execute-function signature variants (sync return, async return,
 *     thenable).
 *   - Independence + concurrency (multiple wrapAiTool calls, parallel
 *     wrapper invocations, no shared state).
 *   - Full v5 options fields pass through without breakage even when
 *     the wrapper ignores toolCallId / messages / abortSignal.
 *
 * Uses the same vi.hoisted + vi.mock pattern as wrap-ai-tool.test.ts
 * so the adapter is exercised in isolation.
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

beforeEach(() => {
  mockInit.mockReset()
  // Default: init returns an instance whose wrap() produces a billed
  // function that passes args through to the provided execute. Tests
  // that want different behavior override via mockInit.mockImplementationOnce.
  mockInit.mockImplementation(() => ({
    wrap: (execute: (args: unknown) => unknown) =>
      async (args: unknown, ctx: { headers?: Record<string, string> }) => {
        if (!ctx?.headers?.['x-api-key']) {
          throw new MockInvalidKeyError('no key')
        }
        return execute(args)
      },
  }))
})

// ─── 1. Public API pinning ────────────────────────────────────────────────

describe('@settlegrid/ai-sdk — public API pinning', () => {
  // Mirrors the packages/mcp exports.test.ts pattern: every export is
  // referenced here so an accidental removal during refactor fails a
  // specific, readable test.

  it('exports wrapAiTool as a function', () => {
    expect(typeof mod.wrapAiTool).toBe('function')
  })

  it('does NOT export a default — only named exports', () => {
    // Consumers should use `import { wrapAiTool } from '@settlegrid/ai-sdk'`.
    // If we accidentally ship a default export, imports like
    // `import wrap from '@settlegrid/ai-sdk'` would start working and
    // bind to an unintended shape.
    expect((mod as { default?: unknown }).default).toBeUndefined()
  })

  it('type exports: WrapAiToolOptions shape accepts all 3 documented fields', () => {
    // Use-site typecheck. If any field is removed from the type,
    // this file fails to compile.
    const opts: mod.WrapAiToolOptions = {
      toolSlug: 's',
      pricing: { defaultCostCents: 1 },
      method: 'm',
    }
    expect(opts.toolSlug).toBe('s')
    expect(opts.method).toBe('m')
  })

  it('type exports: AiToolExecuteOptions carries the v5 subset', () => {
    const opts: mod.AiToolExecuteOptions = {
      experimental_context: { settlegridKey: 'sg_live_x' },
      abortSignal: new AbortController().signal,
      toolCallId: 'call_123',
      messages: [],
    }
    expect(opts.toolCallId).toBe('call_123')
  })

  it('type exports: AiToolExecute is a 2-arg function type', () => {
    const fn: mod.AiToolExecute<{ q: string }, { ok: boolean }> = async (
      _args,
      _opts,
    ) => ({ ok: true })
    expect(typeof fn).toBe('function')
    expect(fn.length).toBe(2)
  })
})

// ─── 2. Execute-function signature variants ──────────────────────────────

describe('wrapAiTool — execute function signature variants', () => {
  it('supports async execute returning a Promise', async () => {
    const wrapped = mod.wrapAiTool(async () => ({ mode: 'async' }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_x' } }),
    ).resolves.toEqual({ mode: 'async' })
  })

  it('supports sync execute returning a plain value', async () => {
    // sg.wrap's underlying middleware accepts sync handlers; the
    // adapter must not force-await on a sync return in a way that
    // breaks the Promise chain. The returned wrapper always returns
    // a Promise (per AiToolExecute's contract).
    const wrapped = mod.wrapAiTool(() => ({ mode: 'sync' }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const promise = wrapped(
      {},
      { experimental_context: { settlegridKey: 'sg_live_x' } },
    )
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).resolves.toEqual({ mode: 'sync' })
  })

  it('supports execute returning a thenable (non-Promise but Promise-like)', async () => {
    // Deliberately construct a minimal thenable to exercise the
    // `PromiseLike<TResult> | TResult` union in the execute type.
    const thenable = {
      then: <R>(onFulfilled: (value: { mode: string }) => R) =>
        onFulfilled({ mode: 'thenable' }),
    }
    const wrapped = mod.wrapAiTool(
      () => thenable as unknown as { mode: string },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    const result = await wrapped(
      {},
      { experimental_context: { settlegridKey: 'sg_live_x' } },
    )
    expect(result).toEqual({ mode: 'thenable' })
  })

  it('propagates exceptions thrown synchronously from execute', async () => {
    const wrapped = mod.wrapAiTool(
      () => {
        throw new Error('sync boom')
      },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    await expect(
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_x' } }),
    ).rejects.toThrowError('sync boom')
  })

  it('propagates rejections from async execute', async () => {
    const wrapped = mod.wrapAiTool(
      async () => {
        throw new Error('async boom')
      },
      { toolSlug: 't', pricing: { defaultCostCents: 1 } },
    )
    await expect(
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_x' } }),
    ).rejects.toThrowError('async boom')
  })
})

// ─── 3. Independence + concurrency ────────────────────────────────────────

describe('wrapAiTool — independence + concurrency', () => {
  it('two wrapAiTool calls produce independent wrappers (different closures)', async () => {
    const execute1 = vi.fn(async () => ({ from: 'one' }))
    const execute2 = vi.fn(async () => ({ from: 'two' }))

    const wrapped1 = mod.wrapAiTool(execute1, {
      toolSlug: 'tool-one',
      pricing: { defaultCostCents: 1 },
    })
    const wrapped2 = mod.wrapAiTool(execute2, {
      toolSlug: 'tool-two',
      pricing: { defaultCostCents: 2 },
    })

    const ctx = { experimental_context: { settlegridKey: 'sg_live_x' } }
    const [r1, r2] = await Promise.all([wrapped1({}, ctx), wrapped2({}, ctx)])

    expect(r1).toEqual({ from: 'one' })
    expect(r2).toEqual({ from: 'two' })
    expect(execute1).toHaveBeenCalledTimes(1)
    expect(execute2).toHaveBeenCalledTimes(1)
    // And settlegrid.init was called once per wrapAiTool call — each
    // gets its own SettleGrid instance.
    expect(mockInit).toHaveBeenCalledTimes(2)
  })

  it('parallel invocations of the same wrapper do not share state', async () => {
    // Counter + args to prove each call is independent.
    let callCount = 0
    const argsSeen: unknown[] = []
    const execute = async (args: { idx: number }) => {
      callCount++
      argsSeen.push(args)
      await new Promise((resolve) => setTimeout(resolve, 5))
      return { echoed: args.idx, callCount }
    }

    const wrapped = mod.wrapAiTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const ctx = { experimental_context: { settlegridKey: 'sg_live_x' } }

    const results = await Promise.all([
      wrapped({ idx: 1 }, ctx),
      wrapped({ idx: 2 }, ctx),
      wrapped({ idx: 3 }, ctx),
    ])

    // Each call received its own args; the echo fields prove args
    // weren't cross-wired across concurrent invocations.
    expect(results.map((r) => r.echoed).sort()).toEqual([1, 2, 3])
    expect(argsSeen).toHaveLength(3)
    expect(callCount).toBe(3)
  })

  it('different settlegridKey values are routed through to the billed function', async () => {
    // Capture the headers each concurrent call passes to billed.
    const seenHeaders: Array<Record<string, string> | undefined> = []
    mockInit.mockImplementationOnce(() => ({
      wrap: (execute: (args: unknown) => unknown) =>
        async (args: unknown, ctx: { headers?: Record<string, string> }) => {
          seenHeaders.push(ctx?.headers)
          return execute(args)
        },
    }))

    const wrapped = mod.wrapAiTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await Promise.all([
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_A' } }),
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_B' } }),
      wrapped({}, { experimental_context: { settlegridKey: 'sg_live_C' } }),
    ])

    const keys = seenHeaders.map((h) => h?.['x-api-key']).sort()
    expect(keys).toEqual(['sg_live_A', 'sg_live_B', 'sg_live_C'])
  })
})

// ─── 4. Full v5 options pass-through ─────────────────────────────────────

describe('wrapAiTool — full v5 options pass-through', () => {
  // The adapter currently ignores toolCallId, messages, and
  // abortSignal (see the P2.FMT1 scope note in the JSDoc). These
  // tests pin that "ignoring" means "doesn't crash when present" —
  // v5 WILL pass these fields on every invocation, and a regression
  // that tried to read a field the SDK didn't provide would surface
  // here.

  it('accepts a call with every v5 field populated', async () => {
    const wrapped = mod.wrapAiTool(async (args: { q: string }) => ({ ok: args.q }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const result = await wrapped(
      { q: 'hi' },
      {
        experimental_context: { settlegridKey: 'sg_live_x' },
        toolCallId: 'call_xyz_789',
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
        abortSignal: new AbortController().signal,
      },
    )
    expect(result).toEqual({ ok: 'hi' })
  })

  it('accepts a pre-aborted abortSignal (today just ignored — scope note)', async () => {
    // P2.FMT1 scope: abort propagation is deferred to P3. Today the
    // wrapper runs the handler to completion regardless of signal
    // state. This test pins that behavior so a future implementation
    // that adds abort-propagation surfaces as a test-update.
    const controller = new AbortController()
    controller.abort()
    const wrapped = mod.wrapAiTool(async () => ({ ran: true }), {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    const result = await wrapped(
      {},
      {
        experimental_context: { settlegridKey: 'sg_live_x' },
        abortSignal: controller.signal,
      },
    )
    expect(result).toEqual({ ran: true })
  })

  it('extra fields on experimental_context (beyond settlegridKey) are ignored', async () => {
    const wrapped = mod.wrapAiTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    await expect(
      wrapped(
        {},
        {
          experimental_context: {
            settlegridKey: 'sg_live_x',
            requestId: 'req-42',
            userAgent: 'test',
          },
        },
      ),
    ).resolves.toBe('ok')
  })
})

// ─── 5. Settlegrid.init wiring + invocation path ────────────────────────

describe('wrapAiTool — settlegrid.init + wrap wiring', () => {
  it('settlegrid.init is called exactly once per wrapAiTool call (not per invocation)', async () => {
    const execute = async () => 'ok'
    const wrapped = mod.wrapAiTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })

    // After wrapAiTool: init called once.
    const initCallsAfterWrap = mockInit.mock.calls.length

    // Call wrapped() 5 times: init should NOT be called again.
    const ctx = { experimental_context: { settlegridKey: 'sg_live_x' } }
    await Promise.all([
      wrapped({}, ctx),
      wrapped({}, ctx),
      wrapped({}, ctx),
      wrapped({}, ctx),
      wrapped({}, ctx),
    ])
    expect(mockInit.mock.calls.length).toBe(initCallsAfterWrap)
  })

  it('sg.wrap is called exactly once per wrapAiTool call', () => {
    const wrapFn = vi.fn(() => async () => 'ok')
    mockInit.mockImplementationOnce(() => ({ wrap: wrapFn }))

    mod.wrapAiTool(async () => 'ok', {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    expect(wrapFn).toHaveBeenCalledTimes(1)
  })

  it('passes the original execute (not a rewrapped version) to sg.wrap', () => {
    const wrapFn = vi.fn(() => async () => 'ok')
    mockInit.mockImplementationOnce(() => ({ wrap: wrapFn }))

    const execute = async () => 'ok'
    mod.wrapAiTool(execute, {
      toolSlug: 't',
      pricing: { defaultCostCents: 1 },
    })
    // First positional arg to sg.wrap is the user's execute function
    // by reference — we don't clone/rewrap it. Use toHaveBeenCalledWith
    // to get reference-equality semantics without tuple-index TS drama.
    expect(wrapFn).toHaveBeenCalledWith(execute, {})
  })
})
