import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, mockHashApiKey, mockCheckBudget, mockDeductCreditsRedis, mockRecordInvocationAsync, mockIncrementPeriodSpend } = vi.hoisted(() => {
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

  for (const key of Object.keys(mockDb)) {
    if (key === 'then') {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockImplementation((resolve?: (v: unknown) => unknown) => {
        return Promise.resolve(undefined).then(resolve)
      })
    } else if (key === 'catch') {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
    } else {
      (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
    }
  }

  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
    mockHashApiKey: vi.fn().mockReturnValue('hashed-key'),
    mockCheckBudget: vi.fn().mockResolvedValue({ allowed: true }),
    mockDeductCreditsRedis: vi.fn().mockResolvedValue(null),
    mockRecordInvocationAsync: vi.fn(),
    mockIncrementPeriodSpend: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  apiKeys: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    keyHash: 'key_hash',
    keyPrefix: 'key_prefix',
    status: 'status',
    isTestKey: 'is_test_key',
    ipAllowlist: 'ip_allowlist',
    lastUsedAt: 'last_used_at',
  },
  tools: {
    id: 'id',
    slug: 'slug',
    status: 'status',
    developerId: 'developer_id',
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
  developers: {
    id: 'id',
    revenueSharePct: 'revenue_share_pct',
    balanceCents: 'balance_cents',
    updatedAt: 'updated_at',
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
    isTest: 'is_test',
    referralCode: 'referral_code',
  },
}))

vi.mock('@/lib/crypto', () => ({
  hashApiKey: mockHashApiKey,
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/ip-validation', () => ({
  isIpInAllowlist: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/metering', () => ({
  checkBudget: mockCheckBudget,
  deductCreditsRedis: mockDeductCreditsRedis,
  recordInvocationAsync: mockRecordInvocationAsync,
  incrementPeriodSpend: mockIncrementPeriodSpend,
  creditReferralCommission: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({ sql: strings, values })),
}))

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

describe('Validate Key — Test Mode (POST /api/sdk/validate-key)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns isTestKey=true and virtual balance for test keys', async () => {
    const { POST } = await import('@/app/api/sdk/validate-key/route')

    mockDb.limit.mockResolvedValueOnce([{
      keyId: 'key-test-1',
      keyStatus: 'active',
      consumerId: 'con-123',
      toolId: 'tool-1',
      toolSlug: 'my-tool',
      toolStatus: 'active',
      ipAllowlist: null,
      isTestKey: true,
    }])

    const response = await POST(makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_test_abc123',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.isTestKey).toBe(true)
    expect(data.balanceCents).toBe(999999)
  })

  it('returns isTestKey=false and real balance for live keys', async () => {
    const { POST } = await import('@/app/api/sdk/validate-key/route')

    mockDb.limit
      .mockResolvedValueOnce([{
        keyId: 'key-live-1',
        keyStatus: 'active',
        consumerId: 'con-123',
        toolId: 'tool-1',
        toolSlug: 'my-tool',
        toolStatus: 'active',
        ipAllowlist: null,
        isTestKey: false,
      }])
      .mockResolvedValueOnce([{ balanceCents: 5000 }])

    const response = await POST(makeRequest('/api/sdk/validate-key', {
      apiKey: 'sg_live_abc123',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.isTestKey).toBe(false)
    expect(data.balanceCents).toBe(5000)
  })
})

describe('Meter — Test Mode (POST /api/sdk/meter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('skips billing for test keys and returns billed=false', async () => {
    const { POST } = await import('@/app/api/sdk/meter/route')

    // Verify key is test key
    mockDb.limit.mockResolvedValueOnce([{ isTestKey: true }])
    // Insert invocation
    mockDb.returning.mockResolvedValueOnce([{ id: 'inv-test-1' }])

    const response = await POST(makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440001',
      toolId: '550e8400-e29b-41d4-a716-446655440002',
      keyId: '550e8400-e29b-41d4-a716-446655440003',
      method: 'test.method',
      costCents: 10,
      isTestKey: true,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.billed).toBe(false)
    expect(data.reason).toBe('TEST_MODE')
    expect(data.costCents).toBe(0)
    expect(data.remainingBalanceCents).toBe(999999)
  })

  it('falls through to normal billing if isTestKey flag is false in DB', async () => {
    const { POST } = await import('@/app/api/sdk/meter/route')

    // Key is NOT actually a test key in DB
    mockDb.limit
      .mockResolvedValueOnce([{ isTestKey: false }])
      // Tool lookup for budget check etc will return the tool
      .mockResolvedValueOnce([{ developerId: 'dev-1', revenueSharePct: 85 }])
      // Balance check fallback
      .mockResolvedValueOnce([{ id: 'bal-1', balanceCents: 1000 }])

    // DB deduction
    mockDb.returning.mockResolvedValueOnce([{ balanceCents: 990 }])
    // Tool update returning
    // Developer update
    // Insert invocation
    mockDb.returning.mockResolvedValueOnce([{ id: 'inv-1' }])

    const response = await POST(makeRequest('/api/sdk/meter', {
      toolSlug: 'my-tool',
      consumerId: '550e8400-e29b-41d4-a716-446655440001',
      toolId: '550e8400-e29b-41d4-a716-446655440002',
      keyId: '550e8400-e29b-41d4-a716-446655440003',
      method: 'test.method',
      costCents: 10,
      isTestKey: true,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Should not have test mode flags — normal billing
    expect(data.billed).toBeUndefined()
  })
})
