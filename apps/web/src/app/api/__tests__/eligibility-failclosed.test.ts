/**
 * P3.RAIL1 R4 — fail-closed coverage for /api/eligibility.
 *
 * Lives in a separate file so vi.mock('@settlegrid/rails', ...) can
 * override the router for the duration of these tests without
 * polluting the main eligibility test fixture (which uses the real
 * router against the bundled matrix). The route's inner catch
 * passes-through unknown error classes (line 140-141) to the outer
 * try/catch → internalErrorResponse → 500. This file exercises that
 * branch so the coverage report records it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockRouteDeveloper } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  }),
  mockRouteDeveloper: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@settlegrid/rails', async (importOriginal) => {
  const original = await importOriginal<typeof import('@settlegrid/rails')>()
  return {
    ...original,
    routeDeveloper: mockRouteDeveloper,
  }
})

import { POST as eligibilityPost } from '@/app/api/eligibility/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/eligibility', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/eligibility — fail-closed on unknown router error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 0,
    })
  })

  it('returns 500 when router throws a non-Invalid / non-Unsupported error', async () => {
    mockRouteDeveloper.mockImplementationOnce(() => {
      throw new RangeError('unexpected from router')
    })
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
    // The 500 response must NOT echo the error message (no leak).
    expect(JSON.stringify(body)).not.toContain('unexpected from router')
  })
})
