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
  },
  invocations: {
    toolId: 'tool_id',
    costCents: 'cost_cents',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
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
        { id: 'tool-1', totalInvocations: 100, totalRevenueCents: 500 },
        { id: 'tool-2', totalInvocations: 50, totalRevenueCents: 250 },
      ])
      .mockResolvedValueOnce([]) // recent invocations

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalInvocations).toBe(150)
    expect(data.totalRevenueCents).toBe(750)
    expect(data.toolCount).toBe(2)
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
        { id: 'tool-1', totalInvocations: 10, totalRevenueCents: 50 },
      ])
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
        { id: 'tool-1', totalInvocations: 100, totalRevenueCents: 500 },
      ])
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data.recentInvocations).toEqual([])
  })

  it('sums revenue across multiple tools', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { id: 'tool-1', totalInvocations: 10, totalRevenueCents: 100 },
        { id: 'tool-2', totalInvocations: 20, totalRevenueCents: 200 },
        { id: 'tool-3', totalInvocations: 30, totalRevenueCents: 300 },
      ])
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)
    const data = await response.json()

    expect(data.totalRevenueCents).toBe(600)
    expect(data.totalInvocations).toBe(60)
    expect(data.toolCount).toBe(3)
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
        { id: 'tool-solo', totalInvocations: 42, totalRevenueCents: 210 },
      ])
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
        { id: 'tool-1', totalInvocations: 1000, totalRevenueCents: 5000 },
      ])
      .mockResolvedValueOnce([]) // The query uses .limit(24)

    const request = makeRequest('/api/dashboard/developer/stats')
    const response = await getStats(request)

    expect(response.status).toBe(200)
    // Verify limit was called (multiple times for different queries)
    expect(mockDb.limit).toHaveBeenCalled()
  })
})
