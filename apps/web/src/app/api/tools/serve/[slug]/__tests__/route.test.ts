/**
 * H1 — rate-limit contract for the public serve route.
 *
 * The route is public-by-design (no auth); H1 added an IP-keyed sdkLimiter
 * gate AFTER the health fast-path and BEFORE handler lookup/execution.
 * These tests pin: the 429 limited path (handler never runs), the allowed
 * path, the health-bypass (no limiter spend for monitors), the placement
 * (limit precedes the unknown-tool 404), and the identifier shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockHandler, mockTryRedis } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockHandler: vi.fn(),
  mockTryRedis: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: { __stub: 'sdkLimiter' },
  checkRateLimit: mockCheckRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
  tryRedis: mockTryRedis,
}))

vi.mock('../handlers', () => ({
  handlers: { 'test-tool': mockHandler },
}))

import { GET, POST } from '../route'

function makeCtx(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

describe('serve route — H1 rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockHandler.mockResolvedValue({ ok: true })
    mockTryRedis.mockResolvedValue(null)
  })

  it('returns 429 and never executes the handler when limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 0 })

    const res = await POST(
      new NextRequest('http://localhost/api/tools/serve/test-tool', { method: 'POST' }),
      makeCtx('test-tool'),
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('Too many requests')
    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('executes the handler when allowed', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/tools/serve/test-tool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'hello' }),
      }),
      makeCtx('test-tool'),
    )

    expect(res.status).toBe(200)
    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({ query: 'hello' }))
  })

  it('keys the bucket as tools-serve:<ip> on the shared sdkLimiter', async () => {
    await GET(
      new NextRequest('http://localhost/api/tools/serve/test-tool?query=x'),
      makeCtx('test-tool'),
    )

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ __stub: 'sdkLimiter' }),
      'tools-serve:1.2.3.4',
    )
  })

  it('health checks bypass the limiter entirely', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/tools/serve/test-tool?health=1'),
      makeCtx('test-tool'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('rate-limits before the unknown-tool 404 (placement pin)', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 0 })

    const res = await GET(
      new NextRequest('http://localhost/api/tools/serve/no-such-tool'),
      makeCtx('no-such-tool'),
    )

    expect(res.status).toBe(429)
  })
})
