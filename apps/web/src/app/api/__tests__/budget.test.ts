import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'consumer@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  consumerToolBalances: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
    spendingLimitCents: 'spending_limit_cents',
    spendingLimitPeriod: 'spending_limit_period',
    currentPeriodSpendCents: 'current_period_spend_cents',
    periodResetAt: 'period_reset_at',
    alertAtPct: 'alert_at_pct',
  },
  tools: {
    id: 'id',
    name: 'name',
    slug: 'slug',
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
}))

import { GET, PATCH } from '@/app/api/consumer/budget/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Consumer Budget GET (GET /api/consumer/budget)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns budget configurations for consumer', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'bal-1',
        toolId: 'tool-1',
        toolName: 'My Tool',
        toolSlug: 'my-tool',
        balanceCents: 5000,
        spendingLimitCents: 10000,
        spendingLimitPeriod: 'monthly',
        currentPeriodSpendCents: 2500,
        periodResetAt: new Date('2026-04-01T00:00:00Z'),
        alertAtPct: 80,
      },
    ])

    const response = await GET(makeRequest('/api/consumer/budget'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.budgets).toHaveLength(1)
    expect(data.budgets[0].toolName).toBe('My Tool')
    expect(data.budgets[0].spendingLimitCents).toBe(10000)
    expect(data.budgets[0].spendingLimitPeriod).toBe('monthly')
    expect(data.budgets[0].alertAtPct).toBe(80)
  })

  it('returns empty budgets when consumer has no tool balances', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest('/api/consumer/budget'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.budgets).toHaveLength(0)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await GET(makeRequest('/api/consumer/budget'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await GET(makeRequest('/api/consumer/budget'))
    expect(response.status).toBe(429)
  })
})

describe('Consumer Budget PATCH (PATCH /api/consumer/budget)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('updates spending limit for a tool', async () => {
    // Existing balance record
    mockDb.limit.mockResolvedValueOnce([{ id: 'bal-1' }])

    // Updated record returned
    mockDb.returning.mockResolvedValueOnce([{
      id: 'bal-1',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 5000,
      spendingLimitPeriod: null,
      currentPeriodSpendCents: 0,
      periodResetAt: null,
      alertAtPct: null,
    }])

    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 5000,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.budget.spendingLimitCents).toBe(5000)
  })

  it('validates minimum spending limit (100 cents)', async () => {
    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 50, // below minimum
    }))

    expect(response.status).toBe(422)
  })

  it('validates spending limit period type', async () => {
    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitPeriod: 'yearly', // invalid period
    }))

    expect(response.status).toBe(422)
  })

  it('returns 404 when no balance found for tool', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no balance record

    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 5000,
    }))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 5000,
    }))

    expect(response.status).toBe(401)
  })

  it('returns 422 for invalid toolId format', async () => {
    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: 'not-a-uuid',
      spendingLimitCents: 5000,
    }))

    expect(response.status).toBe(422)
  })

  it('updates spending limit period and resets period spend', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'bal-1' }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'bal-1',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitCents: 10000,
      spendingLimitPeriod: 'weekly',
      currentPeriodSpendCents: 0,
      periodResetAt: new Date('2026-03-18T00:00:00Z'),
      alertAtPct: null,
    }])

    const response = await PATCH(makeRequest('/api/consumer/budget', 'PATCH', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      spendingLimitPeriod: 'weekly',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.budget.spendingLimitPeriod).toBe('weekly')
    expect(data.budget.currentPeriodSpendCents).toBe(0)
  })
})
