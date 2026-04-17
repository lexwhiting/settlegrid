/**
 * @settlegrid/ai-sdk — Vercel AI SDK adapter (P2.FMT1).
 *
 * Thin wrapper that lets developers monetize Vercel AI SDK tools with
 * one line of change. Given a Vercel AI SDK v5+ tool's `execute`
 * function, `wrapAiTool` returns an `execute`-shaped function that:
 *
 *   1. Extracts the SettleGrid API key from `experimental_context.settlegridKey`
 *      (the Vercel AI SDK's pass-through slot the caller of generateText /
 *      streamText supplies).
 *   2. Delegates to `sg.wrap(execute, { method })` internally — the
 *      middleware validates the key, checks credits, runs the handler,
 *      meters the invocation, and returns the result.
 *   3. Throws `InvalidKeyError` (→ 401) when the key is missing;
 *      `InsufficientCreditsError` (→ 402) when the consumer's balance
 *      is insufficient. Both errors propagate through to the Vercel AI
 *      SDK's tool-error surface.
 *
 * @example
 * ```typescript
 * import { tool } from 'ai'
 * import { wrapAiTool } from '@settlegrid/ai-sdk'
 * import { z } from 'zod'
 *
 * const searchTool = tool({
 *   description: 'Search the web',
 *   parameters: z.object({ query: z.string() }),
 *   execute: wrapAiTool(
 *     async ({ query }) => {
 *       const results = await performSearch(query)
 *       return { results }
 *     },
 *     { toolSlug: 'my-search', pricing: { defaultCostCents: 2 } },
 *   ),
 * })
 *
 * // At the call site (API route):
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   tools: { searchTool },
 *   prompt: userPrompt,
 *   experimental_context: {
 *     settlegridKey: request.headers.get('x-api-key') ?? undefined,
 *   },
 * })
 * ```
 *
 * @packageDocumentation
 */

import { settlegrid, InvalidKeyError } from '@settlegrid/mcp'
import type { InitOptions, WrapOptions } from '@settlegrid/mcp'

/**
 * Options for {@link wrapAiTool}. `toolSlug` and `pricing` mirror
 * {@link InitOptions}; `method` is forwarded to `sg.wrap`'s
 * {@link WrapOptions.method} for per-method pricing resolution.
 */
export interface WrapAiToolOptions {
  /**
   * Tool slug registered at https://settlegrid.ai/tools. Required.
   * Matches the `toolSlug` field of the underlying SettleGrid init
   * call.
   */
  toolSlug: string

  /**
   * Pricing configuration for the tool. Accepts both the legacy
   * `PricingConfig` (per-invocation) and the generalized
   * `GeneralizedPricingConfig` (per-token / per-byte / per-second /
   * tiered / outcome). See `@settlegrid/mcp` docs.
   */
  pricing: InitOptions['pricing']

  /**
   * Optional method name for per-method pricing lookup. When omitted,
   * the middleware bills at the `default` rate. Matches
   * {@link WrapOptions.method}.
   */
  method?: string
}

/**
 * Subset of Vercel AI SDK v5+ tool execute options that SettleGrid
 * reads. The full Vercel AI SDK type is larger (includes `abortSignal`,
 * `toolCallId`, `messages`, etc.) but we only care about
 * `experimental_context` here — the pass-through slot the caller uses
 * to thread data from the outer HTTP request down to the tool
 * handler.
 *
 * `experimental_context` is typed `unknown` to match Vercel AI SDK
 * v5's shape (the SDK doesn't narrow what callers put in this slot).
 * `wrapAiTool` narrows to `{ settlegridKey: string }` via a runtime
 * typeguard inside its body — see `extractSettlegridKey`. Callers
 * should still pass a shape like `{ settlegridKey: "sg_live_..." }`
 * for the adapter to find anything.
 *
 * All other fields are optional so this type stays structurally
 * compatible with the full v5 `ToolExecutionOptions` — a v5 caller
 * that provides the complete shape (toolCallId + messages +
 * abortSignal + experimental_context) can use the returned function
 * as a `tool({ execute: ... })` argument without cast.
 */
