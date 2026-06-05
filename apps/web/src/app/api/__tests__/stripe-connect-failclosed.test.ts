/**
 * P3.RAIL1 R4 — fail-closed coverage for /api/stripe/connect.
 *
 * The route's inner catch around routeDeveloper passes-through
 * unknown error classes to the outer try/catch (line 152-153) →
 * internalErrorResponse → 500. This file exercises that branch so
 * the coverage report records it; lives separately from stripe.test.ts
 * so a vi.mock of @settlegrid/rails doesn't pollute that file's
 * fixture (which uses the real router against the bundled matrix).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockRouteDeveloper,
  mockCheckRateLimit,
} = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        tier: 'free',
        stripeConnectId: null,
        stripeConnectStatus: 'not_started',
      },
    ]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({
      id: 'dev-123',
      email: 'dev@example.com',
    }),
    mockRouteDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 0,
    }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    tier: 'tier',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    updatedAt: 'updated_at',
  },
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

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3005'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

vi.mock('@settlegrid/rails', async (importOriginal) => {
  const original = await importOriginal<typeof import('@settlegrid/rails')>()
  return {
    ...original,
    routeDeveloper: mockRouteDeveloper,
  }
})

import { POST as connectHandler } from '@/app/api/stripe/connect/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/stripe/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/stripe/connect — fail-closed on unknown router error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 0,
    })
    mockRequireDeveloper.mockResolvedValue({
      id: 'dev-123',
      email: 'dev@example.com',
    })
    mockDb.limit.mockResolvedValue([
      {
        tier: 'free',
        stripeConnectId: null,
        stripeConnectStatus: 'not_started',
      },
    ])
  })

  it('returns 500 when routeDeveloper throws a non-Invalid / non-Unsupported error', async () => {
    mockRouteDeveloper.mockImplementationOnce(() => {
      throw new RangeError('mocked unexpected error')
    })
    const res = await connectHandler(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
    // Internal error message must NOT leak.
    expect(JSON.stringify(body)).not.toContain('mocked unexpected error')
  })
})
