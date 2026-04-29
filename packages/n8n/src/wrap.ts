/**
 * @settlegrid/n8n — n8n billing adapter (P2.FMT3).
 *
 * Developer-side wrap pattern for n8n custom node executors. Given
 * a node's operation function, returns one that:
 *
 *   1. Extracts the SettleGrid API key from a `context` argument
 *      (typically sourced from n8n's credentials or workflow static
 *      data at operation time — see the README for wiring
 *      examples).
 *   2. Delegates to `sg.wrap(execute, { method })` internally.
 *   3. Throws `InvalidKeyError` / `InsufficientCreditsError` on the
 *      standard error paths.
 *
 * ## Why minimal (P2.FMT3 scope)
 *
 * n8n's real `IExecuteFunctions` has a rich API (getCredentials,
 * getNodeParameter, getInputData, helpers, etc.) that a full
 * operation node would use. `wrapN8nTool` intentionally stays
 * framework-light — it wraps the BUSINESS LOGIC of a node operation,
 * not the node itself. The actual `SettleGrid` community node (see
 * src/nodes/SettleGrid/SettleGrid.node.ts) + the forthcoming
 * `Invoke` operation node (P2.FMT4) handle the n8n-specific
 * plumbing; `wrapN8nTool` is the billing primitive those nodes call.
 *
 * @example
 * ```typescript
 * import { wrapN8nTool } from '@settlegrid/n8n'
 *
 * const billedExecute = wrapN8nTool(
 *   async (input: { url: string }) => {
 *     const response = await fetch(input.url)
 *     return { status: response.status }
 *   },
 *   { toolSlug: 'url-checker', pricing: { defaultCostCents: 1 } },
 * )
 *
 * // Inside an n8n node's execute():
 * const credentials = await this.getCredentials('settleGridApi')
 * const settlegridKey = credentials.apiKey as string
 * const url = this.getNodeParameter('url', 0) as string
 * const result = await billedExecute({ url }, { settlegridKey })
 * ```
 *
 * @packageDocumentation
 */

import { settlegrid, InvalidKeyError } from '@settlegrid/mcp'
import type { InitOptions, WrapOptions } from '@settlegrid/mcp'

/** Options for {@link wrapN8nTool}. */
export interface WrapN8nToolOptions {
  toolSlug: string
  pricing: InitOptions['pricing']
  method?: string
}

/**
 * Context threaded into the wrapped function at invocation time.
 * Carries the SettleGrid key the node's execute() function
 * extracted from n8n credentials.
 */
export interface N8nBillingContext {
  /** SettleGrid API key. Typically sourced from n8n credentials. */
  settlegridKey?: string
  /** Other fields pass through unchanged. */
  [key: string]: unknown
}

/**
 * Shape of the function returned by {@link wrapN8nTool}.
 */
export type N8nWrappedExecute<TInput, TResult> = (
  input: TInput,
  context: N8nBillingContext,
) => Promise<TResult>

/**
 * Wrap an n8n node operation's execute function with SettleGrid
 * per-invocation billing.
 */
export function wrapN8nTool<TInput, TResult>(
  execute: (input: TInput) => Promise<TResult> | TResult,
  options: WrapN8nToolOptions,
): N8nWrappedExecute<TInput, TResult> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(
      'wrapN8nTool: `options` is required and must be an object.',
    )
  }
  if (
    !options.toolSlug ||
    typeof options.toolSlug !== 'string' ||
    options.toolSlug.trim().length === 0
  ) {
    throw new TypeError(
      'wrapN8nTool: `options.toolSlug` must be a non-empty string.',
    )
  }
  if (
    !options.pricing ||
    typeof options.pricing !== 'object' ||
    Array.isArray(options.pricing)
  ) {
    throw new TypeError(
      'wrapN8nTool: `options.pricing` is required and must be an object.',
    )
  }
  if (options.method !== undefined) {
    if (typeof options.method !== 'string' || options.method.trim().length === 0) {
      throw new TypeError(
        'wrapN8nTool: `options.method`, when provided, must be a non-empty string.',
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

  return async (input, context) => {
    const apiKey = extractSettlegridKey(context)
    if (!apiKey) {
      throw new InvalidKeyError(
        'No SettleGrid API key found. Pass `{ settlegridKey: "sg_live_..." }` ' +
          'as the second argument — typically sourced from n8n credentials ' +
          '(`const { apiKey } = await this.getCredentials("settleGridApi")`).',
      )
    }
    return billed(input, { headers: { 'x-api-key': apiKey } })
  }
}

const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/

function extractSettlegridKey(
  context: N8nBillingContext | undefined,
): string | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return undefined
  }
  const candidate = context.settlegridKey
  if (typeof candidate !== 'string') return undefined
  const trimmed = candidate.trim()
  if (trimmed.length === 0) return undefined
  if (!PRINTABLE_ASCII_RE.test(trimmed)) return undefined
  return trimmed
}
