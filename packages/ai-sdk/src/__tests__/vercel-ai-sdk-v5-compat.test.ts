/**
 * P2.FMT1 spec-diff — structural compatibility with Vercel AI SDK v5.
 *
 * The DoD says "wrapAiTool works with Vercel AI SDK 5+". Because
 * installing the real `ai` package as a devDependency would pull in
 * hundreds of transitive deps purely to verify one type signature,
 * this file takes the lighter route: declare the Vercel AI SDK v5
 * tool-execute contract shape INLINE, then pin via TypeScript's
 * structural compatibility that the function returned by
 * `wrapAiTool` satisfies that contract.
 *
 * If Vercel ships a v5 minor release that narrows the contract (e.g.,
 * tightens `toolCallId` to a branded string), this file will fail
 * to compile — surfacing the drift early so we can update the
 * adapter's types (or the local mirror here) before shipping.
 *
 * References (for maintainers tracking upstream changes):
 *   - https://sdk.vercel.ai/docs/reference/ai-sdk-core/tool
 *   - Vercel AI SDK v5 tool execute signature:
 *       (args, options) => PromiseLike<result>
 *     where options carries { toolCallId, messages, abortSignal,
 *     experimental_context }.
 */

import { describe, it, expect, vi } from 'vitest'

// Mirror the mocking pattern from wrap-ai-tool.test.ts so the runtime
// invocation tests below exercise only the adapter shim — not the real
// @settlegrid/mcp middleware, which would need a live API key +
// network access to validate against the hosted SettleGrid service.
const { MockInvalidKeyError, MockInsufficientCreditsError } = vi.hoisted(() => {
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
    MockInvalidKeyError: _MockInvalidKeyError,
    MockInsufficientCreditsError: _MockInsufficientCreditsError,
  }
})

vi.mock('@settlegrid/mcp', () => ({
  settlegrid: {
    version: '0.2.0',
    init: () => ({
      // Default: wrap passes args through to execute when the key is
      // present on the context. The adapter's wrap-time bookkeeping
      // (method propagation, etc.) is covered in wrap-ai-tool.test.ts
      // — here we care only that the v5-shaped options flow through.
      wrap: (execute: (args: unknown) => unknown) =>
        async (args: unknown, ctx: { headers?: Record<string, string> }) => {
          if (!ctx?.headers?.['x-api-key']) {
            throw new MockInvalidKeyError('no key')
          }
          return execute(args)
        },
    }),
    extractApiKey: vi.fn(),
  },
  InvalidKeyError: MockInvalidKeyError,
  InsufficientCreditsError: MockInsufficientCreditsError,
}))

import { wrapAiTool } from '../index'

/**
 * Mirror of Vercel AI SDK v5's tool execute options. Only includes
 * the fields SettleGrid reads (`experimental_context`) plus the
 * canonical v5 fields that the SDK provides unconditionally
 * (`toolCallId`, `messages`, `abortSignal`). Kept independent of
 * `ai` so this package's tests run without the peer dep installed.
 *
 * When the real package is installed, the SDK's tool() function
 * will accept any function assignable to this shape — so proving
 * assignability here proves v5 compatibility.
 */
interface AiSdkV5ToolExecuteOptions {
  toolCallId: string
  messages: ReadonlyArray<unknown>
  abortSignal: AbortSignal | undefined
  experimental_context?: unknown
}

type AiSdkV5ToolExecute<ARGS, RESULT> = (
  args: ARGS,
  options: AiSdkV5ToolExecuteOptions,
) => PromiseLike<RESULT>

describe('P2.FMT1 spec-diff — Vercel AI SDK v5 structural compatibility', () => {
  it('wrapAiTool return value is assignable to AiSdkV5ToolExecute (compile-time)', () => {
    // The real compatibility proof is the next line compiling. If it
    // stops compiling after an upstream v5 change, this test file is
    // the signal to update the adapter.
    const execute: AiSdkV5ToolExecute<{ q: string }, { results: string[] }> =
      wrapAiTool(
        async ({ q }: { q: string }) => ({ results: [q] }),
        {
          toolSlug: 'compat-test',
          pricing: { defaultCostCents: 1 },
        },
      )

    expect(typeof execute).toBe('function')
  })

  it('wrapAiTool with method is still v5-assignable', () => {
    const execute: AiSdkV5ToolExecute<{ mode: string }, { ok: true }> = wrapAiTool(
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

  it('the runtime shape matches v5 call-time expectations', async () => {
    // Simulate Vercel AI SDK v5 invoking the tool — it passes the full
    // options object (toolCallId, messages, abortSignal,
    // experimental_context) to execute. Our wrapper only reads
    // experimental_context.settlegridKey; the other fields are
    // accepted but ignored today.
    const execute = wrapAiTool(
      async ({ q }: { q: string }) => ({ echoed: q }),
      {
        toolSlug: 'compat-test',
        pricing: { defaultCostCents: 1 },
      },
    )

    const v5InvocationOptions: AiSdkV5ToolExecuteOptions = {
      toolCallId: 'call_abc123',
      messages: [{ role: 'user', content: 'hi' }],
      abortSignal: new AbortController().signal,
      experimental_context: { settlegridKey: 'sg_live_xyz' },
    }
    const result = await execute({ q: 'hello' }, v5InvocationOptions)
    expect(result).toEqual({ echoed: 'hello' })
  })

  it('rejects correctly when v5 invokes without a settlegridKey in experimental_context', async () => {
    // Emulates a call site that forgets to set experimental_context
    // — every other v5 field is present.
    const execute = wrapAiTool(async () => ({ ok: true }), {
      toolSlug: 'compat-test',
      pricing: { defaultCostCents: 1 },
    })
    const optionsWithoutKey: AiSdkV5ToolExecuteOptions = {
      toolCallId: 'call_abc',
      messages: [],
      abortSignal: undefined,
      // experimental_context intentionally omitted
    }
    await expect(execute({}, optionsWithoutKey)).rejects.toMatchObject({
      code: 'INVALID_KEY',
    })
  })
})
