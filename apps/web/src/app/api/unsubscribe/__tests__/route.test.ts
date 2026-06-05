/**
 * H1 — rate-limit contract for the public unsubscribe route.
 *
 * Each allowed call writes a PERMANENT no-TTL suppression key, so H1 added
 * an authLimiter (5/min/IP) gate to BOTH verbs as the first statement.
 * These tests pin: 429 on the limited path with ZERO Redis writes (the
 * key-flood vector), the allowed path still writing the suppression key,
 * and the identifier shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockRedisSet } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockRedisSet: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: { __stub: 'authLimiter' },
  checkRateLimit: mockCheckRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({ set: mockRedisSet })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET, POST } from '../route'

describe('unsubscribe route — H1 rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
    mockRedisSet.mockResolvedValue('OK')
  })

  it('POST returns 429 with no Redis write when limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 0 })

    const res = await POST(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('GET returns 429 with no Redis write when limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 0 })

    const res = await GET(
      new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'),
    )

    expect(res.status).toBe(429)
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('POST writes the suppression key when allowed', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'User@Example.com' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(mockRedisSet).toHaveBeenCalledWith('unsub:outreach:user@example.com', '1')
  })

  it('GET writes the suppression key when allowed (email link clicks)', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'),
    )

    expect(res.status).toBe(200)
    expect(mockRedisSet).toHaveBeenCalledWith('unsub:outreach:user@example.com', '1')
  })

  it('keys the bucket as unsubscribe:<ip> on the shared authLimiter', async () => {
    await GET(new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'))

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ __stub: 'authLimiter' }),
      'unsubscribe:1.2.3.4',
    )
  })
})
