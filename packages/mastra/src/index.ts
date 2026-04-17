/**
 * @settlegrid/mastra — Mastra adapter (P2.FMT2).
 *
 * Thin wrapper that lets developers monetize Mastra tools with one
 * line of change. Given a Mastra `createTool({ execute })` function,
 * `wrapMastraTool` returns an `execute`-shaped function that:
 *
 *   1. Matches Mastra's canonical single-argument-destructured
 *      execute contract: `({ context, runtimeContext, mastra }) => result`.
 *      The wrapper destructures `runtimeContext` to extract the
 *      SettleGrid key and forwards `context` to the user's execute
 *      as its first (and only) argument.
 *   2. Extracts the SettleGrid API key from Mastra's `runtimeContext`
 *      (the framework's per-invocation context object — typically a
 *      `RuntimeContext` class instance with a `.get(key)` method, but
 *      plain-object shapes are also supported for consumers who pass
 *      a simpler structure).
 *   3. Delegates to `sg.wrap(execute, { method })` internally — the
 *      middleware validates the key, checks credits, runs the handler,
 *      meters the invocation, and returns the result.
 *   4. Throws `InvalidKeyError` (→ 401) when the key is missing /
 *      empty / contains control chars; `InsufficientCreditsError`
 *      (→ 402) when the consumer's balance is insufficient. Both
 *      errors propagate through to Mastra's tool-error surface.
 *
 * ## API-shape note (P2.FMT2 spec-diff)
 *
 * The initial scaffold returned a two-argument function
 * `(input, { runtimeContext }) => result` — mirroring Vercel AI SDK's
 * `execute` shape. The spec-diff pass caught that Mastra's real
 * `createTool({ execute })` contract is single-argument-destructured.
 * This file now returns the Mastra-canonical shape. User-facing
 * execute is kept simple — consumers still write `async (input) =>
 * result` and the adapter handles the one-level unwrap from
 * Mastra's `{ context }`.
 *
 * @example
 * ```typescript
 * import { createTool } from '@mastra/core'
 * import { wrapMastraTool } from '@settlegrid/mastra'
 * import { z } from 'zod'
 *
 * const searchTool = createTool({
 *   id: 'search',
 *   description: 'Search the web',
 *   inputSchema: z.object({ query: z.string() }),
 *   execute: wrapMastraTool(
 *     // User's execute takes `input` directly — no need to
 *     // destructure `context` here; the wrapper did that for you.
 *     async (input) => {
 *       const results = await performSearch(input.query)
 *       return { results }
 *     },
 *     { toolSlug: 'my-search', pricing: { defaultCostCents: 2 } },
 *   ),
 * })
 *
 * // At the call site:
 * import { RuntimeContext } from '@mastra/core'
 *
 * const runtimeContext = new RuntimeContext()
 * runtimeContext.set('settlegridKey', request.headers.get('x-api-key'))
 *
 * const result = await agent.generate(userPrompt, {
 *   runtimeContext,
 *   tools: { searchTool },
 * })
 * ```
 *
 * @packageDocumentation
 */

import { settlegrid, InvalidKeyError } from '@settlegrid/mcp'
import type { InitOptions, WrapOptions } from '@settlegrid/mcp'

/**
 * Options for {@link wrapMastraTool}. Mirrors P2.FMT1's
 * `WrapAiToolOptions` — the wrap-time configuration is framework-
 * independent.
 */
export interface WrapMastraToolOptions {
  /** Tool slug registered at https://settlegrid.ai/tools. Required. */
  toolSlug: string

  /** Pricing configuration. Accepts both legacy and generalized shapes. */
  pricing: InitOptions['pricing']

  /**
   * Optional method name for per-method pricing lookup. When omitted
   * the middleware bills at the `default` rate.
   */
  method?: string
}

/**
 * Mastra's canonical execute-function input shape: a single object
 * containing `context` (the validated tool input), `runtimeContext`
 * (the per-invocation context), and framework fields like `mastra`,
 * `threadId`, `resourceId` that pass through unchanged.
 *
 * Typed with `runtimeContext?: unknown` to match Mastra's contract
 * (values are framework-opaque — could be the canonical
 * `RuntimeContext` class or a plain object). Extra Mastra fields
 * pass through via the index signature so future upstream additions
 * don't break structural compatibility.
 */
export interface MastraExecuteInput<TInput> {
  /** The validated tool input matching the `inputSchema`. */
  context: TInput
  /** Per-invocation context; source of `settlegridKey`. */
  runtimeContext?: unknown
  /** Any additional Mastra fields pass through unchanged. */
  [key: string]: unknown
}

/**
 * Shape of the function returned by {@link wrapMastraTool} —
 * structurally compatible with Mastra's `createTool({ execute })`
 * contract. Single destructured object parameter, not
 * `(input, options)` (that was the Vercel AI SDK pattern; Mastra's
 * real API uses the destructured form — see the module-level JSDoc
 * P2.FMT2 spec-diff note).
 */
export type MastraToolExecute<TInput, TResult> = (
  params: MastraExecuteInput<TInput>,
) => Promise<TResult>

