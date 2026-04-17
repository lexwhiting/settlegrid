/**
 * @settlegrid/cursor — Cursor billing adapter (P2.FMT3).
 *
 * Developer-side wrap pattern for Cursor MCP tool handlers. Cursor
 * connects to MCP servers via stdio; the server registers tools via
 * `McpServer.registerTool`. `wrapCursorTool` wraps the handler
 * passed to `registerTool` so the developer gets per-invocation
 * billing with the standard sg.wrap error surface.
 *
 *   1. Extracts the SettleGrid API key from the tool invocation's
 *      `_meta` field (MCP's opaque pass-through slot; Cursor users
 *      can populate `_meta['settlegrid-api-key']` via the MCP
 *      `call_tool` arguments).
 *   2. Delegates to `sg.wrap(execute, { method })` internally.
 *   3. Throws `InvalidKeyError` / `InsufficientCreditsError`.
 *
 * ## Scope note (P2.FMT3)
 *
 * The legacy `dist/index.js` is a STANDALONE MCP server that
 * proxies SettleGrid's Discovery API to Cursor; it stays in place
 * for consumer-side usage. `wrapCursorTool` is the
 * DEVELOPER-side primitive for MCP tool authors who want to
 * monetize their own Cursor-compatible tools.
 *
 * @example
 * ```typescript
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
 * import { wrapCursorTool } from '@settlegrid/cursor'
 * import { z } from 'zod'
 *
 * const server = new McpServer({ name: 'my-tool', version: '1.0.0' })
 *
 * const billedHandler = wrapCursorTool(
 *   async (input: { query: string }) => {
 *     const results = await performSearch(input.query)
 *     return { content: [{ type: 'text' as const, text: JSON.stringify(results) }] }
 *   },
 *   { toolSlug: 'my-search', pricing: { defaultCostCents: 2 } },
 * )
 *
 * server.registerTool(
 *   'search',
 *   { description: 'Search the web', inputSchema: z.object({ query: z.string() }).shape },
 *   async (input, extra) => billedHandler(input, extra),
 * )
 * ```
 *
 * @packageDocumentation
 */

import { settlegrid, InvalidKeyError } from '@settlegrid/mcp'
import type { InitOptions, WrapOptions } from '@settlegrid/mcp'

/** Options for {@link wrapCursorTool}. */
export interface WrapCursorToolOptions {
  toolSlug: string
  pricing: InitOptions['pricing']
  method?: string
}

/**
 * Subset of the MCP tool handler's `extra` arg. The Model Context
 * Protocol spec defines a `_meta` field as the opaque pass-through
 * slot; we read `_meta['settlegrid-api-key']` from there.
 */
export interface CursorToolExtra {
  _meta?: unknown
  /** Other MCP fields (requestId, progressToken, etc.) pass through. */
  [key: string]: unknown
}

/**
 * Shape of the function returned by {@link wrapCursorTool}.
 * Structurally matches MCP's `registerTool` handler: `(input, extra)
 * => Promise<result>`.
 */
export type CursorToolHandler<TInput, TResult> = (
  input: TInput,
  extra?: CursorToolExtra,
) => Promise<TResult>

/**
 * Wrap a Cursor MCP tool handler with SettleGrid per-invocation
 * billing.
 */
export function wrapCursorTool<TInput, TResult>(
  execute: (input: TInput) => Promise<TResult> | TResult,
  options: WrapCursorToolOptions,
): CursorToolHandler<TInput, TResult> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(
      'wrapCursorTool: `options` is required and must be an object.',
    )
  }
  if (
    !options.toolSlug ||
    typeof options.toolSlug !== 'string' ||
    options.toolSlug.trim().length === 0
  ) {
    throw new TypeError(
      'wrapCursorTool: `options.toolSlug` must be a non-empty string.',
    )
  }
  if (
    !options.pricing ||
    typeof options.pricing !== 'object' ||
    Array.isArray(options.pricing)
  ) {
    throw new TypeError(
      'wrapCursorTool: `options.pricing` is required and must be an object.',
    )
  }
  if (options.method !== undefined) {
    if (typeof options.method !== 'string' || options.method.trim().length === 0) {
      throw new TypeError(
        'wrapCursorTool: `options.method`, when provided, must be a non-empty string.',
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

  return async (input, extra) => {
    const apiKey = extractSettlegridKey(extra?._meta)
    if (!apiKey) {
      throw new InvalidKeyError(
        'No SettleGrid API key found in MCP _meta. ' +
          'Cursor users must populate `_meta["settlegrid-api-key"]` via the MCP call_tool arguments ' +
          '(or a per-tool config mechanism).',
      )
    }
    return billed(input, { headers: { 'x-api-key': apiKey } })
  }
}

const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/

/**
 * Narrow MCP's `_meta` field (typed `unknown`) to the
 * settlegrid-api-key slot. The MCP spec uses kebab-case keys in
 * _meta; we read `settlegrid-api-key` to match the MCP adapter's
 * existing extraction pattern (see packages/mcp/src/adapters/mcp.ts).
 */
function extractSettlegridKey(meta: unknown): string | undefined {
  if (
    meta === null ||
    meta === undefined ||
    typeof meta !== 'object' ||
    Array.isArray(meta)
  ) {
    return undefined
  }
  const candidate = (meta as { 'settlegrid-api-key'?: unknown })['settlegrid-api-key']
  if (typeof candidate !== 'string') return undefined
  const trimmed = candidate.trim()
  if (trimmed.length === 0) return undefined
  if (!PRINTABLE_ASCII_RE.test(trimmed)) return undefined
  return trimmed
}
