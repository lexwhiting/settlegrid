import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { getTierLimits, checkTieredRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

describe('Tiered Rate Limiting', () => {
  it('returns free tier limits', () => {
    const limits = getTierLimits('free')
    expect(limits.api).toBe(30)
    expect(limits.sdk).toBe(200)
  })

  it('returns builder tier limits', () => {
    const limits = getTierLimits('builder')
    expect(limits.api).toBe(200)
    expect(limits.sdk).toBe(4000)
  })

  it('maps legacy starter to builder tier limits', () => {
    const limits = getTierLimits('starter')
    expect(limits.api).toBe(200)
    expect(limits.sdk).toBe(4000)
  })

  it('maps legacy growth to builder tier limits', () => {
    const limits = getTierLimits('growth')
    expect(limits.api).toBe(200)
    expect(limits.sdk).toBe(4000)
  })

  it('returns scale tier limits', () => {
    const limits = getTierLimits('scale')
    expect(limits.api).toBe(500)
    expect(limits.sdk).toBe(16000)
  })

  it('returns enterprise tier limits', () => {
    const limits = getTierLimits('enterprise')
    expect(limits.api).toBe(1000)
    expect(limits.sdk).toBe(50000)
  })

  it('falls back to free tier for unknown tier', () => {
    const limits = getTierLimits('unknown-tier')
    expect(limits.api).toBe(30)
    expect(limits.sdk).toBe(200)
  })

  it('is case-insensitive for tier names', () => {
    const limits = getTierLimits('Enterprise')
    expect(limits.api).toBe(1000)
    expect(limits.sdk).toBe(50000)
  })
})

describe('checkTieredRateLimit — store-failure fail-open (H1)', () => {
  it('fails open with an operator alert when limiter creation throws', async () => {
    // createRateLimiter evaluates getRedis() eagerly — a missing-env throw
    // (requireEnv) surfaces at creation, OUTSIDE checkRateLimit's guard.
    vi.mocked(getRedis).mockImplementationOnce(() => {
      throw new Error('REDIS_URL is not set')
    })

    // Unique raw tier string → unique tier:type cache key → the creation
    // branch is guaranteed to run (nothing cached from other tests).
    const result = await checkTieredRateLimit('ip-1', 'h1-creation-throw-tier', 'api')

    expect(result).toEqual({ success: true, limit: 0, remaining: 0, reset: 0 })
    expect(logger.error).toHaveBeenCalledWith(
      'rate_limit.fail_open',
      expect.objectContaining({ identifier: 'ip-1', error: 'REDIS_URL is not set' })
    )
  })
})
