import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
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
    isTestKey: 'is_test_key',
    ipAllowlist: 'ip_allowlist',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
    developerId: 'developer_id',
    name: 'name',
    slug: 'slug',
    status: 'status',
  },
}))

vi.mock('@/lib/crypto', () => ({
  hashApiKey: vi.fn().mockReturnValue('hashed-test-key-sha256'),
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { POST } from '@/app/api/sdk/test-validate/route'

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

describe('Test Validate (POST /api/sdk/test-validate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns testMode=true with 999999 balance for valid test key', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-test-1',
        keyStatus: 'active',
        consumerId: 'con-123',
        toolId: 'tool-1',
        isTestKey: true,
        toolSlug: 'my-tool',
        toolStatus: 'active',
      },
    ])

    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_abc123def456',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.testMode).toBe(true)
    expect(data.balanceCents).toBe(999999)
    expect(data.consumerId).toBe('con-123')
    expect(data.toolId).toBe('tool-1')
  })

  it('rejects non-test key prefix', async () => {
    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_live_abc123def456',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(false)
    expect(data.reason).toContain('Not a test API key')
  })

  it('returns valid=false for revoked test key', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-test-2',
        keyStatus: 'revoked',
        consumerId: 'con-123',
        toolId: 'tool-1',
        isTestKey: true,
        toolSlug: 'my-tool',
        toolStatus: 'active',
      },
    ])

    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_revokedkey123',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(false)
    expect(data.reason).toContain('revoked')
  })

  it('returns valid=false when tool slug does not match', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        keyId: 'key-test-3',
        keyStatus: 'active',
        consumerId: 'con-123',
        toolId: 'tool-1',
        isTestKey: true,
        toolSlug: 'other-tool',
        toolStatus: 'active',
      },
    ])

    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_validkey12345',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(false)
    expect(data.reason).toContain('does not match')
  })

  it('returns valid=false for non-existent test key', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_doesnotexist00',
      toolSlug: 'my-tool',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(false)
    expect(data.reason).toContain('Invalid test API key')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 1000, remaining: 0, reset: 60000 })

    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_ratelimited123',
      toolSlug: 'my-tool',
    }))

    expect(response.status).toBe(429)
  })

  it('returns 422 for missing apiKey field', async () => {
    const response = await POST(makeRequest('/api/sdk/test-validate', {
      toolSlug: 'my-tool',
    }))

    expect(response.status).toBe(422)
  })

  it('returns 422 for missing toolSlug field', async () => {
    const response = await POST(makeRequest('/api/sdk/test-validate', {
      apiKey: 'sg_test_keyonly123456',
    }))

    expect(response.status).toBe(422)
  })
})
