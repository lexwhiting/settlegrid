import { describe, it, expect, vi } from 'vitest'

// Mock @upstash/redis and @upstash/ratelimit before importing
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}))

vi.mock('@upstash/ratelimit', () => {
  const mockLimiter = {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    }),
  }
  return {
    Ratelimit: Object.assign(
      vi.fn().mockImplementation(() => mockLimiter),
      {
        slidingWindow: vi.fn().mockReturnValue({ type: 'sliding_window' }),
      }
    ),
  }
})

vi.mock('@/lib/env', () => ({
  getRedisUrl: vi.fn().mockReturnValue('redis://localhost:6379'),
  getUpstashRedisRestToken: vi.fn().mockReturnValue('test-token'),
}))

import { createRateLimiter, checkRateLimit, authLimiter, apiLimiter, sdkLimiter } from '@/lib/rate-limit'
import type { RateLimitResult } from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('returns a rate limiter object', () => {
    const limiter = createRateLimiter(10, '1 m')
    expect(limiter).toBeDefined()
    expect(typeof limiter.limit).toBe('function')
  })

  it('creates limiter with different parameters', () => {
    const limiter1 = createRateLimiter(5, '1 m')
    const limiter2 = createRateLimiter(1000, '1 h')
    expect(limiter1).toBeDefined()
    expect(limiter2).toBeDefined()
  })
})

describe('checkRateLimit', () => {
  it('returns a RateLimitResult with correct shape', async () => {
    const limiter = createRateLimiter(100, '1 m')
    const result: RateLimitResult = await checkRateLimit(limiter, 'test-identifier')

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('remaining')
    expect(result).toHaveProperty('reset')
    expect(typeof result.success).toBe('boolean')
    expect(typeof result.limit).toBe('number')
    expect(typeof result.remaining).toBe('number')
    expect(typeof result.reset).toBe('number')
  })

  it('returns success=true for allowed requests', async () => {
    const limiter = createRateLimiter(100, '1 m')
    const result = await checkRateLimit(limiter, 'allowed-user')
    expect(result.success).toBe(true)
  })

  it('returns limit and remaining fields', async () => {
    const limiter = createRateLimiter(100, '1 m')
    const result = await checkRateLimit(limiter, 'test-user')
    expect(result.limit).toBe(100)
    expect(result.remaining).toBe(99)
  })

  it('returns reset timestamp', async () => {
    const limiter = createRateLimiter(100, '1 m')
    const result = await checkRateLimit(limiter, 'test-user')
    expect(result.reset).toBeGreaterThan(0)
  })
})

describe('pre-configured rate limiters', () => {
  it('authLimiter is defined', () => {
    expect(authLimiter).toBeDefined()
  })

  it('apiLimiter is defined', () => {
    expect(apiLimiter).toBeDefined()
  })

  it('sdkLimiter is defined', () => {
    expect(sdkLimiter).toBeDefined()
  })

  it('all limiters have a limit method', () => {
    expect(typeof authLimiter.limit).toBe('function')
    expect(typeof apiLimiter.limit).toBe('function')
    expect(typeof sdkLimiter.limit).toBe('function')
  })
})
