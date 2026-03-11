import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    innerJoin: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  for (const key of Object.keys(mockDb)) {
    if (key === 'then') {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockImplementation((resolve?: (v: unknown) => unknown) => {
        return Promise.resolve(undefined).then(resolve)
      })
    } else if (key === 'catch') {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
    } else {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
    }
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@test.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  referrals: {
    id: 'id',
    referrerId: 'referrer_id',
    referredToolId: 'referred_tool_id',
    referralCode: 'referral_code',
    commissionPct: 'commission_pct',
    totalEarnedCents: 'total_earned_cents',
    status: 'status',
    createdAt: 'created_at',
  },
  tools: { id: 'id', name: 'name' },
  invocations: {
    referralCode: 'referral_code',
    costCents: 'cost_cents',
    consumerId: 'consumer_id',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({ sql: strings, values })),
}))

import { GET } from '@/app/api/developer/referrals/[id]/earnings/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    if (key === 'then') {
      vi.mocked(mockDb.then).mockImplementation((resolve?: (v: unknown) => unknown) => {
        return Promise.resolve(undefined).then(resolve)
      })
    } else if (key === 'catch') {
      vi.mocked(mockDb.catch).mockReturnValue(mockDb)
    } else {
      vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
    }
  }
}

describe('Referral Earnings (GET /api/developer/referrals/[id]/earnings)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns earnings breakdown for a referral', async () => {
    const referralId = '550e8400-e29b-41d4-a716-446655440000'

    // The route does: select(...).from(...).innerJoin(...).where(...).limit(1)
    // Then: select(...).from(...).where(eq(...)) -- total invocations
    // Then: select(...).from(...).where(and(...)) -- this month stats

    mockDb.limit.mockResolvedValueOnce([{
      id: referralId,
      referralCode: 'ref_abc123',
      commissionPct: 10,
      totalEarnedCents: 500,
      status: 'active',
      referredToolId: 'tool-1',
      toolName: 'My Tool',
    }])

    // Total invocations (select.from.where - no .limit)
    mockDb.where
      .mockReturnValueOnce(mockDb) // first where (referral query chain)
      .mockResolvedValueOnce([{ invocationCount: 50 }])  // total invocations
      .mockResolvedValueOnce([{ invocationCount: 10, totalCostCents: 1000 }]) // this month

    const response = await GET(
      makeRequest(`/api/developer/referrals/${referralId}/earnings`),
      { params: Promise.resolve({ id: referralId }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.referralId).toBe(referralId)
    expect(data.totalEarnedCents).toBe(500)
    expect(data.commissionPct).toBe(10)
    expect(data.earnedThisMonthCents).toBe(100) // 1000 * 10 / 100
    expect(data.totalInvocations).toBe(50)
    expect(data.thisMonthInvocations).toBe(10)
  })

  it('returns 404 for non-existent referral', async () => {
    const referralId = '550e8400-e29b-41d4-a716-446655440000'
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(
      makeRequest(`/api/developer/referrals/${referralId}/earnings`),
      { params: Promise.resolve({ id: referralId }) }
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await GET(
      makeRequest('/api/developer/referrals/invalid-id/earnings'),
      { params: Promise.resolve({ id: 'invalid-id' }) }
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await GET(
      makeRequest('/api/developer/referrals/550e8400-e29b-41d4-a716-446655440000/earnings'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )

    expect(response.status).toBe(401)
  })
})
