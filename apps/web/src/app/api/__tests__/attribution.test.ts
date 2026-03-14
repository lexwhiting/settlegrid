import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    groupBy: vi.fn(),
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
  tools: { id: 'id', developerId: 'developer_id' },
  invocations: { toolId: 'tool_id', consumerId: 'consumer_id', referralCode: 'referral_code', sessionId: 'session_id', costCents: 'cost_cents', createdAt: 'created_at' },
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

import { GET } from '@/app/api/dashboard/developer/stats/attribution/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R11: Attribution (GET /api/dashboard/developer/stats/attribution)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns empty attribution when developer has no tools', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.byReferralSource).toEqual([])
    expect(data.sessionPatterns).toEqual([])
    expect(data.topReferringAgents).toEqual([])
  })

  it('returns attribution data when tools exist', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])
      .mockResolvedValueOnce([{ referralCode: 'ref_abc', invocationCount: 50, totalRevenueCents: 500 }])
      .mockResolvedValueOnce([{ date: '2026-03-10', uniqueSessions: 5, totalInvocations: 20 }])
      .mockResolvedValueOnce([{ referralCode: 'ref_abc', uniqueConsumers: 3, totalRevenueCents: 500 }])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('byReferralSource')
    expect(data).toHaveProperty('sessionPatterns')
    expect(data).toHaveProperty('topReferringAgents')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const res = await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    expect(res.status).toBe(429)
  })

  it('response has correct shape for empty state', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    const data = await res.json()
    expect(Array.isArray(data.byReferralSource)).toBe(true)
    expect(Array.isArray(data.sessionPatterns)).toBe(true)
    expect(Array.isArray(data.topReferringAgents)).toBe(true)
  })

  it('limits tool query to 500', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    expect(mockDb.limit).toHaveBeenCalledWith(500)
  })

  it('uses developer ID for tool lookup', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    await GET(makeRequest('/api/dashboard/developer/stats/attribution'))
    expect(mockRequireDeveloper).toHaveBeenCalled()
  })
})
