/**
 * Contract for the public, stream-aware unsubscribe route (G6-2 write seam).
 *
 * Pins: the rate-limit gate (apiLimiter — NOT the old 5/min authLimiter, which
 * would block RFC-8058 one-click POSTs arriving from a mailbox provider's
 * shared egress IP), keyed `unsubscribe:<ip>`, 429 on the limited path with
 * ZERO writes; the durable-fallback-FIRST outreach write (legacy Redis key)
 * plus the canonical `suppressBestEffort` mirror; and stream forwarding (a
 * `consumer-digest` opt-out writes that stream, NOT 'outreach').
 *
 * The end-to-end pglite round-trip (real table rows) lives in
 * email-compliance.integration.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockRedisSet, mockSuppress } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockRedisSet: vi.fn(),
  mockSuppress: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: { __stub: 'apiLimiter' },
  checkRateLimit: mockCheckRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({ set: mockRedisSet, get: vi.fn() })),
}))

vi.mock('@/lib/db', () => ({ db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() } }))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Keep the real normalizeEmail + isSuppressibleStream (pure); stub only the
// canonical table write so we can assert the forwarded stream.
vi.mock('@/lib/email-suppression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email-suppression')>()
  return { ...actual, suppressBestEffort: mockSuppress }
})

import { GET, POST } from '../route'

describe('unsubscribe route — stream-aware write seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
    mockRedisSet.mockResolvedValue('OK')
    mockSuppress.mockResolvedValue(undefined)
  })

  it('POST returns 429 with NO writes when limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 100, remaining: 0, reset: 0 })
    const res = await POST(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    )
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('RATE_LIMIT_EXCEEDED')
    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(mockSuppress).not.toHaveBeenCalled()
  })

  it('GET returns 429 with NO writes when limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 100, remaining: 0, reset: 0 })
    const res = await GET(new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'))
    expect(res.status).toBe(429)
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('POST {email} (default outreach) writes the legacy Redis key + mirrors to the table', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'User@Example.com' }),
      }),
    )
    expect(res.status).toBe(200)
    // durable fallback FIRST — normalized legacy outreach key
    expect(mockRedisSet).toHaveBeenCalledWith('unsub:outreach:user@example.com', '1')
    // canonical mirror
    expect(mockSuppress).toHaveBeenCalledWith('user@example.com', 'outreach', 'unsubscribe', 'link')
  })

  it('GET ?email= (email link click) writes the outreach suppression', async () => {
    const res = await GET(new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'))
    expect(res.status).toBe(200)
    expect(mockRedisSet).toHaveBeenCalledWith('unsub:outreach:user@example.com', '1')
  })

  it('forwards the stream: {email, stream:consumer-digest} suppresses that stream (NOT outreach)', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', stream: 'consumer-digest' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(mockSuppress).toHaveBeenCalledWith('reader@example.com', 'consumer-digest', 'unsubscribe', 'link')
    // the digest stream does NOT write the legacy outreach Redis key
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('keys the bucket as unsubscribe:<ip> on the apiLimiter', async () => {
    await GET(new NextRequest('http://localhost/api/unsubscribe?email=user@example.com'))
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ __stub: 'apiLimiter' }),
      'unsubscribe:1.2.3.4',
    )
  })
})
