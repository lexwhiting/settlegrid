/**
 * POST /api/auth/developer/login-event records an auth.login audit entry for
 * password sign-ins (which never pass through auth/callback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRequireDeveloper, mockWriteAuditLog, mockCheckRateLimit } = vi.hoisted(() => ({
  mockRequireDeveloper: vi.fn(),
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => '203.0.113.7',
}))

import { POST } from '../route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/api/auth/developer/login-event', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'vitest' },
  })
}

describe('POST /api/auth/developer/login-event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes an auth.login audit entry for the signed-in developer', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({ id: 'dev-1', email: 'dev@example.com' })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-1',
        action: 'auth.login',
        resourceType: 'session',
        details: { provider: 'email', method: 'password' },
        ipAddress: '203.0.113.7',
        userAgent: 'vitest',
      }),
    )
  })

  it('returns 401 and writes nothing without a session', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(mockWriteAuditLog).not.toHaveBeenCalled()
  })

  it('returns 429 and writes nothing when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
    expect(mockWriteAuditLog).not.toHaveBeenCalled()
  })
})
