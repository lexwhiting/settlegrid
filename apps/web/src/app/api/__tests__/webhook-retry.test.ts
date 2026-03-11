import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockAttemptWebhookDelivery, mockComputeNextRetryAt } = vi.hoisted(() => {
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
    mockAttemptWebhookDelivery: vi.fn(),
    mockComputeNextRetryAt: vi.fn().mockReturnValue(new Date('2026-03-12T00:00:00Z')),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  webhookDeliveries: {
    id: 'id',
    endpointId: 'endpoint_id',
    event: 'event',
    payload: 'payload',
    status: 'status',
    httpStatus: 'http_status',
    attempts: 'attempts',
    maxAttempts: 'max_attempts',
    lastAttemptAt: 'last_attempt_at',
    deliveredAt: 'delivered_at',
    nextRetryAt: 'next_retry_at',
    createdAt: 'created_at',
  },
  webhookEndpoints: {
    id: 'id',
    url: 'url',
    secret: 'secret',
    status: 'status',
  },
}))

vi.mock('@/lib/webhooks', () => ({
  attemptWebhookDelivery: mockAttemptWebhookDelivery,
  computeNextRetryAt: mockComputeNextRetryAt,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  lt: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lt: [a, b] })),
  lte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({ sql: strings, values })),
    { join: vi.fn().mockReturnValue('joined') }
  ),
}))

import { GET } from '@/app/api/cron/webhook-retry/route'

function makeRequest(cronSecret?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cronSecret) headers.authorization = `Bearer ${cronSecret}`
  return new NextRequest('http://localhost:3005/api/cron/webhook-retry', { headers })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('Webhook Retry Cron (GET /api/cron/webhook-retry)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    delete process.env.CRON_SECRET
  })

  it('returns 0 retried when no failed deliveries found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no failed deliveries

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.retried).toBe(0)
    expect(data.delivered).toBe(0)
    expect(data.deadLettered).toBe(0)
  })

  it('retries a failed delivery and marks it delivered on success', async () => {
    // First query: failed deliveries
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'del-1',
        endpointId: 'ep-1',
        event: 'invocation.completed',
        payload: { test: true },
        attempts: 1,
        maxAttempts: 3,
      }])
      // Second query: endpoints lookup
      .mockResolvedValueOnce([{
        id: 'ep-1',
        url: 'https://example.com/hook',
        secret: 'whsec_test',
        status: 'active',
      }])

    mockAttemptWebhookDelivery.mockResolvedValueOnce({ httpStatus: 200, status: 'delivered' })

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.retried).toBe(1)
    expect(data.delivered).toBe(1)
    expect(data.deadLettered).toBe(0)
    expect(mockAttemptWebhookDelivery).toHaveBeenCalledOnce()
  })

  it('dead-letters a delivery that has exhausted all retries', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'del-2',
        endpointId: 'ep-1',
        event: 'payout.initiated',
        payload: { test: true },
        attempts: 2,
        maxAttempts: 3,
      }])
      .mockResolvedValueOnce([{
        id: 'ep-1',
        url: 'https://example.com/hook',
        secret: 'whsec_test',
        status: 'active',
      }])

    mockAttemptWebhookDelivery.mockResolvedValueOnce({ httpStatus: 500, status: 'failed' })

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.retried).toBe(1)
    expect(data.delivered).toBe(0)
    expect(data.deadLettered).toBe(1)
  })

  it('dead-letters when endpoint is inactive', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'del-3',
        endpointId: 'ep-2',
        event: 'invocation.completed',
        payload: {},
        attempts: 1,
        maxAttempts: 3,
      }])
      .mockResolvedValueOnce([{
        id: 'ep-2',
        url: 'https://example.com/hook',
        secret: 'whsec_test',
        status: 'disabled',
      }])

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deadLettered).toBe(1)
    expect(mockAttemptWebhookDelivery).not.toHaveBeenCalled()
  })

  it('schedules next retry when delivery still has attempts left', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'del-4',
        endpointId: 'ep-1',
        event: 'invocation.completed',
        payload: {},
        attempts: 1,
        maxAttempts: 5,
      }])
      .mockResolvedValueOnce([{
        id: 'ep-1',
        url: 'https://example.com/hook',
        secret: 'whsec_test',
        status: 'active',
      }])

    mockAttemptWebhookDelivery.mockResolvedValueOnce({ httpStatus: 503, status: 'failed' })

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.retried).toBe(1)
    expect(data.delivered).toBe(0)
    expect(data.deadLettered).toBe(0)
    expect(mockComputeNextRetryAt).toHaveBeenCalledWith(2)
  })

  it('returns 401 when CRON_SECRET is set but wrong', async () => {
    process.env.CRON_SECRET = 'correct-secret'

    const response = await GET(makeRequest('wrong-secret'))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('allows access when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'correct-secret'
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest('correct-secret'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.retried).toBe(0)
  })
})

describe('computeNextRetryAt helper', () => {
  it('computes correct exponential backoff', async () => {
    // Import the real function (not the mock)
    vi.doUnmock('@/lib/webhooks')
    const { computeNextRetryAt } = await import('@/lib/webhooks')

    const now = Date.now()
    // attempt 1: 2^1 * 60 = 120 seconds
    const retry1 = computeNextRetryAt(1)
    expect(retry1.getTime()).toBeGreaterThanOrEqual(now + 120 * 1000 - 1000)
    expect(retry1.getTime()).toBeLessThanOrEqual(now + 120 * 1000 + 1000)

    // attempt 3: 2^3 * 60 = 480 seconds
    const retry3 = computeNextRetryAt(3)
    expect(retry3.getTime()).toBeGreaterThanOrEqual(now + 480 * 1000 - 1000)
    expect(retry3.getTime()).toBeLessThanOrEqual(now + 480 * 1000 + 1000)
  })
})
