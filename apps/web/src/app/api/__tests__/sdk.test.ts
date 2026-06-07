import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, mockCheckTieredRateLimit, mockDetectFraud } = vi.hoisted(() => {
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
    then: vi.fn(),
    catch: vi.fn(),
  }

  // By default, all methods return mockDb for chaining
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }

  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
    mockCheckTieredRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 2000, remaining: 1999, reset: 0 }),
    mockDetectFraud: vi.fn().mockResolvedValue({ flagged: false, reasons: [], signals: [], riskScore: 0 }),
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
    isTestKey: 'is_test_key',
    ipAllowlist: 'ip_allowlist',
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
    currentPeriodSpendCents: 'current_period_spend_cents',
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
    isFlagged: 'is_flagged',
  },
  developers: {
    id: 'id',
    balanceCents: 'balance_cents',
    revenueSharePct: 'revenue_share_pct',
    tier: 'tier',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/crypto', () => ({
  hashApiKey: vi.fn().mockReturnValue('hashed-api-key-sha256'),
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
  checkTieredRateLimit: mockCheckTieredRateLimit,
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

vi.mock('@/lib/metering', () => ({
  checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
  deductCreditsRedis: vi.fn().mockResolvedValue(null), // null = fallback to DB
  recordInvocationAsync: vi.fn(),
  incrementPeriodSpend: vi.fn(),
}))

vi.mock('@/lib/ip-validation', () => ({
  isIpInAllowlist: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/fraud', () => ({
  detectFraud: mockDetectFraud,
  isIpBlocked: vi.fn().mockResolvedValue(false),
  trackFailedAuth: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { POST as validateKey } from '@/app/api/sdk/validate-key/route'
import { POST as meter } from '@/app/api/sdk/meter/route'
import { POST as meterWithMetadata } from '@/app/api/sdk/meter-with-metadata/route'

function makeRequest(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    if (key === 'then') {
      vi.mocked(mockDb.then).mockImplementation((resolve?: (v: unknown) => unknown) => {
        return Promise.resolve(undefined).then(resolve)
      })
    } else if (key === 'catch') {
      vi.mocked(mockDb.catch).mockReturnValue(mockDb)
    } else {
      vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
    }
  }
}

describe('Validate Key (POST /api/sdk/validate-key)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockCheckTieredRateLimit.mockResolvedValue({ success: true, limit: 2000, remaining: 1999, reset: 0 })
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
          developerId: 'dev-1',
        },
      ])
      .mockResolvedValueOnce([{ tier: 'starter' }]) // developer tier lookup
      .mockResolvedValueOnce([{ balanceCents: 5000 }]) // balance lookup

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
        developerId: 'dev-1',
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
        developerId: 'dev-1',
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
        developerId: 'dev-1',
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
          developerId: 'dev-1',
        },
      ])
      .mockResolvedValueOnce([{ tier: 'free' }]) // developer tier
      .mockResolvedValueOnce([]) // no balance

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
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockCheckTieredRateLimit.mockResolvedValue({ success: true, limit: 2000, remaining: 1999, reset: 0 })
    mockDetectFraud.mockResolvedValue({ flagged: false, reasons: [], signals: [], riskScore: 0 })
  })

  it('meters a successful invocation and deducts credits', async () => {
    // 1st limit = F2 auth: api-key lookup by hash (NEW first query)
    // 2nd limit = tool+dev lookup
    // 3rd limit = apiKeys createdAt for fraud check
    // 4th limit = balance check
    mockDb.limit
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440002', consumerId: '550e8400-e29b-41d4-a716-446655440000', toolId: '550e8400-e29b-41d4-a716-446655440001', status: 'active' }]) // F2 auth row
      .mockResolvedValueOnce([{ developerId: 'dev-1', revenueSharePct: 95, developerTier: 'starter' }])
      .mockResolvedValueOnce([{ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }]) // key createdAt
      .mockResolvedValueOnce([{ id: 'balance-1', balanceCents: 5000 }]) // balance check

    // Balance deduction + invocation insert: .returning()
    mockDb.returning
      .mockResolvedValueOnce([{ balanceCents: 4995 }])  // balance deduction
      .mockResolvedValueOnce([{ id: 'inv-1' }]) // invocation insert

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
      latencyMs: 120,
    }, { 'x-api-key': 'sg_live_meter_test_key_000000000' })

    const response = await meter(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.costCents).toBe(5)
  })

  it('returns 402 for insufficient credits', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440002', consumerId: '550e8400-e29b-41d4-a716-446655440000', toolId: '550e8400-e29b-41d4-a716-446655440001', status: 'active' }]) // F2 auth row
      .mockResolvedValueOnce([{ developerId: 'dev-1', revenueSharePct: 95, developerTier: 'starter' }])
      .mockResolvedValueOnce([{ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }])
      .mockResolvedValueOnce([{ id: 'balance-1', balanceCents: 2 }])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    }, { 'x-api-key': 'sg_live_meter_test_key_000000000' })

    const response = await meter(request)
    const data = await response.json()

    expect(response.status).toBe(402)
    expect(data.code).toBe('INSUFFICIENT_CREDITS')
  })

  it('returns 402 when no balance record exists', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440002', consumerId: '550e8400-e29b-41d4-a716-446655440000', toolId: '550e8400-e29b-41d4-a716-446655440001', status: 'active' }]) // F2 auth row
      .mockResolvedValueOnce([{ developerId: 'dev-1', revenueSharePct: 95, developerTier: 'starter' }])
      .mockResolvedValueOnce([{ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }])
      .mockResolvedValueOnce([]) // no balance

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    }, { 'x-api-key': 'sg_live_meter_test_key_000000000' })

    const response = await meter(request)
    expect(response.status).toBe(402)
  })

  it('handles zero-cost invocations', async () => {
    // 1st limit = F2 auth row; 2nd limit = tool+dev lookup
    mockDb.limit
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440002', consumerId: '550e8400-e29b-41d4-a716-446655440000', toolId: '550e8400-e29b-41d4-a716-446655440001', status: 'active' }]) // F2 auth row
      .mockResolvedValueOnce([{ developerId: 'dev-1', revenueSharePct: 95, developerTier: 'starter' }])

    // Make mockDb thenable for await db.update().set().where()
    mockDb.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      resolve(undefined)
      return Promise.resolve(undefined)
    })

    // insert().values().returning() for invocation
    mockDb.returning.mockResolvedValueOnce([{ id: 'inv-free' }])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'ping',
      costCents: 0,
    }, { 'x-api-key': 'sg_live_meter_test_key_000000000' })

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

  it('returns 401 when no X-Api-Key header is present', async () => {
    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    }) // deliberately no x-api-key header

    const response = await meter(request)
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.code).toBe('API_KEY_REQUIRED')
  })

  it('returns 403 when the key does not own the request identity (binding mismatch)', async () => {
    // F2 auth row resolves to a DIFFERENT consumerId than the body claims.
    mockDb.limit.mockResolvedValueOnce([
      { id: '550e8400-e29b-41d4-a716-446655440002', consumerId: '11111111-1111-1111-1111-111111111111', toolId: '550e8400-e29b-41d4-a716-446655440001', status: 'active' },
    ])

    const request = makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440000',
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      keyId: '550e8400-e29b-41d4-a716-446655440002',
      method: 'classify',
      costCents: 5,
    }, { 'x-api-key': 'sg_live_meter_test_key_000000000' })

    const response = await meter(request)
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.code).toBe('KEY_BINDING_MISMATCH')
  })
})

