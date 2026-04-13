/**
 * @settlegrid/mcp - Core middleware
 *
 * Key extraction, validation, credit check, and metering for MCP tool calls.
 * This module implements the full billing pipeline: validate key -> check credits -> execute -> meter.
 *
 * @packageDocumentation
 */

import { LRUCache } from './cache'
import { resolveOperationCost } from './config'
import {
  InsufficientCreditsError,
  InvalidKeyError,
  NetworkError,
  RateLimitedError,
  SettleGridError,
  SettleGridUnavailableError,
  TimeoutError,
  ToolDisabledError,
  ToolNotFoundError,
} from './errors'
import type {
  GeneralizedPricingConfig,
  InvocationContext,
  MeterResponse,
  PricingConfig,
  ValidateKeyResponse,
} from './types'
import type { NormalizedConfig } from './config'

/**
 * Extract an API key from various sources in priority order:
 * 1. MCP metadata (`settlegrid-api-key` or `x-api-key`)
 * 2. `Authorization: Bearer <key>` header
 * 3. `x-api-key` / `X-Api-Key` header
 *
 * @param headers - HTTP request headers (optional)
 * @param metadata - MCP call metadata (optional, takes priority over headers)
 * @returns The extracted API key string, or `null` if no key was found
 *
 * @example
 * ```typescript
 * // From MCP metadata (preferred for MCP servers)
 * const key1 = extractApiKey(undefined, { 'settlegrid-api-key': 'sg_live_abc' })
 *
 * // From HTTP headers (for REST APIs)
 * const key2 = extractApiKey({ 'x-api-key': 'sg_live_abc' })
 *
 * // From Bearer token
 * const key3 = extractApiKey({ authorization: 'Bearer sg_live_abc' })
 * ```
 */
export function extractApiKey(
  headers?: Record<string, string | string[] | undefined>,
  metadata?: Record<string, unknown>
): string | null {
  // 1. Check MCP metadata (preferred for MCP servers)
  if (metadata?.['settlegrid-api-key']) {
    return String(metadata['settlegrid-api-key'])
  }
  if (metadata?.['x-api-key']) {
    return String(metadata['x-api-key'])
  }

  if (!headers) return null

  // 2. Check Authorization header (Bearer token)
  const authHeader = headers['authorization'] ?? headers['Authorization']
  if (authHeader) {
    const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
    if (value?.startsWith('Bearer ')) {
      return value.slice(7)
    }
  }

  // 3. Check x-api-key header
  const apiKeyHeader = headers['x-api-key'] ?? headers['X-Api-Key']
  if (apiKeyHeader) {
    return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] ?? null : apiKeyHeader
  }

  return null
}

/**
 * HTTP client for SettleGrid API calls.
 *
 * Maps every HTTP status the SettleGrid API returns to a typed
 * SettleGridError subclass so callers can catch precisely:
 *
 *   200          → returns parsed JSON body (or `null` for empty body)
 *   401          → InvalidKeyError
 *   402          → InsufficientCreditsError (requiredCents/availableCents
 *                  pulled from response body when present)
 *   403          → ToolDisabledError (slug from config.toolSlug)
 *   404          → ToolNotFoundError (slug from config.toolSlug)
 *   429          → RateLimitedError (retryAfterMs parsed from
 *                  Retry-After header, defaulting to 60_000)
 *   other 4xx/5xx → SettleGridUnavailableError with the original
 *                  status code in the message
 *   AbortError   → TimeoutError (config.timeoutMs)
 *   network err  → NetworkError
 *   200 + bad JSON → SettleGridUnavailableError (success path parse fail)
 *
 * Not exported directly. Reachable from outside the module ONLY via the
 * `__internal__` namespace below — that mark makes the
 * "exposed for tests, not public API" intent explicit at every call site.
 */
