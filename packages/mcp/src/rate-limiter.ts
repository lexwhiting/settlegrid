/**
 * @settlegrid/mcp - Token-bucket rate limiter
 *
 * Limits the rate of API calls to prevent overwhelming the SettleGrid API.
 * Used internally by createMiddleware to enforce per-instance rate limits.
 *
 * @packageDocumentation
 */

/**
 * Token-bucket rate limiter.
 *
 * Each API call consumes one token. Tokens refill continuously at
 * `callsPerSecond` rate. When the bucket is empty, calls are rejected
 * until tokens refill.
 */
export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly capacity: number
  private readonly refillRatePerMs: number

  /**
   * @param callsPerSecond - Maximum calls per second (must be a positive finite integer)
   * @throws {Error} If callsPerSecond is not a positive finite integer
   */
  constructor(callsPerSecond: number) {
    if (
      typeof callsPerSecond !== 'number' ||
      !Number.isFinite(callsPerSecond) ||
      !Number.isInteger(callsPerSecond) ||
      callsPerSecond <= 0
    ) {
      throw new Error(
        `Invalid callsPerSecond: ${String(callsPerSecond)}. Must be a positive finite integer.`,
      )
    }
    this.capacity = callsPerSecond
    this.tokens = callsPerSecond
    this.refillRatePerMs = callsPerSecond / 1000
    this.lastRefill = Date.now()
  }

  /**
   * Try to consume one token. Refills the bucket based on elapsed time
   * before checking availability.
   *
   * @returns `true` if a token was consumed, `false` if the bucket is empty
   */
  tryConsume(): boolean {
    this.refill()
    if (this.tokens < 1) {
      return false
    }
    this.tokens -= 1
    return true
  }

  /** Milliseconds per token at the configured rate (used for retry-after hints) */
  get msPerToken(): number {
    return Math.ceil(1000 / this.capacity)
  }

  /** Refill tokens based on elapsed time since last refill */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    if (elapsed <= 0) return
    // Clamp to capacity to prevent floating-point drift accumulation
    this.tokens = Math.min(this.tokens + elapsed * this.refillRatePerMs, this.capacity)
    this.lastRefill = now
  }
}
