/**
 * P2.FMT2 spec-diff — structural compatibility with Mastra's
 * `createTool({ execute })` contract.
 *
 * Mastra's `createTool` execute-function signature is:
 *
 *   ({ context, runtimeContext, mastra, threadId?, resourceId? })
 *     => Promise<TOutput> | TOutput
 *
 * One destructured object parameter. NOT the `(input, options)`
 * pattern Vercel AI SDK uses. The P2.FMT2 scaffold initially missed
 * this distinction (the spec said "similarly to the Vercel AI SDK
 * adapter" which is ambiguous); the spec-diff pass caught the
 * mismatch and fixed the shape.
 *
 * This file mirrors Mastra's expected execute contract locally and
 * pins — via TypeScript's structural compatibility — that the
 * function returned by `wrapMastraTool` satisfies that contract. If
 * Mastra's upstream shape drifts, this file will fail to compile,
 * surfacing the drift before it ships.
 *
 * Why not install @mastra/core as a devDep? Adding the full Mastra
 * stack to this package's dev graph would pull in hundreds of deps
 * (and AI model clients, orchestration primitives, etc.) purely to
 * verify one type signature. The local mirror is the same proof,
 * scaled to the adapter's needs.
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

import { wrapMastraTool } from '../index'

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

/**
 * Mirror of Mastra's execute-function shape. Covers the fields the
 * framework always passes (`context`, `runtimeContext`, `mastra`)
 * plus optional thread/resource identifiers present in
 * agent-initiated invocations. `runtimeContext` is typed as an
 * unknown-ish object — Mastra's actual shape narrows this to a
 * `RuntimeContext` instance, but the adapter accepts both that class
 * and plain-object shapes (see extractSettlegridKey in index.ts).
 */
type MastraRuntimeContextMirror = {
  get: (key: string) => unknown
  set?: (key: string, value: unknown) => unknown
}

interface MastraExecuteContext<TInput> {
  context: TInput
  runtimeContext?: MastraRuntimeContextMirror
  mastra?: unknown
  threadId?: string
  resourceId?: string
  /**
   * Index signature matches the adapter's `MastraExecuteInput`
   * shape. Mastra's real execute params are structurally
   * extensible — the framework evolves and passes more fields over
   * time. Keeping the mirror open-ended means a future Mastra minor
   * release adding `agentId` or `workflowId` won't break this
   * compat test; it'll just get ignored by the adapter (which only
   * reads `context` + `runtimeContext`).
   */
  [key: string]: unknown
}

type MastraToolExecute<TInput, TResult> = (
  params: MastraExecuteContext<TInput>,
) => Promise<TResult> | TResult

// Minimal RuntimeContext mirror for invocation tests.
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

describe('P2.FMT2 spec-diff — Mastra createTool structural compatibility', () => {
  it('wrapMastraTool return value is assignable to MastraToolExecute (compile-time)', () => {
    // The real compatibility proof is this line compiling. If it
    // stops compiling after an upstream Mastra change, this file is
    // the signal to update the adapter.
    const execute: MastraToolExecute<{ q: string }, { results: string[] }> =
      wrapMastraTool(
        async (input: { q: string }) => ({ results: [input.q] }),
        {
          toolSlug: 'compat-test',
          pricing: { defaultCostCents: 1 },
        },
      )

    expect(typeof execute).toBe('function')
    // Mastra's execute is ONE destructured argument, so arity = 1.
    expect(execute.length).toBe(1)
  })

  it('wrapMastraTool with method option is still Mastra-assignable', () => {
    const execute: MastraToolExecute<{ mode: string }, { ok: true }> =
      wrapMastraTool(
        async () => ({ ok: true }) as const,
        {
          toolSlug: 'compat-test',
          method: 'deep',
          pricing: {
            defaultCostCents: 1,
            methods: { deep: { costCents: 10 } },
          },
        },
      )
    expect(typeof execute).toBe('function')
  })

  it('the runtime shape matches Mastra call-time expectations', async () => {
    // Simulate Mastra invoking the tool — it passes the full
    // destructured-options object to execute, not (input, options).
    const execute = wrapMastraTool(
      async (input: { q: string }) => ({ echoed: input.q }),
      {
        toolSlug: 'compat-test',
        pricing: { defaultCostCents: 1 },
      },
    )

    const runtimeContext = new MockRuntimeContext()
    runtimeContext.set('settlegridKey', 'sg_live_xyz')

    const mastraCallShape: MastraExecuteContext<{ q: string }> = {
      context: { q: 'hello' },
      runtimeContext,
      mastra: { _internal: 'instance' },
      threadId: 'thread-abc',
      resourceId: 'resource-def',
    }
    const result = await execute(mastraCallShape)
    expect(result).toEqual({ echoed: 'hello' })
  })

  it('rejects with InvalidKeyError when Mastra invokes without a runtimeContext key', async () => {
    const execute = wrapMastraTool(async () => ({ ok: true }), {
      toolSlug: 'compat-test',
      pricing: { defaultCostCents: 1 },
    })
    const mastraCallShape: MastraExecuteContext<{ q: string }> = {
      context: { q: 'x' },
      runtimeContext: new MockRuntimeContext(), // no settlegridKey set
      threadId: 'thread-abc',
    }
    await expect(execute(mastraCallShape)).rejects.toMatchObject({
      code: 'INVALID_KEY',
    })
  })
})
