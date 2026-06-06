/**
 * (N) auth.id rate-limit keying — T5: the X1 site (POST /api/auth/mfa).
 *
 * POST /api/auth/mfa was the chunk's single non-V1a guard shape: its try
 * block had no hoisted `let auth`, so the transform hoisted the variable and
 * captured the guard result (the chunk's only modified line). This test
 * proves the captured identity feeds the per-user rate-limit key and that
 * the uid layer 429s independently of the IP layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockRequireDeveloper } = vi.hoisted(() => ({
  mockCheckRateLimit: vi
    .fn()
    .mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  mockRequireDeveloper: vi
    .fn()
    .mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      mfa: {
        enroll: vi.fn().mockResolvedValue({
          data: { id: 'factor-1', totp: { uri: 'otpauth://totp/test', secret: 'SECRET' } },
          error: null,
        }),
      },
    },
  }),
}))

import { POST as enrollMfa } from '@/app/api/auth/mfa/route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/api/auth/mfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
  })
}

describe('POST /api/auth/mfa — per-user (uid) rate limit (X1 hoist+capture)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keys the post-auth limit on the captured auth.id and 429s when it trips', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, limit: 100, remaining: 99, reset: 0 })
      .mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })

    const response = await enrollMfa(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'mfa-enroll:uid:dev-123'
    )
  })
})
