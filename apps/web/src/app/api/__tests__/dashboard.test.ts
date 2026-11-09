import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    developerId: 'developer_id',
    totalInvocations: 'total_invocations',
    totalRevenueCents: 'total_revenue_cents',
    status: 'status',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    costCents: 'cost_cents',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  inArray: vi.fn().mockImplementation((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as getStats } from '@/app/api/dashboard/developer/stats/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Developer Stats (GET /api/dashboard/developer/stats)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.groupBy.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
  })

  it('returns aggregated stats for developer with tools', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 500 },
        { id: 'tool-2', status: 'active', totalRevenueCents: 250 },
      ])
      .mockResolvedValueOnce([{ count: 150 }]) // recorded calls on non-deleted tools
      .mockResolvedValueOnce([]) // recent invocations

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalInvocations).toBe(150)
    expect(data.totalRevenueCents).toBe(750)
    expect(data.toolCount).toBe(2)
  })

  it('returns this calendar month\'s revenue separately from lifetime revenue', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 5000 },
      ])
      .mockResolvedValueOnce([{ count: 3 }]) // recorded calls
      .mockResolvedValueOnce([]) // recent invocations
      .mockResolvedValueOnce([{ revenueCents: 120 }]) // this month

    const response = await getStats(makeRequest('/api/dashboard/developer/stats'))
    const data = await response.json()

    expect(data.totalRevenueCents).toBe(5000)
    expect(data.monthRevenueCents).toBe(120)
  })

  it('returns zero stats for developer with no tools', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalInvocations).toBe(0)
    expect(data.totalRevenueCents).toBe(0)
    expect(data.toolCount).toBe(0)
    expect(data.recentInvocations).toEqual([])
    expect(data.monthRevenueCents).toBe(0)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)

    expect(response.status).toBe(401)
  })

  it('includes recentInvocations array in response', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 50 },
      ])
      .mockResolvedValueOnce([{ count: 5 }]) // recorded calls
      .mockResolvedValueOnce([
        { hour: '2026-03-11T08:00:00', count: 5, revenueCents: 25 },
      ])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.recentInvocations).toHaveLength(1)
    expect(data.recentInvocations[0].count).toBe(5)
  })

  it('returns recentInvocations as empty when tools exist but no recent invocations', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 500 },
      ])
      .mockResolvedValueOnce([{ count: 100 }]) // recorded calls
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data.recentInvocations).toEqual([])
  })

  it('sums revenue across multiple tools', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 100 },
        { id: 'tool-2', status: 'active', totalRevenueCents: 200 },
        { id: 'tool-3', status: 'active', totalRevenueCents: 300 },
      ])
      .mockResolvedValueOnce([{ count: 60 }]) // recorded calls
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data.totalRevenueCents).toBe(600)
    expect(data.totalInvocations).toBe(60)
    expect(data.toolCount).toBe(3)
  })

  it('counts activity on non-deleted tools only, keeps all earnings, and counts active tools', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-live', status: 'active', totalRevenueCents: 100 },
        { id: 'tool-draft', status: 'draft', totalRevenueCents: 0 },
        { id: 'tool-gone', status: 'deleted', totalRevenueCents: 40 },
      ])
      .mockResolvedValueOnce([{ count: 7 }]) // recorded calls on live + draft
      .mockResolvedValueOnce([]) // recent invocations
      .mockResolvedValueOnce([{ revenueCents: 0 }]) // this month

    const data = await (await getStats(makeRequest('/api/dashboard/developer/stats'))).json()

    expect(data.toolCount).toBe(1) // 'Active Tools' = status active, like Reputation
    expect(data.toolsCreated).toBe(3)
    expect(data.totalInvocations).toBe(7)
    expect(data.hasInvocations).toBe(true)
    expect(data.totalRevenueCents).toBe(140) // a deleted tool's earnings stay the developer's
    // the call count and the 24h chart are scoped to the two non-deleted tools
    const { inArray } = await import('drizzle-orm')
    const scoped = vi.mocked(inArray).mock.calls.map(([, ids]) => ids)
    expect(scoped[0]).toEqual(['tool-live', 'tool-draft'])
    expect(scoped[1]).toEqual(['tool-live', 'tool-draft'])
  })

  it('ticks "made a test invocation" from calls on deleted tools too', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-gone', status: 'deleted', totalRevenueCents: 3 }])
      .mockResolvedValueOnce([{ id: 'inv-1' }]) // any call, any tool
      .mockResolvedValueOnce([]) // this month

    const data = await (await getStats(makeRequest('/api/dashboard/developer/stats'))).json()

    expect(data.toolCount).toBe(0)
    expect(data.totalInvocations).toBe(0)
    expect(data.hasInvocations).toBe(true)
  })

  it('response shape includes all required fields', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data).toHaveProperty('totalRevenueCents')
    expect(data).toHaveProperty('totalInvocations')
    expect(data).toHaveProperty('toolCount')
    expect(data).toHaveProperty('recentInvocations')
  })

  it('handles single tool correctly', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-solo', status: 'active', totalRevenueCents: 210 },
      ])
      .mockResolvedValueOnce([{ count: 42 }]) // recorded calls
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data.toolCount).toBe(1)
    expect(data.totalInvocations).toBe(42)
    expect(data.totalRevenueCents).toBe(210)
  })

  it('limits recent invocations query', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', status: 'active', totalRevenueCents: 5000 },
      ])
      .mockResolvedValueOnce([{ count: 1000 }]) // recorded calls
      .mockResolvedValueOnce([]) // The query uses .limit(24)

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)

    expect(response.status).toBe(200)
    // Verify limit was called (multiple times for different queries)
    expect(mockDb.limit).toHaveBeenCalled()
  })
})
