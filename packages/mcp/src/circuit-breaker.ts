/**
 * @settlegrid/mcp - Circuit breaker
 *
 * Three-state circuit breaker that fast-fails requests when the SettleGrid API
 * is experiencing consecutive failures, preventing cascading failure and
 * reducing wasted latency.
 *
 * @packageDocumentation
 */

/** Circuit breaker state */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Three-state circuit breaker: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.
 *
 * - **CLOSED**: Normal operation. Requests pass through.
 * - **OPEN**: After N consecutive failures, fast-fail all requests for a cooldown period.
 * - **HALF_OPEN**: After the cooldown, allow one probe request through.
 *   If it succeeds -> CLOSED. If it fails -> OPEN again.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState
  private consecutiveFailures: number
  private lastFailureTime: number
  private readonly threshold: number
  private readonly resetMs: number

  /**
   * @param threshold - Number of consecutive failures before opening (must be a positive finite integer)
   * @param resetMs - Cooldown period in ms before half-open probe (must be a positive finite integer)
   * @throws {Error} If threshold or resetMs are not positive finite integers
   */
  constructor(threshold: number, resetMs: number) {
    if (
      typeof threshold !== 'number' ||
      !Number.isFinite(threshold) ||
      !Number.isInteger(threshold) ||
      threshold <= 0
    ) {
      throw new Error(
        `Invalid circuitBreakerThreshold: ${String(threshold)}. Must be a positive finite integer.`,
      )
    }
    if (
      typeof resetMs !== 'number' ||
      !Number.isFinite(resetMs) ||
      !Number.isInteger(resetMs) ||
      resetMs <= 0
    ) {
      throw new Error(
        `Invalid circuitBreakerResetMs: ${String(resetMs)}. Must be a positive finite integer.`,
      )
    }
    this.state = 'closed'
    this.consecutiveFailures = 0
    this.lastFailureTime = 0
    this.threshold = threshold
    this.resetMs = resetMs
  }

  /**
   * Check if a request is allowed to proceed.
   *
   * - CLOSED: always true
   * - OPEN: false unless cooldown has elapsed (transitions to HALF_OPEN, returns true)
   * - HALF_OPEN: true (allow one probe)
   */
  canExecute(): boolean {
    if (this.state === 'closed') return true
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.state = 'half-open'
        return true
      }
      return false
    }
    // half-open: a probe is already in flight — reject additional requests
    // until the probe resolves via recordSuccess() or recordFailure()
    return false
  }

  /** Record a successful request. Resets the breaker to CLOSED. */
  recordSuccess(): void {
    this.state = 'closed'
    this.consecutiveFailures = 0
  }

  /**
   * Record a failed request. Increments the consecutive failure count.
   * If the threshold is reached, transitions to OPEN.
   * In HALF_OPEN state, a single failure re-opens the breaker.
   */
  recordFailure(): void {
    this.consecutiveFailures++
    this.lastFailureTime = Date.now()
    if (this.state === 'half-open') {
      this.state = 'open'
    } else if (this.consecutiveFailures >= this.threshold) {
      this.state = 'open'
    }
  }

  /** Current state of the circuit breaker (for diagnostics) */
  get currentState(): CircuitBreakerState {
    return this.state
  }
}
