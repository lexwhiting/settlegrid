import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockGenerateApiKey } = vi.hoisted(() => {
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
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'con@example.com' }),
    mockGenerateApiKey: vi.fn().mockReturnValue({
      key: 'sg_live_generated_key_hex',
      hash: 'abc123hash',
      prefix: 'sg_live_',
    }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))

vi.mock('@/lib/db/schema', () => ({
  apiKeys: {
    id: 'id', consumerId: 'consumer_id', toolId: 'tool_id',
    keyHash: 'key_hash', keyPrefix: 'key_prefix', status: 'status',
    lastUsedAt: 'last_used_at', createdAt: 'created_at',
  },
  tools: {
    id: 'id', name: 'name', slug: 'slug', status: 'status',
  },
  consumerToolBalances: {
    id: 'id', consumerId: 'consumer_id', toolId: 'tool_id',
    balanceCents: 'balance_cents', autoRefill: 'auto_refill',
    autoRefillAmountCents: 'auto_refill_amount_cents',
    autoRefillThresholdCents: 'auto_refill_threshold_cents',
  },
  invocations: {
    id: 'id', consumerId: 'consumer_id', toolId: 'tool_id',
    method: 'method', costCents: 'cost_cents', latencyMs: 'latency_ms',
    status: 'status', createdAt: 'created_at',
  },
  consumers: { id: 'id', email: 'email' },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/crypto', () => ({
  generateApiKey: mockGenerateApiKey,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: vi.fn(),
}))

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Consumer Keys - GET /api/consumer/keys', () => {
  let GET: typeof import('@/app/api/consumer/keys/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    const mod = await import('@/app/api/consumer/keys/route')
    GET = mod.GET
  })

  it('returns list of consumer keys', async () => {
    const mockKeys = [
      { id: 'key-1', keyPrefix: 'sg_live_', toolId: 'tool-1', status: 'active', lastUsedAt: null, createdAt: new Date() },
    ]
    mockDb.limit.mockResolvedValueOnce(mockKeys)

    const response = await GET(makeRequest('/api/consumer/keys'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.keys).toBeDefined()
    expect(Array.isArray(data.keys)).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required. No session token found.'))

    const response = await GET(makeRequest('/api/consumer/keys'))
    expect(response.status).toBe(401)
  })

  it('returns empty array when no keys', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest('/api/consumer/keys'))
    const data = await response.json()
    expect(data.keys).toEqual([])
  })
})

describe('Consumer Keys - POST /api/consumer/keys', () => {
  let POST: typeof import('@/app/api/consumer/keys/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    const mod = await import('@/app/api/consumer/keys/route')
    POST = mod.POST
  })

  it('creates a new API key for active tool', async () => {
    // First limit call: tool lookup (active)
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', status: 'active' }])
    // Second limit call: existing key check (none)
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.returning.mockResolvedValueOnce([
      { id: 'key-new', keyPrefix: 'sg_live_', toolId: 'tool-1', status: 'active', createdAt: new Date() },
    ])

    const response = await POST(makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440000',
    }))
    const data = await response.json()
    expect(response.status).toBe(201)
    expect(data.key).toBeDefined()
    expect(data.apiKey).toBeDefined()
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // tool not found

    const response = await POST(makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440000',
    }))
    expect(response.status).toBe(404)
  })

  it('returns 400 for inactive tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', status: 'draft' }])

    const response = await POST(makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440000',
    }))
    expect(response.status).toBe(400)
  })

  it('returns 409 when key already exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', status: 'active' }])
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing-key' }])

    const response = await POST(makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440000',
    }))
    expect(response.status).toBe(409)
  })

  it('returns 422 for invalid toolId format', async () => {
    const response = await POST(makeRequest('/api/consumer/keys', 'POST', {
      toolId: 'not-a-uuid',
    }))
    expect(response.status).toBe(422)
  })
})