/**
 * Wrap a Mastra tool's execute function with SettleGrid per-invocation
 * billing.
 *
 * @param execute - The tool's business logic. A plain
 *   `(input) => result` function — don't touch Mastra's options
 *   object here; this adapter handles the billing extraction so
 *   `execute` stays focused on the tool's core behavior.
 * @param options - {@link WrapMastraToolOptions} — tool slug +
 *   pricing config + optional method name.
 * @returns A function matching Mastra's `createTool` execute
 *   contract. Thrown errors: `InvalidKeyError` (401 when
 *   `runtimeContext.get('settlegridKey')` is missing / empty /
 *   contains control chars) or whatever `@settlegrid/mcp`'s
 *   middleware throws (insufficient credits, budget exceeded, etc.).
 *
 * **Scope note (P2.FMT2)**: Mastra's `runtimeContext` can carry more
 * than just `settlegridKey`; this adapter only extracts that one
 * field. Other runtime context values continue to flow to Mastra's
 * framework layer unchanged (we don't mutate the context).
 */
export function wrapMastraTool<TInput, TResult>(
  execute: (input: TInput) => Promise<TResult> | TResult,
  options: WrapMastraToolOptions,
): MastraToolExecute<TInput, TResult> {
  // Precondition checks so consumers get a clear error at wrap-time
  // instead of a cryptic middleware error at call-time.
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(
      'wrapMastraTool: `options` is required and must be an object. Example:\n' +
        '  wrapMastraTool(execute, { toolSlug: "my-tool", pricing: { defaultCostCents: 1 } })',
    )
  }
  if (
    !options.toolSlug ||
    typeof options.toolSlug !== 'string' ||
    options.toolSlug.trim().length === 0
  ) {
    throw new TypeError(
      'wrapMastraTool: `options.toolSlug` must be a non-empty string ' +
        '(the slug you registered at https://settlegrid.ai/tools).',
    )
  }
  if (
    !options.pricing ||
    typeof options.pricing !== 'object' ||
    Array.isArray(options.pricing)
  ) {
    throw new TypeError(
      'wrapMastraTool: `options.pricing` is required and must be an object ' +
        '(PricingConfig or GeneralizedPricingConfig). Example:\n' +
        '  pricing: { defaultCostCents: 1, methods: { search: { costCents: 5 } } }',
    )
  }
  if (options.method !== undefined) {
    if (typeof options.method !== 'string' || options.method.trim().length === 0) {
      throw new TypeError(
        'wrapMastraTool: `options.method`, when provided, must be a non-empty string. ' +
          'Omit the field entirely to bill at the pricing config default rate.',
      )
    }
  }

  const sg = settlegrid.init({
    toolSlug: options.toolSlug,
    pricing: options.pricing,
  })

  const wrapOpts: WrapOptions = {}
  if (options.method !== undefined) wrapOpts.method = options.method
  const billed = sg.wrap(execute, wrapOpts)

  return async ({ context, runtimeContext }) => {
    const apiKey = extractSettlegridKey(runtimeContext)
    if (!apiKey) {
      throw new InvalidKeyError(
        'No SettleGrid API key found in runtimeContext. ' +
          'Set it via `runtimeContext.set("settlegridKey", "sg_live_...")` ' +
          'before calling agent.generate() / agent.stream() / tool.execute().',
      )
    }
    return billed(context, { headers: { 'x-api-key': apiKey } })
  }
}

/**
 * Printable-ASCII character class (space 0x20 through tilde 0x7E).
 * Rejects control characters + non-ASCII at the adapter layer so a
 * CRLF-injection attempt ('sg_live_valid\r\nEvil-Header: x') is
 * stopped at the choke point, not forwarded to fetch's header
 * writer. SettleGrid's canonical key format
 * (`sg_<env>_<alphanumeric>`) is a proper subset of printable ASCII
 * — real keys always pass. Matches the defense in
 * packages/ai-sdk/src/index.ts.
 */
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/

/**
 * Narrow Mastra's `runtimeContext` (typed `unknown`) to the
 * SettleGrid-specific key. Supports both shapes:
 *
 *   - **RuntimeContext class** (the canonical Mastra shape) — an
 *     object with a `.get(key)` method, typically backed by an
 *     internal Map. We call `.get('settlegridKey')`.
 *   - **Plain object** — `{ settlegridKey: '...' }`. Some consumers
 *     construct a literal instead of the RuntimeContext class; this
 *     branch keeps them working without forcing a framework dep.
 *
 * Returns the validated string key, or `undefined` for any shape
 * that doesn't carry a usable key. Same validation as
 * packages/ai-sdk: non-empty string + printable-ASCII only.
 */
function extractSettlegridKey(runtimeContext: unknown): string | undefined {
  if (runtimeContext === null || runtimeContext === undefined) return undefined

  let candidate: unknown

  // RuntimeContext class shape: object with a `.get(key)` method.
  if (
    typeof runtimeContext === 'object' &&
    'get' in runtimeContext &&
    typeof (runtimeContext as { get: unknown }).get === 'function'
  ) {
    try {
      candidate = (runtimeContext as { get: (k: string) => unknown }).get(
        'settlegridKey',
      )
    } catch {
      // A defective runtimeContext that throws from .get() shouldn't
      // crash the tool. Fall through to treat as "no key found".
      return undefined
    }
  } else if (
    typeof runtimeContext === 'object' &&
    !Array.isArray(runtimeContext)
  ) {
    // Plain-object fallback.
    candidate = (runtimeContext as { settlegridKey?: unknown }).settlegridKey
  } else {
    return undefined
  }

  if (typeof candidate !== 'string' || candidate.length === 0) return undefined
  if (!PRINTABLE_ASCII_RE.test(candidate)) return undefined
  return candidate
}
