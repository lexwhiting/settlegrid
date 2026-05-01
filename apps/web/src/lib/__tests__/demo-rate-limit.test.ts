/**
 * P4.K1 — tests for demo-rate-limit.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  __resetDemoRateLimiterForTests,
  checkDemoRateLimit,
  DEMO_RATE_LIMIT_REQUESTS,
  extractClientIp,
} from '../demo-rate-limit'

// Mock the underlying limiter factory before any module-level cache
// is populated by other suites that import this file's neighbours.
const mockLimit = vi.fn()
vi.mock('../rate-limit', async () => {
  const actual = await vi.importActual<typeof import('../rate-limit')>('../rate-limit')
  return {
    ...actual,
    createRateLimiter: () => ({ limit: mockLimit }),
  }
})

beforeEach(() => {
  __resetDemoRateLimiterForTests()
  mockLimit.mockReset()
})

describe('extractClientIp', () => {
  it('returns the left-most x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.4, 10.0.0.1' })
    expect(extractClientIp(headers)).toBe('203.0.113.4')
  })

  it('trims whitespace from the chosen entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '  203.0.113.4  ' })
    expect(extractClientIp(headers)).toBe('203.0.113.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.7' })
    expect(extractClientIp(headers)).toBe('198.51.100.7')
  })

  it('returns "unknown-ip" when neither header is present', () => {
    expect(extractClientIp(new Headers())).toBe('unknown-ip')
  })

  it('returns "unknown-ip" when x-forwarded-for is empty', () => {
    const headers = new Headers({ 'x-forwarded-for': '' })
    expect(extractClientIp(headers)).toBe('unknown-ip')
  })

  it('returns "unknown-ip" when x-forwarded-for has only commas', () => {
    const headers = new Headers({ 'x-forwarded-for': ',,' })
    expect(extractClientIp(headers)).toBe('unknown-ip')
  })

  it('does not pick spoofed entries to the right of the first', () => {
    // The left-most entry is the original client per Vercel's
    // proxy. Anything an attacker prepends client-side ends up to
    // the right of Vercel's injected value, so taking only [0] is
    // the safe bucket key.
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.4, malicious-spoof, 10.0.0.1',
    })
    expect(extractClientIp(headers)).toBe('203.0.113.4')
  })
})

describe('checkDemoRateLimit', () => {
  it('returns the underlying limiter result on success', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 1700000000,
    })
    const result = await checkDemoRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.4' }),
    )
    expect(result.success).toBe(true)
    expect(result.limit).toBe(30)
    expect(result.remaining).toBe(29)
    expect(result.identifier).toBe('203.0.113.4')
  })

  it('keys the bucket on the demo namespace + IP so it does not collide with other limiters', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 30,
      remaining: 30,
      reset: 0,
    })
    await checkDemoRateLimit(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    expect(mockLimit).toHaveBeenCalledWith('demo-kernel:1.2.3.4')
  })

  it('returns success=false when the limiter rejects', async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60_000,
    })
    const result = await checkDemoRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.4' }),
    )
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('fails OPEN when the limiter throws (Upstash unreachable)', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Connection refused'))
    const result = await checkDemoRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.4' }),
    )
    expect(result.success).toBe(true)
    expect(result.limit).toBe(DEMO_RATE_LIMIT_REQUESTS)
    expect(result.identifier).toBe('203.0.113.4')
  })

  it('uses unknown-ip when no IP headers are present', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
    })
    const result = await checkDemoRateLimit(new Headers())
    expect(result.identifier).toBe('unknown-ip')
    expect(mockLimit).toHaveBeenCalledWith('demo-kernel:unknown-ip')
  })
})

describe('DEMO_RATE_LIMIT_REQUESTS', () => {
  it('matches the spec card cap (30 per hour)', () => {
    expect(DEMO_RATE_LIMIT_REQUESTS).toBe(30)
  })
})
