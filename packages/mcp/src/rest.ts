// /Users/lex/settlegrid/packages/mcp/src/rest.ts

/**
 * REST middleware for Express / Next.js API routes
 *
 * @example
 * // Next.js App Router
 * import { settlegridMiddleware } from '@settlegrid/mcp/rest'
 *
 * const withBilling = settlegridMiddleware({
 *   toolSlug: 'my-api',
 *   costCents: 5,
 * })
 *
 * export async function GET(request: Request) {
 *   return withBilling(request, async () => {
 *     return Response.json({ data: 'hello' })
 *   })
 * }
 */

import { settlegrid } from './index'
import type { PricingConfig } from './types'
import { SettleGridError } from './errors'

/**
 * Configuration options for the REST middleware.
 *
 * @example
 * ```typescript
 * // Simple: single price for all endpoints
 * const opts: RestMiddlewareOptions = { toolSlug: 'my-api', costCents: 5 }
 *
 * // Advanced: per-method pricing
 * const opts: RestMiddlewareOptions = {
 *   toolSlug: 'my-api',
 *   pricing: {
 *     defaultCostCents: 1,
 *     methods: { search: { costCents: 5 }, analyze: { costCents: 20 } },
 *   },
 * }
 * ```
 */
export interface RestMiddlewareOptions {
  /** Tool slug identifier (must match your SettleGrid dashboard registration) */
  toolSlug: string
  /** Full pricing configuration (overrides costCents if both provided) */
  pricing?: PricingConfig
  /** Shorthand: flat cost in cents per request (ignored if pricing is set) */
  costCents?: number
  /** SettleGrid API base URL (defaults to 'https://settlegrid.ai') */
  apiUrl?: string
  /** Enable debug logging and synchronous metering */
  debug?: boolean
  /** Cache TTL in milliseconds for key validation (defaults to 300000) */
  cacheTtlMs?: number
  /** Request timeout in milliseconds (defaults to 5000, range: 100-30000) */
  timeoutMs?: number
}

/**
 * Create a REST middleware function that wraps request handlers with SettleGrid billing.
 *
 * Designed for Next.js App Router, Express, Hono, or any framework using the Web Fetch API.
 * Extracts the API key from request headers, validates the consumer, checks credits, and meters usage.
 *
 * @param options - Middleware configuration
 * @returns A `withBilling` function to wrap your request handlers
 * @throws {Error} If options.toolSlug is missing or empty
 *
 * @example
 * ```typescript
 * // Next.js App Router
 * import { settlegridMiddleware } from '@settlegrid/mcp'
 *
 * const withBilling = settlegridMiddleware({
 *   toolSlug: 'my-api',
 *   costCents: 5,
 * })
 *
 * export async function GET(request: Request) {
 *   return withBilling(request, async () => {
 *     return Response.json({ data: 'hello' })
 *   })
 * }
 * ```
 */
export function settlegridMiddleware(options: RestMiddlewareOptions) {
  if (!options || typeof options !== 'object') {
    throw new Error(
      'settlegridMiddleware() requires an options object. Example:\n' +
      '  settlegridMiddleware({ toolSlug: "my-api", costCents: 5 })'
    )
  }
  if (!options.toolSlug || typeof options.toolSlug !== 'string' || !options.toolSlug.trim()) {
    throw new Error(
      'settlegridMiddleware() requires a non-empty toolSlug. ' +
      'This must match the slug registered at https://settlegrid.ai/tools. ' +
      `Received: ${JSON.stringify(options.toolSlug)}`
    )
  }

  const pricing: PricingConfig = options.pricing ?? {
    defaultCostCents: options.costCents ?? 1,
  }

  const sg = settlegrid.init({
    toolSlug: options.toolSlug,
    pricing,
    apiUrl: options.apiUrl,
    debug: options.debug,
    cacheTtlMs: options.cacheTtlMs,
    timeoutMs: options.timeoutMs,
  })

  /**
   * Wrap a request handler with SettleGrid billing.
   * Extracts API key from request headers, validates, checks credits, meters.
   */
  return async function withBilling(
    request: Request,
    handler: () => Promise<Response> | Response,
    methodOverride?: string
  ): Promise<Response> {
    const headers: Record<string, string | string[] | undefined> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    const method =
      methodOverride ?? new URL(request.url).pathname.split('/').pop() ?? 'default'

    const wrappedHandler = sg.wrap(async () => handler(), { method })

    try {
      return await wrappedHandler({}, { headers })
    } catch (error) {
      // Format SettleGrid errors as HTTP responses with appropriate status codes
      if (error instanceof SettleGridError) {
        if (error.name === 'InsufficientCreditsError') {
          return new Response(
            JSON.stringify({
              error: 'Insufficient credits',
              code: 'INSUFFICIENT_CREDITS',
              topUpUrl: `https://settlegrid.ai/top-up?tool=${options.toolSlug}`,
            }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (error.name === 'InvalidKeyError') {
          return new Response(
            JSON.stringify({
              error: 'Invalid API key',
              code: 'INVALID_KEY',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        }
        if (error.name === 'RateLimitedError') {
          const retryAfter = 'retryAfterMs' in error ? (error as { retryAfterMs: number }).retryAfterMs : undefined
          return new Response(
            JSON.stringify({
              error: 'Rate limited',
              code: 'RATE_LIMITED',
              ...(retryAfter != null ? { retryAfterMs: retryAfter } : {}),
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                ...(retryAfter != null ? { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } : {}),
              },
            }
          )
        }
        if (error.name === 'TimeoutError' || error.name === 'NetworkError' || error.name === 'SettleGridUnavailableError') {
          return new Response(
            JSON.stringify({
              error: 'Billing service temporarily unavailable',
              code: error.code,
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        }
        // Catch-all for any other SettleGridError subclasses
        return new Response(
          JSON.stringify(error.toJSON()),
          { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }
  }
}
