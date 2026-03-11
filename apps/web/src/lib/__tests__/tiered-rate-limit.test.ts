import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }),
}))

import { getTierLimits } from '@/lib/rate-limit'

describe('Tiered Rate Limiting', () => {
  it('returns free tier limits', () => {
    const limits = getTierLimits('free')
    expect(limits.api).toBe(30)
    expect(limits.sdk).toBe(100)
  })

  it('returns starter tier limits', () => {
    const limits = getTierLimits('starter')
    expect(limits.api).toBe(60)
    expect(limits.sdk).toBe(500)
  })

  it('returns pro tier limits', () => {
    const limits = getTierLimits('pro')
    expect(limits.api).toBe(200)
    expect(limits.sdk).toBe(2000)
  })

  it('returns enterprise tier limits', () => {
    const limits = getTierLimits('enterprise')
    expect(limits.api).toBe(1000)
    expect(limits.sdk).toBe(10000)
  })

  it('falls back to free tier for unknown tier', () => {
    const limits = getTierLimits('unknown-tier')
    expect(limits.api).toBe(30)
    expect(limits.sdk).toBe(100)
  })

  it('is case-insensitive for tier names', () => {
    const limits = getTierLimits('Enterprise')
    expect(limits.api).toBe(1000)
    expect(limits.sdk).toBe(10000)
  })
})