export interface AiToolExecuteOptions {
  experimental_context?: unknown
  abortSignal?: AbortSignal
  toolCallId?: string
  messages?: unknown
}

/**
 * Shape of the function returned by {@link wrapAiTool} — structurally
 * compatible with Vercel AI SDK v5+'s `tool({ execute })` contract.
 */
export type AiToolExecute<TArgs, TResult> = (
  args: TArgs,
  options: AiToolExecuteOptions,
) => Promise<TResult>

/**
 * Wrap a Vercel AI SDK tool's execute function with SettleGrid
 * per-invocation billing.
 *
 * @param execute - The tool's business logic. A plain
 *   `(args) => result` function — don't touch Vercel AI SDK's options
 *   object here; this adapter handles the billing extraction so
 *   `execute` stays focused on the tool's core behavior.
 * @param options - {@link WrapAiToolOptions} — tool slug + pricing
 *   config + optional method name.
 * @returns A function matching the Vercel AI SDK v5+
 *   `execute: (args, { experimental_context }) => result` contract.
 *   Thrown errors are either `InvalidKeyError` (401 when the
 *   `settlegridKey` is missing or empty) or whatever
 *   `@settlegrid/mcp`'s middleware throws (insufficient credits,
 *   budget exceeded, rate limits, etc.).
 */
export function wrapAiTool<TArgs, TResult>(
  execute: (args: TArgs) => Promise<TResult> | TResult,
  options: WrapAiToolOptions,
): AiToolExecute<TArgs, TResult> {
  // Precondition checks so consumers get a clear error at wrap-time
  // instead of a cryptic middleware error at call-time.
  if (!options || typeof options !== 'object') {
    throw new TypeError(
      'wrapAiTool: `options` is required. Example:\n' +
        '  wrapAiTool(execute, { toolSlug: "my-tool", pricing: { defaultCostCents: 1 } })',
    )
  }
  if (!options.toolSlug || typeof options.toolSlug !== 'string') {
    throw new TypeError(
      'wrapAiTool: `options.toolSlug` must be a non-empty string ' +
        '(the slug you registered at https://settlegrid.ai/tools).',
    )
  }
  if (!options.pricing || typeof options.pricing !== 'object') {
    throw new TypeError(
      'wrapAiTool: `options.pricing` is required. Example:\n' +
        '  pricing: { defaultCostCents: 1, methods: { search: { costCents: 5 } } }',
    )
  }

  const sg = settlegrid.init({
    toolSlug: options.toolSlug,
    pricing: options.pricing,
  })

  const wrapOpts: WrapOptions = {}
  if (options.method) wrapOpts.method = options.method
  const billed = sg.wrap(execute, wrapOpts)

  return async (args, aiOptions) => {
    const apiKey = extractSettlegridKey(aiOptions?.experimental_context)
    if (!apiKey) {
      throw new InvalidKeyError(
        'No SettleGrid API key found in experimental_context.settlegridKey. ' +
          'Pass `experimental_context: { settlegridKey: "sg_live_..." }` ' +
          'when calling generateText / streamText / generateObject / streamObject.',
      )
    }
    return billed(args, { headers: { 'x-api-key': apiKey } })
  }
}

/**
 * Narrow Vercel AI SDK v5's `experimental_context` (typed `unknown`)
 * down to the SettleGrid-specific `settlegridKey` slot. Returns the
 * non-empty string key, or `undefined` for any shape that doesn't
 * carry a usable key (missing field, non-string value, empty string).
 *
 * Keeping this as a standalone function means the runtime typeguard
 * is both unit-testable in isolation AND reusable if P3.K1 grows the
 * MeterContext payload (sessionId, maxCostCents, etc.) that needs
 * similar narrowing from the same slot.
 */
function extractSettlegridKey(ctx: unknown): string | undefined {
  if (typeof ctx !== 'object' || ctx === null) return undefined
  const key = (ctx as { settlegridKey?: unknown }).settlegridKey
  if (typeof key !== 'string' || key.length === 0) return undefined
  return key
}