describe('Meter With Metadata (POST /api/sdk/meter-with-metadata)', () => {
  const META_KEY = 'sg_live_meter_test_key_000000000'
  const metaBody = {
    toolSlug: 'my-tool',
    consumerId: '550e8400-e29b-41d4-a716-446655440000',
    toolId: '550e8400-e29b-41d4-a716-446655440001',
    keyId: '550e8400-e29b-41d4-a716-446655440002',
    method: 'classify',
    costCents: 0,
  }
  const authRow = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    consumerId: '550e8400-e29b-41d4-a716-446655440000',
    toolId: '550e8400-e29b-41d4-a716-446655440001',
    status: 'active',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns 401 when no X-Api-Key header is present', async () => {
    const response = await meterWithMetadata(makeRequest('/api/sdk/meter-with-metadata', metaBody))
    const data = await response.json()
    expect(response.status).toBe(401)
    expect(data.code).toBe('API_KEY_REQUIRED')
  })

  it('returns 403 when the key does not own the request identity (binding mismatch)', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { ...authRow, consumerId: '11111111-1111-1111-1111-111111111111' },
    ])
    const response = await meterWithMetadata(
      makeRequest('/api/sdk/meter-with-metadata', metaBody, { 'x-api-key': META_KEY }),
    )
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.code).toBe('KEY_BINDING_MISMATCH')
  })

  it('authenticates and records a zero-cost invocation (200)', async () => {
    mockDb.limit.mockResolvedValueOnce([authRow]) // F2 auth row
    mockDb.returning.mockResolvedValueOnce([{ id: 'inv-meta-1' }]) // zero-cost invocation insert
    const response = await meterWithMetadata(
      makeRequest('/api/sdk/meter-with-metadata', metaBody, { 'x-api-key': META_KEY }),
    )
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.costCents).toBe(0)
    expect(data.invocationId).toBe('inv-meta-1')
  })
})
