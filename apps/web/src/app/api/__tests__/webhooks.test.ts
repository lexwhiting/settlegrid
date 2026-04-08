import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  webhookEndpoints: {
    id: 'id',
    developerId: 'developer_id',
    url: 'url',
    secret: 'secret',
    events: 'events',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  webhookDeliveries: {
    id: 'id',
    endpointId: 'endpoint_id',
    event: 'event',
    status: 'status',
    httpStatus: 'http_status',
    attempts: 'attempts',
    maxAttempts: 'max_attempts',
    lastAttemptAt: 'last_attempt_at',
    deliveredAt: 'delivered_at',
    createdAt: 'created_at',
  },
  developers: {
    id: 'id',
    tier: 'tier',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
}))

import { GET as listWebhooks, POST as createWebhook } from '@/app/api/developer/webhooks/route'
import { DELETE as deleteWebhook } from '@/app/api/developer/webhooks/[id]/route'
import { GET as listDeliveries } from '@/app/api/developer/webhooks/[id]/deliveries/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

describe('List Webhooks (GET /api/developer/webhooks)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns empty list', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await listWebhooks(makeRequest('/api/developer/webhooks'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.endpoints).toHaveLength(0)
  })

  it('returns webhook endpoints for developer', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'wh-1',
        url: 'https://example.com/webhook',
        events: ['invocation.completed'],
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ])

    const response = await listWebhooks(makeRequest('/api/developer/webhooks'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.endpoints).toHaveLength(1)
    expect(data.endpoints[0].url).toBe('https://example.com/webhook')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await listWebhooks(makeRequest('/api/developer/webhooks'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await listWebhooks(makeRequest('/api/developer/webhooks'))
    expect(response.status).toBe(429)
  })
})

describe('Create Webhook (POST /api/developer/webhooks)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('creates a webhook endpoint', async () => {
    // Route does dev tier query FIRST, then existing endpoints query
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'standard', isFoundingMember: false }]) // dev tier
      .mockResolvedValueOnce([]) // existing endpoints (below limit)

    mockDb.returning.mockResolvedValueOnce([{
      id: 'wh-new',
      url: 'https://example.com/hook',
      events: '["invocation.completed"]',
      status: 'active',
      createdAt: new Date().toISOString(),
    }])

    const response = await createWebhook(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.com/hook',
      events: ['invocation.completed'],
    }))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.endpoint.url).toBe('https://example.com/hook')
    expect(data.endpoint.secret).toMatch(/^whsec_/)
  })

  it('rejects non-HTTPS URLs', async () => {
    const response = await createWebhook(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'http://example.com/hook',
      events: ['invocation.completed'],
    }))

    expect(response.status).toBe(422)
  })

  it('rejects when at endpoint limit', async () => {
    // Dev tier first, then existing endpoints. standard maps to free tier
    // (max 1 endpoint), so 1 existing already exceeds the limit.
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'standard', isFoundingMember: false }]) // dev tier
      .mockResolvedValueOnce([{}]) // 1 existing endpoint, at the limit for free

    const response = await createWebhook(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.com/hook',
      events: ['invocation.completed'],
    }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('LIMIT_EXCEEDED')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await createWebhook(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.com/hook',
      events: ['invocation.completed'],
    }))

    expect(response.status).toBe(401)
  })

  it('rejects invalid events', async () => {
    const response = await createWebhook(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.com/hook',
      events: ['invalid.event'],
    }))

    expect(response.status).toBe(422)
  })
})

describe('Delete Webhook (DELETE /api/developer/webhooks/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.delete.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('deletes a webhook endpoint', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 'wh-1' }])

    const response = await deleteWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe(true)
  })

  it('returns 404 when webhook not found', async () => {
    mockDb.returning.mockResolvedValueOnce([])

    const response = await deleteWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await deleteWebhook(
      makeRequest('/api/developer/webhooks/invalid-id', 'DELETE'),
      makeParams('invalid-id')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await deleteWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )

    expect(response.status).toBe(401)
  })
})

describe('List Deliveries (GET /api/developer/webhooks/[id]/deliveries)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns delivery history', async () => {
    // Endpoint ownership check
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'wh-1' }]) // endpoint exists and belongs to dev
      .mockResolvedValueOnce([
        {
          id: 'del-1',
          event: 'invocation.completed',
          status: 'delivered',
          httpStatus: 200,
          attempts: 1,
          maxAttempts: 3,
          lastAttemptAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ])

    const response = await listDeliveries(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/deliveries'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deliveries).toHaveLength(1)
    expect(data.deliveries[0].event).toBe('invocation.completed')
  })

  it('returns 404 when endpoint not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // endpoint not found

    const response = await listDeliveries(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/deliveries'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await listDeliveries(
      makeRequest('/api/developer/webhooks/not-a-uuid/deliveries'),
      makeParams('not-a-uuid')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await listDeliveries(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/deliveries'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )

    expect(response.status).toBe(401)
  })
})

describe('Webhook Dispatcher', () => {
  it('dispatchWebhook function exists', async () => {
    const { dispatchWebhook } = await import('@/lib/webhooks')
    expect(typeof dispatchWebhook).toBe('function')
  })
})
