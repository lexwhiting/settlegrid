/**
 * @settlegrid/langchain — LangChain billing adapter (P2.FMT3).
 *
 * Developer-side wrap pattern that mirrors @settlegrid/ai-sdk's
 * `wrapAiTool` and @settlegrid/mastra's `wrapMastraTool`. Given a
 * LangChain Tool's underlying execute function, returns a function
 * that:
 *
 *   1. Extracts the SettleGrid API key from a config object threaded
 *      through LangChain's RunnableConfig -> `configurable.settlegridKey`.
 *   2. Delegates to `sg.wrap(execute, { method })` internally — the
 *      middleware validates the key, checks credits, runs the handler,
 *      meters the invocation, and returns the result.
 *   3. Throws `InvalidKeyError` (→ 401) when the key is missing /
 *      empty / contains control chars; `InsufficientCreditsError`
 *      (→ 402) when the consumer's balance is insufficient.
 *
 * ## Why a separate entry point from SettleGridTool
 *
 * The legacy `SettleGridTool` class (see tool.ts) is a CONSUMER-side
 * integration — it makes an HTTP fetch against SettleGrid's hosted
 * proxy from inside a LangChain agent. `wrapLangchainTool` is a
 * DEVELOPER-side integration — it wraps the tool's local execute
 * function with billing hooks so the developer monetizes their own
 * LangChain-powered tool.
 *
 * The two coexist; neither replaces the other. Most tool builders
 * will want `wrapLangchainTool`. Most agent authors pulling in
 * third-party tools will want `SettleGridTool` / `SettleGridToolkit`.
 *
 * @example
 * ```typescript
 * import { DynamicStructuredTool } from '@langchain/core/tools'
 * import { wrapLangchainTool } from '@settlegrid/langchain'
 * import { z } from 'zod'
 *
 * const searchTool = new DynamicStructuredTool({
 *   name: 'search',
 *   description: 'Search the web',
 *   schema: z.object({ query: z.string() }),
 *   func: wrapLangchainTool(
 *     async (input) => {
 *       const results = await performSearch(input.query)
 *       return JSON.stringify({ results })
 *     },
 *     { toolSlug: 'my-search', pricing: { defaultCostCents: 2 } },
 *   ),
 * })
 *
 * // At invocation time, pass the SettleGrid key via RunnableConfig:
 * await searchTool.invoke(
 *   { query: 'hello' },
 *   { configurable: { settlegridKey: 'sg_live_...' } },
 * )
 * ```
 *
 * @packageDocumentation
 */

import { settlegrid, InvalidKeyError } from '@settlegrid/mcp'
import type { InitOptions, WrapOptions } from '@settlegrid/mcp'

/**
 * Options for {@link wrapLangchainTool}. Mirrors the WrapAiToolOptions /
 * WrapMastraToolOptions shape from the sibling packages.
 */
export interface WrapLangchainToolOptions {
  /** Tool slug registered at https://settlegrid.ai/tools. Required. */
  toolSlug: string
  /** Pricing configuration. */
  pricing: InitOptions['pricing']
  /** Optional method name for per-method pricing lookup. */
  method?: string
}

/**
 * Subset of LangChain's RunnableConfig that we read. LangChain's real
 * shape is broader; we only care about `configurable` for the
 * SettleGrid key pass-through.
 *
 * Typed with `configurable?: unknown` to match LangChain's contract
 * (the `configurable` slot is a map of opaque values; no type
 * narrowing at the framework layer). `wrapLangchainTool` narrows to
 * `{ settlegridKey: string }` via a runtime typeguard in its body.
 */
export interface LangchainToolInvokeConfig {
  configurable?: unknown
  /** Other RunnableConfig fields (callbacks, tags, etc.) pass through. */
  [key: string]: unknown
}

/**
 * Shape of the function returned by {@link wrapLangchainTool} —
 * structurally compatible with LangChain's Tool.func contract:
 * `(input, config?) => Promise<result>`.
 */
export type LangchainToolFunc<TInput, TResult> = (
  input: TInput,
  config?: LangchainToolInvokeConfig,
) => Promise<TResult>

/**
 * Wrap a LangChain tool's execute function with SettleGrid
 * per-invocation billing.
 *
 * @param execute - `(input) => Promise<result> | result`. Your tool's
 *   business logic.
 * @param options - {@link WrapLangchainToolOptions}.
 * @returns A function matching LangChain's `Tool.func` contract.
 *   Thrown errors: `InvalidKeyError` (401 when
 *   `config.configurable.settlegridKey` is missing / empty / invalid
 *   format) or whatever `@settlegrid/mcp`'s middleware throws.
 *
 * **Scope note (P2.FMT3)**: LangChain's Tool callbacks /
 * abortController / runId / tags are not forwarded to either the
 * execute function or the billing middleware. Same scope trade-off
 * as `wrapAiTool` / `wrapMastraTool`.
 */
export function wrapLangchainTool<TInput, TResult>(
  execute: (input: TInput) => Promise<TResult> | TResult,
  options: WrapLangchainToolOptions,
): LangchainToolFunc<TInput, TResult> {
  // Precondition checks — actionable errors at wrap-time.
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(
      'wrapLangchainTool: `options` is required and must be an object. Example:\n' +
        '  wrapLangchainTool(execute, { toolSlug: "my-tool", pricing: { defaultCostCents: 1 } })',
    )
  }
  if (
    !options.toolSlug ||
    typeof options.toolSlug !== 'string' ||
    options.toolSlug.trim().length === 0
  ) {
    throw new TypeError(
      'wrapLangchainTool: `options.toolSlug` must be a non-empty string.',
    )
  }
  if (
    !options.pricing ||
    typeof options.pricing !== 'object' ||
    Array.isArray(options.pricing)
  ) {
    throw new TypeError(
      'wrapLangchainTool: `options.pricing` is required and must be an object.',
    )
  }
  if (options.method !== undefined) {
    if (typeof options.method !== 'string' || options.method.trim().length === 0) {
      throw new TypeError(
        'wrapLangchainTool: `options.method`, when provided, must be a non-empty string.',
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

  return async (input, config) => {
    const apiKey = extractSettlegridKey(config?.configurable)
    if (!apiKey) {
      throw new InvalidKeyError(
        'No SettleGrid API key found in config.configurable.settlegridKey. ' +
          'Pass `{ configurable: { settlegridKey: "sg_live_..." } }` ' +
          'when invoking the tool (e.g., `tool.invoke(input, config)` or ' +
          '`agent.invoke({ input }, config)`).',
      )
    }
    return billed(input, { headers: { 'x-api-key': apiKey } })
  }
}

/**
 * Printable-ASCII character class. Same header-injection defense as
 * @settlegrid/ai-sdk and @settlegrid/mastra.
 */
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/

/**
 * Narrow LangChain's `configurable` slot (typed `unknown`) to the
 * SettleGrid-specific key. Accepts plain-object shapes — LangChain's
 * RunnableConfig.configurable is a plain record. Returns the
 * trimmed + validated string key, or `undefined` for any shape
 * that doesn't carry a usable key.
 */
function extractSettlegridKey(configurable: unknown): string | undefined {
  if (
    configurable === null ||
    configurable === undefined ||
    typeof configurable !== 'object' ||
    Array.isArray(configurable)
  ) {
    return undefined
  }
  const candidate = (configurable as { settlegridKey?: unknown }).settlegridKey
  if (typeof candidate !== 'string') return undefined
  const trimmed = candidate.trim()
  if (trimmed.length === 0) return undefined
  if (!PRINTABLE_ASCII_RE.test(trimmed)) return undefined
  return trimmed
}
