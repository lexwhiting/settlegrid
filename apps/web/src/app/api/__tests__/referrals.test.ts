import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    innerJoin: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    orderBy: vi.fn(),
  }
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))
vi.mock('@/lib/db/schema', () => ({
  referrals: { id: 'id', referrerId: 'referrer_id', referredToolId: 'referred_tool_id', referralCode: 'referral_code', commissionPct: 'commission_pct', totalEarnedCents: 'total_earned_cents', status: 'status', createdAt: 'created_at' },
  tools: { id: 'id', name: 'name', slug: 'slug', status: 'status' },
  invocations: { referralCode: 'referral_code', costCents: 'cost_cents', consumerId: 'consumer_id' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET as listReferrals, POST } from '@/app/api/developer/referrals/route'
import { GET as getReferral, DELETE } from '@/app/api/developer/referrals/[id]/route'

function makeGet(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDelete(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

const validUuid = '00000000-0000-0000-0000-000000000001'

describe('R17: Referrals', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  describe('GET /api/developer/referrals', () => {
    it('returns list of referrals', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { id: 'ref-1', referredToolId: 'tool-1', toolName: 'Tool One', toolSlug: 'tool-one', referralCode: 'ref_abc', commissionPct: 10, totalEarnedCents: 500, status: 'active', createdAt: '2026-03-10' },
      ])
      const res = await listReferrals(makeGet('/api/developer/referrals'))
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.referrals).toHaveLength(1)
    })

    it('returns 401 when not authenticated', async () => {
      mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
      const res = await listReferrals(makeGet('/api/developer/referrals'))
      expect(res.status).toBe(401)
    })

    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
      const res = await listReferrals(makeGet('/api/developer/referrals'))
      expect(res.status).toBe(429)
    })
  })

  describe('POST /api/developer/referrals', () => {
    it('creates a referral', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'tool-1', name: 'Test' }])
        .mockResolvedValueOnce([])
      mockDb.returning.mockResolvedValueOnce([{
        id: 'ref-new', referredToolId: 'tool-1', referralCode: 'ref_xyz', commissionPct: 10, status: 'active', createdAt: '2026-03-10',
      }])
      const res = await POST(makePost('/api/developer/referrals', { toolId: validUuid }))
      const data = await res.json()
      expect(res.status).toBe(201)
      expect(data.referral).toBeDefined()
    })

    it('returns 404 when tool not found', async () => {
      mockDb.limit.mockResolvedValueOnce([])
      const res = await POST(makePost('/api/developer/referrals', { toolId: validUuid }))
      expect(res.status).toBe(404)
    })

    it('returns 409 when duplicate active referral', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'tool-1', name: 'Test' }])
        .mockResolvedValueOnce([{ id: 'ref-existing' }])
      const res = await POST(makePost('/api/developer/referrals', { toolId: validUuid }))
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/developer/referrals/[id]', () => {
    it('returns referral stats', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: validUuid, referredToolId: 'tool-1', toolName: 'Test', referralCode: 'ref_abc', commissionPct: 10, totalEarnedCents: 500, status: 'active', createdAt: '2026-03-10',
      }])

      mockDb.where.mockImplementation(() => {
        return Object.assign(Promise.resolve([{ totalInvocations: 50, totalRevenueCents: 1000, uniqueConsumers: 5 }]), mockDb)
      })

      const res = await getReferral(makeGet(`/api/developer/referrals/${validUuid}`), { params: Promise.resolve({ id: validUuid }) })
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.referral).toBeDefined()
      expect(data.stats).toBeDefined()
    })

    it('returns 404 when referral not found', async () => {
      mockDb.limit.mockResolvedValueOnce([])
      const res = await getReferral(makeGet(`/api/developer/referrals/${validUuid}`), { params: Promise.resolve({ id: validUuid }) })
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await getReferral(makeGet('/api/developer/referrals/bad'), { params: Promise.resolve({ id: 'bad' }) })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/developer/referrals/[id]', () => {
    it('revokes a referral', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: validUuid, status: 'active' }])
      mockDb.returning.mockResolvedValueOnce([{ id: validUuid, status: 'revoked' }])
      const res = await DELETE(makeDelete(`/api/developer/referrals/${validUuid}`), { params: Promise.resolve({ id: validUuid }) })
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.referral.status).toBe('revoked')
    })

    it('returns 400 when already revoked', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: validUuid, status: 'revoked' }])
      const res = await DELETE(makeDelete(`/api/developer/referrals/${validUuid}`), { params: Promise.resolve({ id: validUuid }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('ALREADY_REVOKED')
    })
  })
})
