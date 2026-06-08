import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { Ratelimit } from '@upstash/ratelimit'
import { createRateLimiter, checkRateLimit, getClientIp, authLimiter, apiLimiter, sdkLimiter, sessionLimiter } from '@/lib/rate-limit'
import type { RateLimitResult } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

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

  it('sessionLimiter is defined (F1)', () => {
    expect(sessionLimiter).toBeDefined()
  })

  it('sessionLimiter exposes a limit method', () => {
    expect(typeof sessionLimiter.limit).toBe('function')
  })

  it('sessionLimiter is configured at 5000/min (source pin — a silent re-tune trips CI)', () => {
    const src = readFileSync(resolve(__dirname, '../rate-limit.ts'), 'utf8')
    expect(src).toMatch(/export const sessionLimiter = lazyLimiter\(5000, '1 m'\)/)
  })
})

describe('checkRateLimit — store-failure fail-mode (H1)', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear()
  })

  /** A limiter whose store rejects (connection refused / DNS / 5xx). */
  function rejectingLimiter(message: string): Ratelimit {
    return { limit: vi.fn().mockRejectedValue(new Error(message)) } as unknown as Ratelimit
  }

  it('fails OPEN by default when the store rejects, with an operator alert', async () => {
    const result = await checkRateLimit(rejectingLimiter('connection refused'), 'ip-1')

    expect(result).toEqual({ success: true, limit: 0, remaining: 0, reset: 0 })
    expect(logger.error).toHaveBeenCalledWith(
      'rate_limit.fail_open',
      expect.objectContaining({ identifier: 'ip-1', error: 'connection refused' })
    )
  })

  it('fails CLOSED when failMode is closed', async () => {
    const result = await checkRateLimit(rejectingLimiter('boom'), 'ip-2', { failMode: 'closed' })

    expect(result).toEqual({ success: false, limit: 0, remaining: 0, reset: 0 })
    expect(logger.error).toHaveBeenCalledWith(
      'rate_limit.fail_closed',
      expect.objectContaining({ identifier: 'ip-2', error: 'boom' })
    )
  })

  it('stringifies non-Error throwables in the alert', async () => {
    const limiter = { limit: vi.fn().mockRejectedValue('raw-string-failure') } as unknown as Ratelimit

    const result = await checkRateLimit(limiter, 'ip-3')

    expect(result.success).toBe(true)
    expect(logger.error).toHaveBeenCalledWith(
      'rate_limit.fail_open',
      expect.objectContaining({ error: 'raw-string-failure' })
    )
  })

  it('does not alter the result on a healthy store', async () => {
    const limiter = createRateLimiter(100, '1 m')

    const result = await checkRateLimit(limiter, 'healthy-user')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(100)
    expect(result.remaining).toBe(99)
    expect(logger.error).not.toHaveBeenCalledWith('rate_limit.fail_open', expect.anything())
  })
})

describe('getClientIp (H1 — shared trusted-IP helper)', () => {
  // The 7 P4.K1 trust-model cases remain in demo-rate-limit.test.ts via the
  // extractClientIp re-export; these are the delta cases.

  it('handles IPv6 addresses', () => {
    const headers = new Headers({ 'x-forwarded-for': '2001:db8::1, 10.0.0.1' })
    expect(getClientIp(headers)).toBe('2001:db8::1')
  })

  it('handles a bare IPv6 loopback', () => {
    const headers = new Headers({ 'x-forwarded-for': '::1' })
    expect(getClientIp(headers)).toBe('::1')
  })

  it('falls back to x-real-ip when x-forwarded-for is only commas', () => {
    const headers = new Headers({ 'x-forwarded-for': ',,,', 'x-real-ip': '198.51.100.7' })
    expect(getClientIp(headers)).toBe('198.51.100.7')
  })

  it('trims whitespace from x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '  203.0.113.9  ' })
    expect(getClientIp(headers)).toBe('203.0.113.9')
  })
})
