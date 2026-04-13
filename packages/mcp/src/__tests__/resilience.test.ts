/**
 * Resilience layer tests — P1.SDK5
 *
 * Covers the four resilience features added to the SDK's HTTP client:
 *   1. Token-bucket rate limiting
 *   2. Exponential backoff on 5xx
 *   3. Circuit breaker (open/half-open/closed)
 *   4. Negative caching for invalid keys
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { __internal__, createMiddleware } from '../middleware'
import { TokenBucketRateLimiter } from '../rate-limiter'
import { CircuitBreaker } from '../circuit-breaker'
import { LRUCache } from '../cache'
import type { NormalizedConfig } from '../config'
import {
  RateLimitedError,
  SettleGridUnavailableError,
  InvalidKeyError,
} from '../errors'

const { apiCall } = __internal__

const baseConfig: NormalizedConfig = {
  apiUrl: 'https://settlegrid.ai',
  toolSlug: 'resilience-test',
  debug: false,
  cacheTtlMs: 300_000,
  timeoutMs: 5000,
}

function makeResilience(overrides?: {
  callsPerSecond?: number
  threshold?: number
  resetMs?: number
  maxRetries?: number
}) {
  return {
    rateLimiter: new TokenBucketRateLimiter(overrides?.callsPerSecond ?? 100),
    circuitBreaker: new CircuitBreaker(
      overrides?.threshold ?? 10,
      overrides?.resetMs ?? 60_000,
    ),
    maxRetries: overrides?.maxRetries ?? 3,
  }
}

// ─── Rate limit ──────────────────────────────────────────────────────────────

describe('rate limit', () => {
  it('allows calls under the rate limit', () => {
    const limiter = new TokenBucketRateLimiter(10)
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume()).toBe(true)
    }
  })

  it('rejects calls over the rate limit', () => {
    const limiter = new TokenBucketRateLimiter(5)
    // Exhaust all tokens
    for (let i = 0; i < 5; i++) {
      limiter.tryConsume()
    }
    // Next call should be rejected
    expect(limiter.tryConsume()).toBe(false)
  })

  it('throws RateLimitedError with correct retryAfterMs when exhausted via apiCall', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    )
    const resilience = makeResilience({ callsPerSecond: 2 })

    // Exhaust the bucket
    resilience.rateLimiter.tryConsume()
    resilience.rateLimiter.tryConsume()

    try {
      await apiCall(baseConfig, '/test', {}, resilience)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitedError)
      // 2 calls/sec → msPerToken = ceil(1000/2) = 500ms
      expect((err as RateLimitedError).retryAfterMs).toBe(500)
    }

    // fetch should never have been called — rate limiter rejects pre-flight
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('validates constructor input', () => {
    expect(() => new TokenBucketRateLimiter(0)).toThrow()
    expect(() => new TokenBucketRateLimiter(-1)).toThrow()
    expect(() => new TokenBucketRateLimiter(NaN)).toThrow()
    expect(() => new TokenBucketRateLimiter(1.5)).toThrow()
    expect(() => new TokenBucketRateLimiter(Infinity)).toThrow()
  })
})

// ─── Exponential backoff ─────────────────────────────────────────────────────

describe('exponential backoff on 5xx', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('retries on 5xx with backoff delays: 1s, 2s, 4s then fails', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"server down"}', { status: 500 }),
    )
    const resilience = makeResilience({ maxRetries: 3 })

    // Attach rejection handler BEFORE advancing timers to prevent
    // unhandled rejection warnings from Node.js
    const settled = apiCall(baseConfig, '/test', {}, resilience)
      .then(() => 'resolved' as const)
      .catch((e: unknown) => e)

    // Advance through backoff delays: 1s, 2s, 4s
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)

    const error = await settled
    expect(error).toBeInstanceOf(SettleGridUnavailableError)
    // 1 initial + 3 retries = 4 total fetch calls
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('does NOT retry on 4xx responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"bad key"}', { status: 401 }),
    )
    const resilience = makeResilience({ maxRetries: 3 })

    await expect(
      apiCall(baseConfig, '/test', {}, resilience),
    ).rejects.toThrow(InvalidKeyError)

    // Only 1 fetch call — no retry on 4xx
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('returns immediately on success without retrying', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    )
    const resilience = makeResilience({ maxRetries: 3 })

    const result = await apiCall<{ ok: boolean }>(baseConfig, '/test', {}, resilience)

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

// ─── Circuit breaker ─────────────────────────────────────────────────────────

describe('circuit breaker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens after N consecutive failures', () => {
    const breaker = new CircuitBreaker(3, 60_000)
    expect(breaker.currentState).toBe('closed')

    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.currentState).toBe('closed')

    breaker.recordFailure() // 3rd failure = threshold
    expect(breaker.currentState).toBe('open')
  })

  it('fast-fails while circuit breaker is open', () => {
    const breaker = new CircuitBreaker(2, 60_000)
    breaker.recordFailure()
    breaker.recordFailure() // opens

    expect(breaker.canExecute()).toBe(false)
  })

  it('transitions to half-open after reset period', () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker(2, 5000)
    breaker.recordFailure()
    breaker.recordFailure() // opens

    expect(breaker.canExecute()).toBe(false)

    // Advance past reset period
    vi.advanceTimersByTime(5000)
    expect(breaker.canExecute()).toBe(true)
    expect(breaker.currentState).toBe('half-open')
  })

  it('closes on success after half-open probe', () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker(2, 5000)
    breaker.recordFailure()
    breaker.recordFailure() // opens

    vi.advanceTimersByTime(5000) // transition to half-open
    breaker.canExecute() // triggers half-open transition

    breaker.recordSuccess()
    expect(breaker.currentState).toBe('closed')
    expect(breaker.canExecute()).toBe(true)
  })

  it('rejects additional requests while half-open probe is in flight', () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker(2, 5000)
    breaker.recordFailure()
    breaker.recordFailure() // opens

    vi.advanceTimersByTime(5000)
    // First call transitions to half-open and allows the probe
    expect(breaker.canExecute()).toBe(true)
    expect(breaker.currentState).toBe('half-open')

    // Second call while probe is still in flight — must be rejected
    expect(breaker.canExecute()).toBe(false)
    expect(breaker.canExecute()).toBe(false) // stays rejected
  })

  it('re-opens on failure during half-open probe', () => {
    vi.useFakeTimers()
    const breaker = new CircuitBreaker(2, 5000)
    breaker.recordFailure()
    breaker.recordFailure() // opens

    vi.advanceTimersByTime(5000)
    breaker.canExecute() // half-open

    breaker.recordFailure() // probe failed
    expect(breaker.currentState).toBe('open')
  })

  it('throws SettleGridUnavailableError when circuit is open via apiCall', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const resilience = makeResilience({ threshold: 2 })

    // Open the circuit
    resilience.circuitBreaker.recordFailure()
    resilience.circuitBreaker.recordFailure()

    await expect(
      apiCall(baseConfig, '/test', {}, resilience),
    ).rejects.toThrow(SettleGridUnavailableError)

    // fetch should never have been called — circuit breaker rejects pre-flight
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('validates constructor input', () => {
    expect(() => new CircuitBreaker(0, 1000)).toThrow()
    expect(() => new CircuitBreaker(-1, 1000)).toThrow()
    expect(() => new CircuitBreaker(10, 0)).toThrow()
    expect(() => new CircuitBreaker(NaN, 1000)).toThrow()
    expect(() => new CircuitBreaker(10, Infinity)).toThrow()
  })
})

// ─── Negative cache ──────────────────────────────────────────────────────────

describe('negative cache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('caches invalid key results for shorter TTL (30s negative cache)', () => {
    vi.useFakeTimers()
    const cache = new LRUCache(100, 300_000) // 5 min default TTL

    const invalidResult = {
      valid: false as const,
      consumerId: '',
      toolId: '',
      keyId: '',
      balanceCents: 0,
    }

    // Store with 30s negative cache TTL
    cache.set('bad-key', invalidResult, 30_000)
    expect(cache.get('bad-key')).toEqual(invalidResult)

    // Advance past negative TTL but before default TTL
    vi.advanceTimersByTime(31_000)
    expect(cache.get('bad-key')).toBeUndefined()
  })

  it('prevents repeated API calls for same invalid key (negative cache integration)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        valid: false,
        consumerId: '',
        toolId: '',
        keyId: '',
        balanceCents: 0,
      }), { status: 200 }),
    )

    const middleware = createMiddleware(baseConfig, { defaultCostCents: 1 })

    // First call — hits the API
    const result1 = await middleware.validateKey('bad-key')
    expect(result1.valid).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Second call — must hit negative cache, NOT the API
    const result2 = await middleware.validateKey('bad-key')
    expect(result2.valid).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // still 1, not 2

    vi.restoreAllMocks()
  })

  it('uses normal cache path for valid keys (default TTL)', () => {
    vi.useFakeTimers()
    const cache = new LRUCache(100, 300_000) // 5 min default TTL

    const validResult = {
      valid: true as const,
      consumerId: 'c_123',
      toolId: 't_456',
      keyId: 'k_789',
      balanceCents: 5000,
    }

    // Store with default TTL (no override)
    cache.set('good-key', validResult)
    expect(cache.get('good-key')).toEqual(validResult)

    // After 30s, valid key should still be cached (uses 5min TTL)
    vi.advanceTimersByTime(31_000)
    expect(cache.get('good-key')).toEqual(validResult)

    // After full TTL, entry expires
    vi.advanceTimersByTime(270_000) // 31s + 270s = 301s > 300s
    expect(cache.get('good-key')).toBeUndefined()
  })
})
