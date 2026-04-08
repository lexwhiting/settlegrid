import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
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
  }

  // Default: all methods return mockDb for chaining
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'consumer@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
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
    ipAllowlist: 'ip_allowlist',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
  },
  // Route also references tools schema for the join with tool details
  tools: { id: 'id', name: 'name', slug: 'slug', developerId: 'developer_id' },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { PATCH, DELETE } from '@/app/api/consumer/keys/[id]/ip-restrict/route'
import { isValidIpOrCidr, isIpInAllowlist } from '@/lib/ip-validation'

function makeRequest(url: string, method: string = 'PATCH', body?: unknown): NextRequest {
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

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReset()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
  // Set terminal methods to resolve by default
  mockDb.limit.mockResolvedValue([])
  mockDb.returning.mockResolvedValue([])
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('IP Restrict PATCH (PATCH /api/consumer/keys/[id]/ip-restrict)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('sets IP allowlist on an API key', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: VALID_UUID, status: 'active' }])
    mockDb.returning.mockResolvedValueOnce([{
      id: VALID_UUID,
      keyPrefix: 'sg_live_',
      toolId: 'tool-1',
      status: 'active',
      ipAllowlist: ['192.168.1.1', '10.0.0.0/24'],
    }])

    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['192.168.1.1', '10.0.0.0/24'],
      }),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.apiKey.ipAllowlist).toEqual(['192.168.1.1', '10.0.0.0/24'])
  })

  it('rejects invalid IP format', async () => {
    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['not-an-ip', '192.168.1.1'],
      }),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_IP_FORMAT')
    expect(data.error).toContain('not-an-ip')
  })

  it('rejects more than 20 IP entries', async () => {
    const tooManyIPs = Array.from({ length: 21 }, (_, i) => `10.0.0.${i}`)

    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: tooManyIPs,
      }),
      makeParams(VALID_UUID)
    )

    expect(response.status).toBe(422)
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await PATCH(
      makeRequest('/api/consumer/keys/invalid-id/ip-restrict', 'PATCH', {
        ipAllowlist: ['192.168.1.1'],
      }),
      makeParams('invalid-id')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 404 when key not found', async () => {
    // limit resolves to [] by default (no key found)
    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['192.168.1.1'],
      }),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 when key is revoked', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: VALID_UUID, status: 'revoked' }])

    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['192.168.1.1'],
      }),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('KEY_NOT_ACTIVE')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['192.168.1.1'],
      }),
      makeParams(VALID_UUID)
    )

    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await PATCH(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'PATCH', {
        ipAllowlist: ['192.168.1.1'],
      }),
      makeParams(VALID_UUID)
    )

    expect(response.status).toBe(429)
  })
})

describe('IP Restrict DELETE (DELETE /api/consumer/keys/[id]/ip-restrict)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('clears IP allowlist', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: VALID_UUID, status: 'active' }])
    mockDb.returning.mockResolvedValueOnce([{
      id: VALID_UUID,
      keyPrefix: 'sg_live_',
      toolId: 'tool-1',
      status: 'active',
      ipAllowlist: null,
    }])

    const response = await DELETE(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'DELETE'),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.apiKey.ipAllowlist).toBeNull()
  })

  it('returns 404 when key not found', async () => {
    // limit resolves to [] by default (no key found)
    const response = await DELETE(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'DELETE'),
      makeParams(VALID_UUID)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await DELETE(
      makeRequest('/api/consumer/keys/not-valid/ip-restrict', 'DELETE'),
      makeParams('not-valid')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await DELETE(
      makeRequest(`/api/consumer/keys/${VALID_UUID}/ip-restrict`, 'DELETE'),
      makeParams(VALID_UUID)
    )

    expect(response.status).toBe(401)
  })
})

// ─── IP Validation Utility Tests ──────────────────────────────────────────────

describe('isValidIpOrCidr', () => {
  it('accepts valid IPv4 address', () => {
    expect(isValidIpOrCidr('192.168.1.1')).toBe(true)
    expect(isValidIpOrCidr('10.0.0.1')).toBe(true)
    expect(isValidIpOrCidr('255.255.255.255')).toBe(true)
  })

  it('accepts valid IPv4 with CIDR notation', () => {
    expect(isValidIpOrCidr('10.0.0.0/24')).toBe(true)
    expect(isValidIpOrCidr('192.168.0.0/16')).toBe(true)
    expect(isValidIpOrCidr('172.16.0.0/12')).toBe(true)
  })

  it('accepts valid IPv6 address', () => {
    expect(isValidIpOrCidr('::1')).toBe(true)
    expect(isValidIpOrCidr('fe80::1')).toBe(true)
    expect(isValidIpOrCidr('2001:db8::1')).toBe(true)
  })

  it('rejects invalid IP strings', () => {
    expect(isValidIpOrCidr('not-an-ip')).toBe(false)
    expect(isValidIpOrCidr('hello')).toBe(false)
    expect(isValidIpOrCidr('')).toBe(false)
    expect(isValidIpOrCidr('abc.def.ghi.jkl')).toBe(false)
  })
})

describe('isIpInAllowlist', () => {
  it('returns true for exact match', () => {
    expect(isIpInAllowlist('192.168.1.1', ['192.168.1.1', '10.0.0.1'])).toBe(true)
  })

  it('returns false when IP is not in allowlist', () => {
    expect(isIpInAllowlist('172.16.0.1', ['192.168.1.1', '10.0.0.1'])).toBe(false)
  })

  it('returns true when allowlist is empty (unrestricted)', () => {
    expect(isIpInAllowlist('192.168.1.1', [])).toBe(true)
  })

  it('handles CIDR-style prefix matching', () => {
    expect(isIpInAllowlist('10.0.0.5', ['10.0.0.0/24'])).toBe(true)
  })

  it('returns false for IP outside CIDR range', () => {
    expect(isIpInAllowlist('10.1.0.5', ['10.0.0.0/24'])).toBe(false)
  })
})
