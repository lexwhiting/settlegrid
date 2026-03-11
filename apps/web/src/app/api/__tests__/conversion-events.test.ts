import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'consumer-123', email: 'c@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  conversionEvents: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    event: 'event',
    fromTier: 'from_tier',
    toTier: 'to_tier',
    metadata: 'metadata',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn().mockReturnValue('test-request-id-conv'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { POST, GET } from '@/app/api/consumer/conversion-events/route'

const toolUuid = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Create Conversion Event (POST /api/consumer/conversion-events)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('creates a conversion event with valid data', async () => {
    // Tool exists check
    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid }])

    // Insert returning
    mockDb.returning.mockResolvedValueOnce([{
      id: 'evt-1',
      event: 'upgrade',
      fromTier: 'free',
      toTier: 'pro',
      toolId: toolUuid,
      metadata: { source: 'dashboard' },
      createdAt: new Date().toISOString(),
    }])

    const response = await POST(
      makeRequest('/api/consumer/conversion-events', 'POST', {
        eventType: 'upgrade',
        fromTier: 'free',
        toTier: 'pro',
        toolId: toolUuid,
        metadata: { source: 'dashboard' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.conversionEvent.event).toBe('upgrade')
    expect(data.conversionEvent.fromTier).toBe('free')
    expect(data.conversionEvent.toTier).toBe('pro')
    expect(response.headers.get('x-request-id')).toBe('test-request-id-conv')
  })

  it('validates eventType against allowed values', async () => {
    const response = await POST(
      makeRequest('/api/consumer/conversion-events', 'POST', {
        eventType: 'invalid_type',
        toolId: toolUuid,
      })
    )

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await POST(
      makeRequest('/api/consumer/conversion-events', 'POST', {
        eventType: 'signup',
        toolId: toolUuid,
      })
    )

    expect(response.status).toBe(401)
  })

  it('requires toolId', async () => {
    const response = await POST(
      makeRequest('/api/consumer/conversion-events', 'POST', {
        eventType: 'signup',
      })
    )

    expect(response.status).toBe(422)
  })
})

describe('List Conversion Events (GET /api/consumer/conversion-events)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.limit.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns paginated conversion events', async () => {
    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'evt-1',
        event: 'upgrade',
        fromTier: 'free',
        toTier: 'pro',
        toolId: toolUuid,
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ])

    const response = await GET(makeRequest('/api/consumer/conversion-events?page=1&limit=10'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.events).toHaveLength(1)
    expect(data.page).toBe(1)
    expect(data.limit).toBe(10)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await GET(makeRequest('/api/consumer/conversion-events'))

    expect(response.status).toBe(401)
  })
})
