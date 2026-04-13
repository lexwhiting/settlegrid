/**
 * @settlegrid/mcp - Error classes
 *
 * All SDK errors extend {@link SettleGridError}, making it easy to catch
 * any SettleGrid-specific error with a single `catch` block. Each error
 * carries an HTTP-compatible `statusCode` and a machine-readable `code`.
 *
 * @example
 * ```typescript
 * import { SettleGridError, InvalidKeyError } from '@settlegrid/mcp'
 *
 * try {
 *   await wrappedHandler(args, ctx)
 * } catch (err) {
 *   if (err instanceof InvalidKeyError) {
 *     console.error('Bad API key:', err.message)
 *   } else if (err instanceof SettleGridError) {
 *     console.error(`SettleGrid error [${err.code}]:`, err.message)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { SettleGridErrorCode } from './types'

/**
 * Base error class for all SettleGrid errors.
 *
 * Every error thrown by the SDK extends this class, so you can catch all
 * SettleGrid errors with `catch (err) { if (err instanceof SettleGridError) ... }`.
 *
 * @example
 * ```typescript
 * try {
 *   await sg.validateKey(apiKey)
 * } catch (err) {
 *   if (err instanceof SettleGridError) {
 *     // err.code  — machine-readable error code (e.g. 'INVALID_KEY')
 *     // err.statusCode — HTTP-compatible status (e.g. 401)
 *     // err.toJSON() — serializable representation
 *     return Response.json(err.toJSON(), { status: err.statusCode })
 *   }
 * }
 * ```
 */
export class SettleGridError extends Error {
  public readonly code: SettleGridErrorCode
  public readonly statusCode: number

  constructor(message: string, code: SettleGridErrorCode, statusCode: number) {
    super(message)
    this.name = 'SettleGridError'
    this.code = code
    this.statusCode = statusCode
  }

  /**
   * Serialize the error to a JSON-safe object suitable for API responses.
   *
   * @returns An object with `error`, `code`, and `statusCode` fields.
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    }
  }
}

/**
 * Thrown when an API key is invalid, revoked, expired, or not found.
 *
 * **How to fix:** Verify the API key is correct and active in the
 * SettleGrid dashboard. Ensure you are passing it via `x-api-key` header,
 * `Authorization: Bearer <key>`, or `settlegrid-api-key` in MCP metadata.
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof InvalidKeyError) {
 *     return new Response('Check your API key at https://settlegrid.ai/keys', { status: 401 })
 *   }
 * }
 * ```
 */
export class InvalidKeyError extends SettleGridError {
  constructor(message = 'Invalid or revoked API key. Verify your key at https://settlegrid.ai/keys') {
    super(message, 'INVALID_KEY', 401)
    this.name = 'InvalidKeyError'
  }
}

/**
 * Thrown when a consumer's credit balance is too low for the invocation.
 *
 * **How to fix:** Top up credits at `https://settlegrid.ai/top-up?tool=<your-tool-slug>`.
 * The `requiredCents` and `availableCents` properties tell you exactly how much is needed.
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof InsufficientCreditsError) {
 *     console.log(`Need ${err.requiredCents}c but only have ${err.availableCents}c`)
 *   }
 * }
 * ```
 */
export class InsufficientCreditsError extends SettleGridError {
  public readonly requiredCents: number
  public readonly availableCents: number
  /**
   * URL the consumer should visit to top up their credits. Defaults to
   * the SettleGrid-hosted top-up page, but the API may override this
   * per-tool (e.g. to link directly to the tool-specific funnel).
   */
  public readonly topUpUrl: string

