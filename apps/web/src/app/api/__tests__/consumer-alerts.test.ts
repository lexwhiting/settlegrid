import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    innerJoin: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
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
  consumerAlerts: { id: 'id', consumerId: 'consumer_id', toolId: 'tool_id', alertType: 'alert_type', threshold: 'threshold', channel: 'channel', status: 'status', lastTriggeredAt: 'last_triggered_at', createdAt: 'created_at' },
  tools: { id: 'id', name: 'name', status: 'status' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireConsumer: mockRequireConsumer }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET, POST } from '@/app/api/consumer/alerts/route'
import { PATCH, DELETE } from '@/app/api/consumer/alerts/[id]/route'

function makeGet(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatch(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDelete(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R14: Consumer Alerts', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  describe('GET /api/consumer/alerts', () => {
    it('returns alerts for authenticated consumer', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { id: 'alert-1', toolId: 'tool-1', toolName: 'Test Tool', alertType: 'low_balance', threshold: 100, channel: 'email', status: 'active', lastTriggeredAt: null, createdAt: '2026-03-10' },
      ])
      const res = await GET(makeGet('/api/consumer/alerts'))
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.alerts).toHaveLength(1)
    })

    it('returns 401 when not authenticated', async () => {
      mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))
      const res = await GET(makeGet('/api/consumer/alerts'))
      expect(res.status).toBe(401)
    })

    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
      const res = await GET(makeGet('/api/consumer/alerts'))
      expect(res.status).toBe(429)
    })
  })

  describe('POST /api/consumer/alerts', () => {
    it('creates a new alert', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'tool-1' }])  // tool exists
        .mockResolvedValueOnce([])  // existing alerts count (< 20)
      mockDb.returning.mockResolvedValueOnce([{
        id: 'alert-new', toolId: 'tool-1', alertType: 'low_balance', threshold: 100, channel: 'email', status: 'active', createdAt: '2026-03-10',
      }])
      const res = await POST(makePost('/api/consumer/alerts', {
        toolId: '00000000-0000-0000-0000-000000000001', alertType: 'low_balance', threshold: 100,
      }))
      const data = await res.json()
      expect(res.status).toBe(201)
      expect(data.alert).toBeDefined()
    })

    it('returns 404 when tool not found', async () => {
      mockDb.limit.mockResolvedValueOnce([])  // tool not found
      const res = await POST(makePost('/api/consumer/alerts', {
        toolId: '00000000-0000-0000-0000-000000000001', alertType: 'low_balance', threshold: 100,
      }))
      expect(res.status).toBe(404)
    })

    it('returns 400 when max alerts reached', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'tool-1' }])
        .mockResolvedValueOnce(Array(20).fill({ id: 'alert-x' }))
      const res = await POST(makePost('/api/consumer/alerts', {
        toolId: '00000000-0000-0000-0000-000000000001', alertType: 'low_balance', threshold: 100,
      }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('ALERT_LIMIT_REACHED')
    })

    it('rejects invalid alert type', async () => {
      const res = await POST(makePost('/api/consumer/alerts', {
        toolId: '00000000-0000-0000-0000-000000000001', alertType: 'invalid', threshold: 100,
      }))
      expect(res.status).toBe(422)
    })
  })

  describe('PATCH /api/consumer/alerts/[id]', () => {
    it('updates an alert', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'alert-1' }])
      mockDb.returning.mockResolvedValueOnce([{
        id: 'alert-1', toolId: 'tool-1', alertType: 'low_balance', threshold: 200, channel: 'email', status: 'active', lastTriggeredAt: null,
      }])
      const res = await PATCH(
        makePatch('/api/consumer/alerts/00000000-0000-0000-0000-000000000001', { threshold: 200 }),
        { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
      )
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.alert).toBeDefined()
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await PATCH(
        makePatch('/api/consumer/alerts/bad-id', { threshold: 200 }),
        { params: Promise.resolve({ id: 'bad-id' }) }
      )
      expect(res.status).toBe(400)
    })

    it('returns 404 when alert not found', async () => {
      mockDb.limit.mockResolvedValueOnce([])
      const res = await PATCH(
        makePatch('/api/consumer/alerts/00000000-0000-0000-0000-000000000001', { threshold: 200 }),
        { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
      )
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/consumer/alerts/[id]', () => {
    it('deletes an alert', async () => {
      // Step 1: ownership check — select().from().where().limit() => [{ id: 'alert-1' }]
      mockDb.limit.mockResolvedValueOnce([{ id: 'alert-1' }])
      // Step 2: delete().where() must be awaitable
      // The delete chain is: db.delete(table) -> .where(eq(...))
      // .delete() returns mockDb, then .where() must resolve
      let whereCallCount = 0
      mockDb.where.mockImplementation(() => {
        whereCallCount++
        // First where is from SELECT, returns mockDb (chainable to .limit)
        if (whereCallCount === 1) return mockDb
        // Second where is from DELETE, must be awaitable
        return Promise.resolve(undefined)
      })

      const res = await DELETE(
        makeDelete('/api/consumer/alerts/00000000-0000-0000-0000-000000000001'),
        { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
      )
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.deleted).toBe(true)
    })

    it('returns 404 when alert not found', async () => {
      // ownership check returns empty
      mockDb.limit.mockResolvedValueOnce([])
      const res = await DELETE(
        makeDelete('/api/consumer/alerts/00000000-0000-0000-0000-000000000001'),
        { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) }
      )
      expect(res.status).toBe(404)
    })
  })
})
