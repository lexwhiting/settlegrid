/**
 * @settlegrid/mcp - Error classes
 */

import type { SettleGridErrorCode } from './types'

/** Base error class for all SettleGrid errors */
export class SettleGridError extends Error {
  public readonly code: SettleGridErrorCode
  public readonly statusCode: number

  constructor(message: string, code: SettleGridErrorCode, statusCode: number) {
    super(message)
    this.name = 'SettleGridError'
    this.code = code
    this.statusCode = statusCode
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    }
  }
}

/** Thrown when an API key is invalid, revoked, or not found */
export class InvalidKeyError extends SettleGridError {
  constructor(message = 'Invalid or revoked API key') {
    super(message, 'INVALID_KEY', 401)
    this.name = 'InvalidKeyError'
  }
}

/** Thrown when a consumer has insufficient credits for the invocation */
export class InsufficientCreditsError extends SettleGridError {
  public readonly requiredCents: number
  public readonly availableCents: number

  constructor(requiredCents: number, availableCents: number) {
    super(
      `Insufficient credits: need ${requiredCents} cents, have ${availableCents} cents`,
      'INSUFFICIENT_CREDITS',
      402
    )
    this.name = 'InsufficientCreditsError'
    this.requiredCents = requiredCents
    this.availableCents = availableCents
  }
}

/** Thrown when the requested tool is not found */
export class ToolNotFoundError extends SettleGridError {
  constructor(slug: string) {
    super(`Tool not found: ${slug}`, 'TOOL_NOT_FOUND', 404)
    this.name = 'ToolNotFoundError'
  }
}

/** Thrown when the tool is disabled/not published */
export class ToolDisabledError extends SettleGridError {
  constructor(slug: string) {
    super(`Tool is not active: ${slug}`, 'TOOL_DISABLED', 403)
    this.name = 'ToolDisabledError'
  }
}

/** Thrown when rate limit is exceeded */
export class RateLimitedError extends SettleGridError {
  public readonly retryAfterMs: number

  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterMs}ms`, 'RATE_LIMITED', 429)
    this.name = 'RateLimitedError'
    this.retryAfterMs = retryAfterMs
  }
}

/** Thrown when the SettleGrid API is unavailable */
export class SettleGridUnavailableError extends SettleGridError {
  constructor(message = 'SettleGrid API is temporarily unavailable') {
    super(message, 'SERVER_ERROR', 503)
    this.name = 'SettleGridUnavailableError'
  }
}

/** Thrown on network failures */
export class NetworkError extends SettleGridError {
  constructor(message = 'Network error connecting to SettleGrid') {
    super(message, 'NETWORK_ERROR', 503)
    this.name = 'NetworkError'
  }
}

/** Thrown when a request times out */
export class TimeoutError extends SettleGridError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT', 504)
    this.name = 'TimeoutError'
  }
}