async function apiCall<T>(
  config: NormalizedConfig,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${config.apiUrl}/api/sdk${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      // Parse error body if possible — swallow parse failures so a
      // non-JSON 4xx body still produces a useful typed error.
      //
      // The raw parsed value from `response.json()` could be ANY JSON type
      // (object, array, null, number, string). The cast `as { error? }`
      // is a TypeScript fiction — at runtime we MUST normalize to a plain
      // object before destructuring, otherwise `null.error` would throw
      // a TypeError which would then be wrapped in NetworkError, masking
      // the real status code from the consumer.
      const rawData = await response.json().catch(() => ({}))
      const data: {
        error?: string
        code?: string
        requiredCents?: number
        availableCents?: number
        topUpUrl?: string
        retryAfterSeconds?: number
      } =
        rawData !== null &&
        typeof rawData === 'object' &&
        !Array.isArray(rawData)
          ? (rawData as Record<string, unknown>)
          : {}

      // Status-code primary routing, with body.code as secondary
      // discriminator for 403/404 (a 403 without `code: 'TOOL_DISABLED'`
      // could be a CSRF rejection, IP block, or unrelated forbidden —
      // we only claim it's a tool-disabled error when the server
      // explicitly tells us so).
      switch (response.status) {
        case 401:
          throw new InvalidKeyError(data.error)
        case 402:
          throw new InsufficientCreditsError(
            data.requiredCents ?? 0,
            data.availableCents ?? 0,
            data.topUpUrl,
          )
        case 403:
          if (data.code === 'TOOL_DISABLED') {
            throw new ToolDisabledError(config.toolSlug)
          }
          // Unknown 403 reason — surface as generic unavailable rather
          // than mis-label as ToolDisabledError.
          throw new SettleGridUnavailableError(
            data.error ?? `API returned 403`,
          )
        case 404:
          if (data.code === 'TOOL_NOT_FOUND') {
            throw new ToolNotFoundError(config.toolSlug)
          }
          throw new SettleGridUnavailableError(
            data.error ?? `API returned 404`,
          )
        case 429: {
          // Retry delay resolution precedence:
          //   1. Retry-After header (RFC 7231 delta-seconds)
          //   2. body.retryAfterSeconds (SDK convention)
          //   3. 60-second default
          const header = response.headers.get('retry-after')
          let retryAfterMs = 60_000
          if (header !== null) {
            const seconds = Number.parseInt(header, 10)
            if (Number.isFinite(seconds) && seconds >= 0) {
              retryAfterMs = seconds * 1000
            }
          } else if (
            typeof data.retryAfterSeconds === 'number' &&
            Number.isFinite(data.retryAfterSeconds) &&
            data.retryAfterSeconds >= 0
          ) {
            retryAfterMs = data.retryAfterSeconds * 1000
          }
          throw new RateLimitedError(retryAfterMs)
        }
        default:
          throw new SettleGridUnavailableError(
            data.error ?? `API returned ${response.status}`,
          )
      }
    }

    // Successful response: handle empty body and JSON parse failures
    // explicitly. `response.json()` throws SyntaxError on an empty body,
    // which would otherwise fall through to the NetworkError catch-all.
    const text = await response.text()
    if (text.length === 0) {
      return null as T
    }
    try {
      return JSON.parse(text) as T
    } catch (parseErr) {
      // Bind the parse error so its message survives — debugging is much
      // harder when "Unexpected token x in JSON at position 5" is thrown
      // away in favor of a generic "body was not valid JSON".
      const detail = parseErr instanceof Error ? `: ${parseErr.message}` : ''
      throw new SettleGridUnavailableError(
        `API returned ${response.status} but response body was not valid JSON${detail}`,
      )
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(config.timeoutMs)
    }
    // Re-throw any of our typed errors as-is (don't wrap them in
    // NetworkError just because they bubble through this catch).
    if (error instanceof SettleGridError) {
      throw error
    }
    throw new NetworkError(
      error instanceof Error ? error.message : 'Unknown network error',
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Internal exports — exposed for unit testing only, NOT part of the
 * public SDK surface.
 *
 * Test files import these via:
 *
 *   import { __internal__ } from '../middleware'
 *   const { apiCall } = __internal__
 *
 * The `@internal` JSDoc tag is preserved on the namespace so tsup's DTS
 * pipeline strips it from the published .d.ts, keeping the consumer-
 * facing API surface unchanged.
 *
 * @internal
 */
export const __internal__ = { apiCall }

/** Create the middleware pipeline */
export function createMiddleware(
  config: NormalizedConfig,
  pricing: PricingConfig | GeneralizedPricingConfig,
) {
  const cache = new LRUCache(1000, config.cacheTtlMs)

  /** Validate an API key against the SettleGrid API (with caching) */
  async function validateKey(apiKey: string): Promise<ValidateKeyResponse> {
    // Check cache first
    const cached = cache.get(apiKey)
    if (cached) {
      return {
        valid: cached.valid,
        consumerId: cached.consumerId,
        toolId: cached.toolId,
        keyId: cached.keyId,
        balanceCents: cached.balanceCents,
      }
    }

    // Call SettleGrid API
    const result = await apiCall<ValidateKeyResponse>(config, '/validate-key', {
      apiKey,
      toolSlug: config.toolSlug,
    })

    // Cache successful validations
    if (result.valid) {
      cache.set(apiKey, {
        valid: true,
        consumerId: result.consumerId,
        toolId: result.toolId,
        keyId: result.keyId,
        balanceCents: result.balanceCents,
      })
    }

    return result
  }

  /**
   * Check if consumer has sufficient credits for the method.
   *
   * Delegates cost resolution to `resolveOperationCost`, which supports
   * all six pricing models (per-invocation, per-token, per-byte,
   * per-second, tiered, outcome). The `units` argument is forwarded
   * to the resolver and is required for anything other than
   * per-invocation; omitting it in a unit-based model defaults the
   * multiplier to 1 (equivalent to a one-unit call).
   */
  function checkCredits(
    balanceCents: number,
    method: string,
    units?: number,
  ): { sufficient: boolean; costCents: number } {
    const costCents = resolveOperationCost(pricing, method, units)
    return {
      sufficient: balanceCents >= costCents,
      costCents,
    }
  }

  /** Meter an invocation (deduct credits, record usage) */
  async function meter(context: InvocationContext): Promise<MeterResponse> {
    const latencyMs = Date.now() - context.startTime

    const result = await apiCall<MeterResponse>(config, '/meter', {
      toolSlug: config.toolSlug,
      consumerId: context.consumerId,
      toolId: context.toolId,
      keyId: context.keyId,
      method: context.method,
      costCents: context.costCents,
      latencyMs,
    })

    // Invalidate cache to reflect new balance
    // We don't have the raw key here, but the balance will be stale
    // The cache TTL handles eventual consistency
    return result
  }

  /** Full middleware pipeline: validate → check credits → execute → meter */
  async function execute<T>(
    apiKey: string,
    method: string,
    handler: () => Promise<T> | T,
    units?: number,
  ): Promise<T> {
    const startTime = Date.now()

    // 0. Validate units (public API input — reject nonsense before it
    // propagates into cost calculation). A NaN, Infinity, or negative
    // units value would produce garbage costs downstream: negative
    // costs would silently credit consumers, NaN costs would throw
    // InsufficientCreditsError with NaN in the payload, and Infinity
    // would always reject regardless of balance.
    if (units !== undefined) {
      if (typeof units !== 'number' || !Number.isFinite(units) || units < 0) {
        throw new Error(
          `Invalid units: ${String(units)}. ` +
            'WrapOptions.units must be a finite non-negative number ' +
            '(e.g. tokens, bytes, or seconds). ' +
            'Omit the field to use the pricing model default.',
        )
      }
    }

    // 1. Validate key
    const validation = await validateKey(apiKey)
    if (!validation.valid) {
      throw new InvalidKeyError()
    }

    // 2. Check credits (threads units through to resolveOperationCost)
    const { sufficient, costCents } = checkCredits(
      validation.balanceCents,
      method,
      units,
    )
    if (!sufficient) {
      throw new InsufficientCreditsError(costCents, validation.balanceCents)
    }

    // 3. Execute the handler
    const result = await handler()

    // 4. Meter the invocation (fire and forget in non-debug mode)
    const context: InvocationContext = {
      consumerId: validation.consumerId,
      toolId: validation.toolId,
      keyId: validation.keyId,
      method,
      costCents,
      startTime,
    }

    if (config.debug) {
      await meter(context)
    } else {
      // Fire and forget — don't block the response
      // Errors are silently swallowed; debug mode (above) awaits for diagnostics
      meter(context).catch(() => {})
    }

    return result
  }

  return {
    validateKey,
    checkCredits,
    meter,
    execute,
    clearCache: () => cache.clear(),
    getCacheSize: () => cache.size,
  }
}
