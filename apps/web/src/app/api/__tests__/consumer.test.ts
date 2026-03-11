import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, mockComparePassword, mockRequireConsumer } = vi.hoisted(() => {
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
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
    mockComparePassword: vi.fn().mockResolvedValue(true),
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'consumer@example.com' }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  consumers: {
    id: 'id',
    email: 'email',
    passwordHash: 'password_hash',
    stripeCustomerId: 'stripe_customer_id',
    createdAt: 'created_at',
  },
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
    name: 'name',
    slug: 'slug',
    status: 'status',
  },
  consumerToolBalances: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
    autoRefill: 'auto_refill',
    autoRefillAmountCents: 'auto_refill_amount_cents',
    autoRefillThresholdCents: 'auto_refill_threshold_cents',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    method: 'method',
    costCents: 'cost_cents',
    latencyMs: 'latency_ms',
    status: 'status',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2a$12$hashed'),
  comparePassword: mockComparePassword,
  createToken: vi.fn().mockResolvedValue('mock-consumer-token'),
  setSessionCookie: vi.fn().mockImplementation((response: unknown) => response),
  clearSessionCookie: vi.fn().mockImplementation((response: unknown) => response),
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/crypto', () => ({
  generateApiKey: vi.fn().mockReturnValue({
    key: 'sg_live_abcdef1234567890abcdef1234567890',
    hash: 'sha256hash',
    prefix: 'sg_live_',
  }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
}))

import { POST as consumerRegister } from '@/app/api/auth/consumer/register/route'
import { POST as consumerLogin } from '@/app/api/auth/consumer/login/route'
import { GET as consumerMe } from '@/app/api/auth/consumer/me/route'
import { POST as consumerLogout } from '@/app/api/auth/consumer/logout/route'
import { GET as listKeys, POST as createKey } from '@/app/api/consumer/keys/route'
import { DELETE as revokeKey } from '@/app/api/consumer/keys/[id]/route'
import { GET as getBalance } from '@/app/api/consumer/balance/route'
import { GET as getUsage } from '@/app/api/consumer/usage/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Consumer Register (POST /api/auth/consumer/register)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([
      { id: 'con-new', email: 'new@example.com', createdAt: new Date('2026-01-01') },
    ])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  })

  it('registers a new consumer', async () => {
    const request = makeRequest('/api/auth/consumer/register', 'POST', {
      email: 'new@example.com',
      password: 'securepass1',
    })

    const response = await consumerRegister(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.consumer).toBeDefined()
    expect(data.token).toBe('mock-consumer-token')
  })

  it('returns 409 for duplicate email', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing' }])

    const request = makeRequest('/api/auth/consumer/register', 'POST', {
      email: 'existing@example.com',
      password: 'securepass1',
    })

    const response = await consumerRegister(request)
    expect(response.status).toBe(409)
  })

  it('returns 422 for short password', async () => {
    const request = makeRequest('/api/auth/consumer/register', 'POST', {
      email: 'new@example.com',
      password: 'short',
    })

    const response = await consumerRegister(request)
    expect(response.status).toBe(422)
  })
})

describe('Consumer Login (POST /api/auth/consumer/login)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  })

  it('logs in with valid credentials', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'con-123', email: 'con@example.com', passwordHash: '$2a$12$hash', createdAt: new Date() },
    ])

    const request = makeRequest('/api/auth/consumer/login', 'POST', {
      email: 'con@example.com',
      password: 'correctpass1',
    })

    const response = await consumerLogin(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.consumer).toBeDefined()
    expect(data.token).toBeDefined()
  })

  it('returns 401 for wrong password', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'con-123', email: 'con@example.com', passwordHash: '$2a$12$hash', createdAt: new Date() },
    ])
    mockComparePassword.mockResolvedValueOnce(false)

    const request = makeRequest('/api/auth/consumer/login', 'POST', {
      email: 'con@example.com',
      password: 'wrongpassword',
    })

    const response = await consumerLogin(request)
    expect(response.status).toBe(401)
  })
})

describe('Consumer Me (GET /api/auth/consumer/me)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('returns consumer profile', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'con-123', email: 'con@example.com', stripeCustomerId: null, createdAt: new Date() },
    ])

    const request = makeRequest('/api/auth/consumer/me')
    const response = await consumerMe(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.consumer.email).toBe('con@example.com')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/auth/consumer/me')
    const response = await consumerMe(request)
    expect(response.status).toBe(401)
  })
})

describe('Consumer Logout (POST /api/auth/consumer/logout)', () => {
  it('returns success on logout', async () => {
    const response = await consumerLogout()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain('Logged out')
  })
})

describe('API Key Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('lists consumer API keys', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'key-1', keyPrefix: 'sg_live_', toolId: 'tool-1', status: 'active', lastUsedAt: null, createdAt: new Date() },
    ])

    const request = makeRequest('/api/consumer/keys')
    const response = await listKeys(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.keys).toHaveLength(1)
    expect(data.keys[0].keyPrefix).toBe('sg_live_')
  })

  it('creates a new API key', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', status: 'active' }])
      .mockResolvedValueOnce([])

    mockDb.returning.mockResolvedValueOnce([
      { id: 'key-new', keyPrefix: 'sg_live_', toolId: 'tool-1', status: 'active', createdAt: new Date() },
    ])

    const request = makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
    })

    const response = await createKey(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.key).toBeDefined()
    expect(data.key).toContain('sg_live_')
  })

  it('returns 409 when key already exists for tool', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', status: 'active' }])
      .mockResolvedValueOnce([{ id: 'existing-key' }])

    const request = makeRequest('/api/consumer/keys', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
    })

    const response = await createKey(request)
    expect(response.status).toBe(409)
  })

  it('revokes an API key', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'key-1', status: 'active' }])

    const request = makeRequest('/api/consumer/keys/key-1', 'DELETE')
    const response = await revokeKey(request, { params: Promise.resolve({ id: 'key-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain('revoked')
  })

  it('returns 404 for non-existent key revocation', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/consumer/keys/nonexistent', 'DELETE')
    const response = await revokeKey(request, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(response.status).toBe(404)
  })
})

describe('Consumer Balance (GET /api/consumer/balance)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
  })

  it('returns balances joined with tool info', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'bal-1',
        toolId: 'tool-1',
        balanceCents: 5000,
        autoRefill: false,
        autoRefillAmountCents: 2000,
        autoRefillThresholdCents: 500,
        toolName: 'Test Tool',
        toolSlug: 'test-tool',
      },
    ])

    const request = makeRequest('/api/consumer/balance')
    const response = await getBalance(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.balances).toHaveLength(1)
    expect(data.balances[0].balanceCents).toBe(5000)
    expect(data.balances[0].toolName).toBe('Test Tool')
  })
})

describe('Consumer Usage (GET /api/consumer/usage)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
  })

  it('returns usage data with summary', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'inv-1',
        toolId: 'tool-1',
        toolName: 'Test Tool',
        toolSlug: 'test-tool',
        method: 'classify',
        costCents: 5,
        latencyMs: 120,
        status: 'success',
        createdAt: new Date(),
      },
    ])

    const request = makeRequest('/api/consumer/usage?days=7')
    const response = await getUsage(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.invocations).toHaveLength(1)
    expect(data.summary).toHaveLength(1)
    expect(data.summary[0].totalInvocations).toBe(1)
    expect(data.period.days).toBe(7)
  })
})
