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

export interface RestMiddlewareOptions {
  toolSlug: string
  pricing?: PricingConfig
  costCents?: number // shorthand for per-invocation with single price
  apiUrl?: string
  debug?: boolean
  cacheTtlMs?: number
  timeoutMs?: number
}

export function settlegridMiddleware(options: RestMiddlewareOptions) {
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
      // Format SettleGrid errors as HTTP responses
      if (error instanceof Error) {
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
          return new Response(
            JSON.stringify({
              error: 'Rate limited',
              code: 'RATE_LIMITED',
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }
      throw error
    }
  }
}
