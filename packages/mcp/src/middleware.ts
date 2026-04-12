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
  SettleGridUnavailableError,
  TimeoutError,
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

/** HTTP client for SettleGrid API calls */
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
      const data = await response.json().catch(() => ({}))
      const errorData = data as { error?: string; code?: string }
      if (response.status === 401) {
        throw new InvalidKeyError(errorData.error)
      }
      if (response.status === 402) {
        throw new InsufficientCreditsError(0, 0)
      }
      throw new SettleGridUnavailableError(
        errorData.error ?? `API returned ${response.status}`
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(config.timeoutMs)
    }
    if (
      error instanceof InvalidKeyError ||
      error instanceof InsufficientCreditsError ||
      error instanceof SettleGridUnavailableError
    ) {
      throw error
    }
    throw new NetworkError(
      error instanceof Error ? error.message : 'Unknown network error'
    )
  } finally {
    clearTimeout(timeout)
  }
}

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
