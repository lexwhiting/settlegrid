import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockAttemptWebhookDelivery } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    mockAttemptWebhookDelivery: vi.fn().mockResolvedValue({ httpStatus: 200, status: 'delivered' }),
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
    status: 'status',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/webhooks', () => ({
  attemptWebhookDelivery: mockAttemptWebhookDelivery,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { POST as testWebhook } from '@/app/api/developer/webhooks/[id]/test/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

describe('Webhook Test Endpoint (POST /api/developer/webhooks/[id]/test)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
    mockAttemptWebhookDelivery.mockResolvedValue({ httpStatus: 200, status: 'delivered' })
  })

  it('sends test ping and returns success', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'wh-1',
      url: 'https://example.com/webhook',
      secret: 'whsec_test123',
      status: 'active',
    }])

    const response = await testWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/test'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.httpStatus).toBe(200)
    expect(data.event).toBe('test.ping')
    expect(data.payload.test).toBe(true)
    expect(data.payload.data.message).toBe('Test webhook from SettleGrid')

    // Verify attemptWebhookDelivery was called with test.ping event
    expect(mockAttemptWebhookDelivery).toHaveBeenCalledWith(
      'https://example.com/webhook',
      'whsec_test123',
      'test.ping',
      expect.objectContaining({ message: 'Test webhook from SettleGrid', test: true })
    )
  })

  it('returns 404 when endpoint not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await testWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/test'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 for inactive endpoint', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'wh-1',
      url: 'https://example.com/webhook',
      secret: 'whsec_test123',
      status: 'disabled',
    }])

    const response = await testWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/test'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('ENDPOINT_INACTIVE')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await testWebhook(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000/test'),
      makeParams('550e8400-e29b-41d4-a716-446655440000')
    )

    expect(response.status).toBe(401)
  })
})
