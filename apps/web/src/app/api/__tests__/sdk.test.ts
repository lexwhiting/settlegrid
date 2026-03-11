import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
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
    then: vi.fn().mockReturnThis(),
    catch: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  apiKeys: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    keyHash: 'key_hash',
    keyPrefix: 'key_prefix',
    status: 'status',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
    developerId: 'developer_id',
    slug: 'slug',
    status: 'status',
    totalInvocations: 'total_invocations',
    totalRevenueCents: 'total_revenue_cents',
    updatedAt: 'updated_at',
  },
  consumerToolBalances: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    apiKeyId: 'api_key_id',
    method: 'method',
    costCents: 'cost_cents',
    latencyMs: 'latency_ms',
    status: 'status',
    createdAt: 'created_at',
  },
  developers: {
    id: 'id',
    balanceCents: 'balance_cents',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/crypto', () => ({
  hashApiKey: vi.fn().mockReturnValue('hashed-api-key-sha256'),
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { POST as validateKey } from '@/app/api/sdk/validate-key/route'
import { POST as meter } from '@/app/api/sdk/meter/route'

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Validate Key (POST /api/sdk/validate-key)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.then.mockReturnThis()
    mockDb.catch.mockReturnThis()
  })

  it('returns valid=true for active key with matching slug', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        {
          keyId: 'key-1',
          keyStatus: 'active',
          consumerId: 'con-123',
          toolId: 'tool-1',
          toolSlug: 'my-tool',
          toolStatus: 'active',
        },
      ])
      .mockResolvedValueOnce([{ balanceCents: 5000 }])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_abc123',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.consumerId).toBe('con-123')
    expect(data.toolId).toBe('tool-1')
    expect(data.balanceCents).toBe(5000)
  })

  it('returns valid=false for non-existent key', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_doesnotexist',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(false)
    expect(data.reason).toContain('Invalid')
  })

  it('returns valid=false for revoked key', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-1',
        keyStatus: 'revoked',
        consumerId: 'con-123',
        toolId: 'tool-1',
        toolSlug: 'my-tool',
        toolStatus: 'active',
      },
    ])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_revokedkey',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(data.valid).toBe(false)
    expect(data.reason).toContain('revoked')
  })

  it('returns valid=false for inactive tool', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-1',
        keyStatus: 'active',
        consumerId: 'con-123',
        toolId: 'tool-1',
        toolSlug: 'my-tool',
        toolStatus: 'draft',
      },
    ])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_valid',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(data.valid).toBe(false)
    expect(data.reason).toContain('not active')
  })

  it('returns valid=false for wrong slug', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-1',
        keyStatus: 'active',
        consumerId: 'con-123',
        toolId: 'tool-1',
        toolSlug: 'other-tool',
        toolStatus: 'active',
      },
    ])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_valid',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(data.valid).toBe(false)
    expect(data.reason).toContain('does not match')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 1000, remaining: 0, reset: 60000 })

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_test',
      toolSlug: 'tool',
    })

    const response = await validateKey(request)
    expect(response.status).toBe(429)
  })

  it('returns zero balance when no balance record exists', async () => {
    mockDb.limit
      .mockResolvedValueOnce([
        {
          keyId: 'key-1',
          keyStatus: 'active',
          consumerId: 'con-123',
          toolId: 'tool-1',
          toolSlug: 'my-tool',
          toolStatus: 'active',
        },
      ])
      .mockResolvedValueOnce([])

    const request = makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_valid',
      toolSlug: 'my-tool',
    })

    const response = await validateKey(request)
    const data = await response.json()

    expect(data.valid).toBe(true)
    expect(data.balanceCents).toBe(0)
  })
})

describe('Meter (POST /api/sdk/meter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
  })

  it('meters a successful invocation and deducts credits', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'balance-1', balanceCents: 5000 }])
      .mockResolvedValueOnce([{ developerId: 'dev-1' }])

    mockDb.returning
      .mockResolvedValueOnce([{ balanceCents: 4995 }])
      .mockResolvedValueOnce([{ id: 'inv-1' }])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
      latencyMs: 120,
    })

    const response = await meter(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.costCents).toBe(5)
  })

  it('returns 402 for insufficient credits', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'balance-1', balanceCents: 2 }])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    })

    const response = await meter(request)
    const data = await response.json()

    expect(response.status).toBe(402)
    expect(data.code).toBe('INSUFFICIENT_CREDITS')
  })

  it('returns 402 when no balance record exists', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    })

    const response = await meter(request)
    expect(response.status).toBe(402)
  })

  it('handles zero-cost invocations', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 'inv-free' }])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'ping',
      costCents: 0,
    })

    const response = await meter(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.costCents).toBe(0)
  })

  it('returns 422 for missing required fields', async () => {
    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
    })

    const response = await meter(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 for negative costCents', async () => {
    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: -10,
    })

    const response = await meter(request)
    expect(response.status).toBe(422)
  })
})
