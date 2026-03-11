import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'consumer@test.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    costCents: 'cost_cents',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
    name: 'name',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((col: unknown, val: unknown) => ({ gte: { col, val } })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as getAnalytics } from '@/app/api/consumer/usage/analytics/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Consumer Usage Analytics (GET /api/consumer/usage/analytics)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns analytics with daily trend and tool breakdown', async () => {
    const today = new Date().toISOString()
    mockDb.limit.mockResolvedValueOnce([
      { toolId: 'tool-1', toolName: 'My Tool', costCents: 100, createdAt: today },
      { toolId: 'tool-1', toolName: 'My Tool', costCents: 200, createdAt: today },
      { toolId: 'tool-2', toolName: 'Other Tool', costCents: 50, createdAt: today },
    ])

    const response = await getAnalytics(makeRequest('/api/consumer/usage/analytics'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.dailyTrend).toHaveLength(1)
    expect(data.dailyTrend[0].count).toBe(3)
    expect(data.dailyTrend[0].totalCostCents).toBe(350)
    expect(data.byTool).toHaveLength(2)
    expect(data.byTool[0].toolName).toBe('My Tool')
    expect(data.byTool[0].totalCostCents).toBe(300)
    expect(data.projectedMonthlySpendCents).toBe(350 * 30)
    expect(data.avgDailyCostCents).toBe(350)
  })

  it('returns empty analytics when no invocations exist', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await getAnalytics(makeRequest('/api/consumer/usage/analytics'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.dailyTrend).toHaveLength(0)
    expect(data.byTool).toHaveLength(0)
    expect(data.projectedMonthlySpendCents).toBe(0)
    expect(data.avgDailyCostCents).toBe(0)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await getAnalytics(makeRequest('/api/consumer/usage/analytics'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await getAnalytics(makeRequest('/api/consumer/usage/analytics'))
    expect(response.status).toBe(429)
  })
})