  constructor(
    requiredCents: number,
    availableCents: number,
    topUpUrl: string = 'https://settlegrid.ai/top-up'
  ) {
    super(
      `Insufficient credits: need ${requiredCents} cents, have ${availableCents} cents. Top up at ${topUpUrl}`,
      'INSUFFICIENT_CREDITS',
      402
    )
    this.name = 'InsufficientCreditsError'
    this.requiredCents = requiredCents
    this.availableCents = availableCents
    this.topUpUrl = topUpUrl
  }
}

/**
 * Thrown when the requested tool slug is not registered on SettleGrid.
 *
 * **How to fix:** Check that `toolSlug` matches exactly what you registered
 * in the SettleGrid dashboard. Slugs are case-sensitive.
 */
export class ToolNotFoundError extends SettleGridError {
  constructor(slug: string) {
    super(
      `Tool not found: "${slug}". Register it at https://settlegrid.ai/tools or check for typos in your toolSlug.`,
      'TOOL_NOT_FOUND',
      404
    )
    this.name = 'ToolNotFoundError'
  }
}

/**
 * Thrown when the tool exists but is disabled or not yet published.
 *
 * **How to fix:** Enable the tool in the SettleGrid dashboard under
 * Tools > Settings > Status.
 */
export class ToolDisabledError extends SettleGridError {
  constructor(slug: string) {
    super(
      `Tool is not active: "${slug}". Enable it in your SettleGrid dashboard at https://settlegrid.ai/tools.`,
      'TOOL_DISABLED',
      403
    )
    this.name = 'ToolDisabledError'
  }
}

/**
 * Thrown when the consumer has exceeded their rate limit.
 *
 * The `retryAfterMs` property indicates how long to wait before retrying.
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof RateLimitedError) {
 *     await new Promise(r => setTimeout(r, err.retryAfterMs))
 *     // retry the request
 *   }
 * }
 * ```
 */
export class RateLimitedError extends SettleGridError {
  public readonly retryAfterMs: number

  constructor(retryAfterMs: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterMs}ms.`,
      'RATE_LIMITED',
      429
    )
    this.name = 'RateLimitedError'
    this.retryAfterMs = retryAfterMs
  }

  /**
   * Retry delay in seconds, derived from `retryAfterMs`. Matches the
   * `Retry-After: <seconds>` HTTP header format so callers can
   * `Retry-After: ${err.retryAfterSeconds}` without doing the math
   * themselves.
   */
  get retryAfterSeconds(): number {
    return Math.floor(this.retryAfterMs / 1000)
  }
}

/**
 * Thrown when the SettleGrid API is temporarily unavailable (5xx).
 *
 * **How to fix:** This is transient. Retry with exponential backoff.
 * Check https://status.settlegrid.ai for outage information.
 */
export class SettleGridUnavailableError extends SettleGridError {
  constructor(message = 'SettleGrid API is temporarily unavailable. Check https://status.settlegrid.ai for status.') {
    super(message, 'SERVER_ERROR', 503)
    this.name = 'SettleGridUnavailableError'
  }
}

/**
 * Thrown on network failures (DNS resolution, connection refused, etc.).
 *
 * **How to fix:** Check your network connectivity. If running in a
 * restricted environment (e.g., VPC), ensure `settlegrid.ai` is reachable.
 */
export class NetworkError extends SettleGridError {
  constructor(message = 'Network error connecting to SettleGrid. Check your internet connection and firewall rules.') {
    super(message, 'NETWORK_ERROR', 503)
    this.name = 'NetworkError'
  }
}

/**
 * Thrown when an API request to SettleGrid times out.
 *
 * **How to fix:** Increase `timeoutMs` in your SDK config (default: 5000ms,
 * max: 30000ms). If timeouts persist, check network latency to settlegrid.ai.
 *
 * @example
 * ```typescript
 * // Increase timeout for slow networks
 * const sg = settlegrid.init({
 *   toolSlug: 'my-tool',
 *   pricing: { defaultCostCents: 1 },
 *   timeoutMs: 10000, // 10 seconds
 * })
 * ```
 */
export class TimeoutError extends SettleGridError {
  constructor(timeoutMs: number) {
    super(
      `Request timed out after ${timeoutMs}ms. Increase timeoutMs in your SDK config (max: 30000) or check network latency.`,
      'TIMEOUT',
      504
    )
    this.name = 'TimeoutError'
  }
}
