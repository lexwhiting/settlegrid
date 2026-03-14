import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    innerJoin: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
  }
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }
  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'con@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))
vi.mock('@/lib/db/schema', () => ({
  consumerToolBalances: { consumerId: 'consumer_id', toolId: 'tool_id', balanceCents: 'balance_cents', autoRefill: 'auto_refill', spendingLimitCents: 'spending_limit_cents', currentPeriodSpendCents: 'current_period_spend_cents' },
  tools: { id: 'id', name: 'name', slug: 'slug' },
  invocations: { consumerId: 'consumer_id', costCents: 'cost_cents', createdAt: 'created_at' },
  purchases: { consumerId: 'consumer_id', amountCents: 'amount_cents', status: 'status' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireConsumer: mockRequireConsumer }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/consumer/subscriptions/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R18: Consumer Subscriptions (GET /api/consumer/subscriptions)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns aggregated subscription data', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { toolId: 'tool-1', toolName: 'Tool A', toolSlug: 'tool-a', balanceCents: 500, autoRefill: false, spendingLimitCents: null, currentPeriodSpendCents: 100 },
        { toolId: 'tool-2', toolName: 'Tool B', toolSlug: 'tool-b', balanceCents: 300, autoRefill: true, spendingLimitCents: 1000, currentPeriodSpendCents: 200 },
      ])

    let whereCount = 0
    mockDb.where.mockImplementation(() => {
      whereCount++
      if (whereCount === 2) {
        return Object.assign(Promise.resolve([{ totalSpendCents: 5000 }]), mockDb)
      }
      return mockDb
    })

    mockDb.limit.mockResolvedValueOnce([
      { month: '2026-02', spendCents: 200, invocationCount: 20 },
      { month: '2026-03', spendCents: 300, invocationCount: 30 },
    ])

    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.tools).toHaveLength(2)
    expect(data.totalBalanceCents).toBe(800)
    expect(data).toHaveProperty('totalSpendCents')
    expect(data).toHaveProperty('monthlySpendTrend')
  })

  it('returns empty when no tools', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ totalSpendCents: 0 }]), mockDb)
    })

    mockDb.limit.mockResolvedValueOnce([])

    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.tools).toHaveLength(0)
    expect(data.totalBalanceCents).toBe(0)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))
    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    expect(res.status).toBe(429)
  })

  it('calculates totalBalanceCents correctly from tool balances', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        { toolId: 't1', toolName: 'A', toolSlug: 'a', balanceCents: 100, autoRefill: false, spendingLimitCents: null, currentPeriodSpendCents: 0 },
        { toolId: 't2', toolName: 'B', toolSlug: 'b', balanceCents: 250, autoRefill: false, spendingLimitCents: null, currentPeriodSpendCents: 0 },
        { toolId: 't3', toolName: 'C', toolSlug: 'c', balanceCents: 150, autoRefill: false, spendingLimitCents: null, currentPeriodSpendCents: 0 },
      ])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ totalSpendCents: 0 }]), mockDb)
    })

    mockDb.limit.mockResolvedValueOnce([])

    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    const data = await res.json()
    expect(data.totalBalanceCents).toBe(500)
  })

  it('limits tool balances to 200', async () => {
    mockDb.limit
      .mockResolvedValueOnce([])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ totalSpendCents: 0 }]), mockDb)
    })

    mockDb.limit.mockResolvedValueOnce([])

    await GET(makeRequest('/api/consumer/subscriptions'))
    expect(mockDb.limit).toHaveBeenCalledWith(200)
  })

  it('returns monthlySpendTrend as array', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ totalSpendCents: 0 }]), mockDb)
    })

    mockDb.limit.mockResolvedValueOnce([])

    const res = await GET(makeRequest('/api/consumer/subscriptions'))
    const data = await res.json()
    expect(Array.isArray(data.monthlySpendTrend)).toBe(true)
  })
})
