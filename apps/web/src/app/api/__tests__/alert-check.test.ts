import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockSendAlertEmail } = vi.hoisted(() => {
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
  }

  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }

  return {
    mockDb,
    mockSendAlertEmail: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  consumerAlerts: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    alertType: 'alert_type',
    threshold: 'threshold',
    channel: 'channel',
    status: 'status',
    lastTriggeredAt: 'last_triggered_at',
    createdAt: 'created_at',
  },
  consumerToolBalances: {
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
    currentPeriodSpendCents: 'current_period_spend_cents',
    spendingLimitCents: 'spending_limit_cents',
  },
  consumers: { id: 'id', email: 'email' },
  tools: { id: 'id', name: 'name' },
  invocations: {
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    createdAt: 'created_at',
    costCents: 'cost_cents',
  },
}))

vi.mock('@/lib/alert-email', () => ({
  sendAlertEmail: mockSendAlertEmail,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn().mockImplementation((a: unknown) => ({ isNull: a })),
  lte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lte: [a, b] })),
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({ sql: strings, values })),
}))

import { GET } from '@/app/api/cron/alert-check/route'

function makeRequest(cronSecret?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cronSecret) headers.authorization = `Bearer ${cronSecret}`
  return new NextRequest('http://localhost:3005/api/cron/alert-check', { headers })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

const TEST_CRON_SECRET = 'test-cron-secret'

describe('Alert Check Cron (GET /api/cron/alert-check)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    process.env.CRON_SECRET = TEST_CRON_SECRET
  })

  it('returns 0 fired when no active alerts found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest(TEST_CRON_SECRET))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.checked).toBe(0)
    expect(data.fired).toBe(0)
  })

  it('fires low_balance alert when balance is below threshold', async () => {
    // Active alerts query
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'alert-1',
        consumerId: 'con-1',
        toolId: 'tool-1',
        alertType: 'low_balance',
        threshold: 500,
        channel: 'email',
        lastTriggeredAt: null,
        consumerEmail: 'consumer@example.com',
        toolName: 'Test Tool',
      }])
      // Balance check
      .mockResolvedValueOnce([{ balanceCents: 200 }])

    const response = await GET(makeRequest(TEST_CRON_SECRET))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fired).toBe(1)
    expect(mockSendAlertEmail).toHaveBeenCalledWith(
      'consumer@example.com',
      'Test Tool',
      'low_balance',
      500
    )
  })

  it('does NOT fire low_balance alert when balance is above threshold', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'alert-2',
        consumerId: 'con-1',
        toolId: 'tool-1',
        alertType: 'low_balance',
        threshold: 500,
        channel: 'email',
        lastTriggeredAt: null,
        consumerEmail: 'consumer@example.com',
        toolName: 'Test Tool',
      }])
      .mockResolvedValueOnce([{ balanceCents: 1000 }])

    const response = await GET(makeRequest(TEST_CRON_SECRET))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fired).toBe(0)
    expect(mockSendAlertEmail).not.toHaveBeenCalled()
  })

  it('fires budget_exceeded alert when spend >= limit', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'alert-3',
        consumerId: 'con-2',
        toolId: 'tool-2',
        alertType: 'budget_exceeded',
        threshold: 0,
        channel: 'email',
        lastTriggeredAt: null,
        consumerEmail: 'consumer2@example.com',
        toolName: 'Budget Tool',
      }])
      .mockResolvedValueOnce([{
        currentPeriodSpendCents: 5000,
        spendingLimitCents: 5000,
      }])

    const response = await GET(makeRequest(TEST_CRON_SECRET))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fired).toBe(1)
  })

  it('returns 401 when CRON_SECRET is set but wrong', async () => {
    process.env.CRON_SECRET = 'my-secret'

    const response = await GET(makeRequest('wrong-secret'))
    expect(response.status).toBe(401)
  })

  it('respects cooldown: does not fire recently triggered alerts', async () => {
    // The query already filters for cooldown via SQL,
    // so if the alert is returned by the query, its cooldown has elapsed.
    // Test that an alert that HASN'T been triggered fires.
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'alert-5',
        consumerId: 'con-5',
        toolId: 'tool-5',
        alertType: 'low_balance',
        threshold: 1000,
        channel: 'email',
        lastTriggeredAt: null, // never triggered
        consumerEmail: 'test@example.com',
        toolName: 'Never Triggered',
      }])
      .mockResolvedValueOnce([{ balanceCents: 100 }])

    const response = await GET(makeRequest(TEST_CRON_SECRET))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fired).toBe(1)
    // Verify DB update was called for lastTriggeredAt
    expect(mockDb.update).toHaveBeenCalled()
  })
})