describe('Consumer Keys - DELETE /api/consumer/keys/[id]', () => {
  let DELETE: typeof import('@/app/api/consumer/keys/[id]/route').DELETE

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    const mod = await import('@/app/api/consumer/keys/[id]/route')
    DELETE = mod.DELETE
  })

  it('revokes an active key', async () => {
    const keyId = '550e8400-e29b-41d4-a716-446655440099'
    mockDb.limit.mockResolvedValueOnce([{ id: keyId, status: 'active' }])

    const request = makeRequest(`/api/consumer/keys/${keyId}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: keyId }) })
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.message).toContain('revoked')
  })

  it('returns 404 for non-existent key', async () => {
    const keyId = '550e8400-e29b-41d4-a716-446655440098'
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest(`/api/consumer/keys/${keyId}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: keyId }) })
    expect(response.status).toBe(404)
  })

  it('returns 400 for already revoked key', async () => {
    const keyId = '550e8400-e29b-41d4-a716-446655440097'
    mockDb.limit.mockResolvedValueOnce([{ id: keyId, status: 'revoked' }])

    const request = makeRequest(`/api/consumer/keys/${keyId}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: keyId }) })
    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const keyId = '550e8400-e29b-41d4-a716-446655440096'
    mockRequireConsumer.mockRejectedValueOnce(new Error('No session'))

    const request = makeRequest(`/api/consumer/keys/${keyId}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: keyId }) })
    expect(response.status).toBe(401)
  })
})

describe('Consumer Balance - GET /api/consumer/balance', () => {
  let GET: typeof import('@/app/api/consumer/balance/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    const mod = await import('@/app/api/consumer/balance/route')
    GET = mod.GET
  })

  it('returns balances for authenticated consumer', async () => {
    const mockBalances = [
      { id: 'bal-1', toolId: 'tool-1', balanceCents: 5000, autoRefill: false, autoRefillAmountCents: 0, autoRefillThresholdCents: 0, toolName: 'My Tool', toolSlug: 'my-tool' },
    ]
    mockDb.limit.mockResolvedValueOnce(mockBalances)

    const response = await GET(makeRequest('/api/consumer/balance'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.balances).toBeDefined()
    expect(data.balances).toHaveLength(1)
    expect(data.balances[0].balanceCents).toBe(5000)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('No session'))

    const response = await GET(makeRequest('/api/consumer/balance'))
    expect(response.status).toBe(401)
  })

  it('returns empty array when no balances', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest('/api/consumer/balance'))
    const data = await response.json()
    expect(data.balances).toEqual([])
  })
})

describe('Consumer Usage - GET /api/consumer/usage', () => {
  let GET: typeof import('@/app/api/consumer/usage/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    const mod = await import('@/app/api/consumer/usage/route')
    GET = mod.GET
  })

  it('returns usage data with summary', async () => {
    const mockInvocations = [
      { id: 'inv-1', toolId: 'tool-1', toolName: 'Tool A', toolSlug: 'tool-a', method: 'search', costCents: 5, latencyMs: 100, status: 'success', createdAt: new Date() },
      { id: 'inv-2', toolId: 'tool-1', toolName: 'Tool A', toolSlug: 'tool-a', method: 'query', costCents: 10, latencyMs: 200, status: 'success', createdAt: new Date() },
    ]
    mockDb.limit.mockResolvedValueOnce(mockInvocations)

    const response = await GET(makeRequest('/api/consumer/usage'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.invocations).toHaveLength(2)
    expect(data.summary).toBeDefined()
    expect(data.period).toBeDefined()
  })

  it('calculates correct summary totals', async () => {
    const mockInvocations = [
      { id: 'inv-1', toolId: 'tool-1', toolName: 'A', toolSlug: 'a', method: 'm1', costCents: 5, latencyMs: 100, status: 'success', createdAt: new Date() },
      { id: 'inv-2', toolId: 'tool-1', toolName: 'A', toolSlug: 'a', method: 'm2', costCents: 10, latencyMs: 200, status: 'success', createdAt: new Date() },
      { id: 'inv-3', toolId: 'tool-2', toolName: 'B', toolSlug: 'b', method: 'm1', costCents: 3, latencyMs: 50, status: 'success', createdAt: new Date() },
    ]
    mockDb.limit.mockResolvedValueOnce(mockInvocations)

    const response = await GET(makeRequest('/api/consumer/usage'))
    const data = await response.json()
    expect(data.summary).toHaveLength(2)

    const toolA = data.summary.find((s: { toolId: string }) => s.toolId === 'tool-1')
    expect(toolA.totalInvocations).toBe(2)
    expect(toolA.totalCostCents).toBe(15)

    const toolB = data.summary.find((s: { toolId: string }) => s.toolId === 'tool-2')
    expect(toolB.totalInvocations).toBe(1)
    expect(toolB.totalCostCents).toBe(3)
  })

  it('includes period info with default 30 days', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await GET(makeRequest('/api/consumer/usage'))
    const data = await response.json()
    expect(data.period.days).toBe(30)
    expect(data.period.from).toBeDefined()
    expect(data.period.to).toBeDefined()
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('No session'))

    const response = await GET(makeRequest('/api/consumer/usage'))
    expect(response.status).toBe(401)
  })
})
