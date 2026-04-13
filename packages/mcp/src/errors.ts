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
    topUpUrl?: string | null
  ) {
    // Coalesce null / undefined / empty string to the default top-up URL.
    // JS default-parameter syntax (`= 'default'`) only fires on `undefined`
    // — explicit `null` would leak into the message as the literal string
    // "null". Empty string is similarly a broken URL. `||` handles all
    // three falsy cases correctly.
    const resolvedTopUpUrl =
      (typeof topUpUrl === 'string' && topUpUrl.length > 0
        ? topUpUrl
        : 'https://settlegrid.ai/top-up')
    super(
      `Insufficient credits: need ${requiredCents} cents, have ${availableCents} cents. Top up at ${resolvedTopUpUrl}`,
      'INSUFFICIENT_CREDITS',
      402
    )
    this.name = 'InsufficientCreditsError'
    this.requiredCents = requiredCents
    this.availableCents = availableCents
    this.topUpUrl = resolvedTopUpUrl
  }
}

/**
 * Thrown when a consumer sets a `settlegrid-max-cost-cents` budget cap
 * in tool-call metadata and the resolved cost of the invocation exceeds
 * that cap. The call is rejected BEFORE the handler runs so the consumer
 * is never charged for a tool they refused to pay for.
 *
 * **How to fix:** Either increase `settlegrid-max-cost-cents` (or omit it
 * entirely to use the default cap) or use a cheaper invocation method.
 * The `maxCents` and `requiredCents` properties tell you the exact delta.
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof BudgetExceededError) {
 *     console.log(`Call would cost ${err.requiredCents}c but budget cap is ${err.maxCents}c`)
 *   }
 * }
 * ```
 */
export class BudgetExceededError extends SettleGridError {
  public readonly maxCents: number
  public readonly requiredCents: number

  constructor(maxCents: number, requiredCents: number) {
    super(
      `Budget exceeded: settlegrid-max-cost-cents is ${maxCents} but this call would cost ${requiredCents} cents. Increase the cap or omit the header.`,
      'BUDGET_EXCEEDED',
      402
    )
    this.name = 'BudgetExceededError'
    this.maxCents = maxCents
    this.requiredCents = requiredCents
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

  /**
   * Construct a RateLimitedError from a retry-delay value in seconds
   * (matches the `Retry-After: <seconds>` HTTP header format and the
   * P1.SDK3 spec wording "pass to RateLimitedError(retryAfterSeconds)").
   *
   * Input is validated: non-finite or negative values throw TypeError.
   * Fractional inputs are floored to match HTTP's integer-seconds
   * convention, which means the round-trip through the `retryAfterSeconds`
   * getter is lossless (i.e. `fromSeconds(n).retryAfterSeconds === Math.floor(n)`).
   *
   * @throws {TypeError} if `retryAfterSeconds` is not a finite non-negative number
   *
   * @example
   * ```typescript
   * const seconds = parseInt(response.headers.get('retry-after'), 10)
   * throw RateLimitedError.fromSeconds(seconds)
   * ```
   */
  static fromSeconds(retryAfterSeconds: number): RateLimitedError {
    if (
      typeof retryAfterSeconds !== 'number' ||
      !Number.isFinite(retryAfterSeconds) ||
      retryAfterSeconds < 0
    ) {
      throw new TypeError(
        `RateLimitedError.fromSeconds requires a finite non-negative number, got ${String(retryAfterSeconds)}`,
      )
    }
    // Floor to integer seconds (RFC 7231 Retry-After is delta-seconds as
    // an integer) before converting to ms. This makes the round-trip
    // through the `retryAfterSeconds` getter lossless.
    return new RateLimitedError(Math.floor(retryAfterSeconds) * 1000)
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
