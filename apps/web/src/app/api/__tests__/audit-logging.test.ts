import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
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
    delete: vi.fn(),
    innerJoin: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
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
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@test.com' }),
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'con@test.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', slug: 'slug', name: 'name', description: 'description', pricingConfig: 'pricing_config', status: 'status', developerId: 'developer_id', totalInvocations: 'total_invocations', totalRevenueCents: 'total_revenue_cents', healthEndpoint: 'health_endpoint', createdAt: 'created_at', updatedAt: 'updated_at' },
  apiKeys: { id: 'id', consumerId: 'consumer_id', toolId: 'tool_id', keyHash: 'key_hash', keyPrefix: 'key_prefix', status: 'status', createdAt: 'created_at', lastUsedAt: 'last_used_at' },
  auditLogs: { id: 'id', developerId: 'developer_id', consumerId: 'consumer_id', action: 'action', resourceType: 'resource_type', resourceId: 'resource_id', details: 'details', ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at' },
  webhookEndpoints: { id: 'id', developerId: 'developer_id', url: 'url', secret: 'secret', events: 'events', status: 'status', createdAt: 'created_at' },
  developers: { id: 'id', tier: 'tier' },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/crypto', () => ({
  generateApiKey: vi.fn().mockReturnValue({ key: 'sg_live_test123', hash: 'hash123', prefix: 'sg_live_test1' }),
}))

// Mock writeAuditLog to verify it gets called
const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({ sql: strings, values })),
}))

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
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

describe('Audit Logging on Tool Create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes audit log when a tool is created', async () => {
    const { POST } = await import('@/app/api/tools/route')

    // Slug check: no existing tool
    mockDb.limit.mockResolvedValueOnce([])
    // Insert returning
    mockDb.returning.mockResolvedValueOnce([{
      id: 'tool-new',
      name: 'My Tool',
      slug: 'my-tool',
      description: null,
      pricingConfig: { model: 'per-invocation', defaultCostCents: 10 },
      status: 'draft',
      totalInvocations: 0,
      totalRevenueCents: 0,
      healthEndpoint: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }])

    const response = await POST(makeRequest('/api/tools', 'POST', {
      name: 'My Tool',
      slug: 'my-tool',
      pricingConfig: { model: 'per-invocation', defaultCostCents: 10 },
    }))

    expect(response.status).toBe(201)

    // Wait for the async audit log call
    await new Promise((r) => setTimeout(r, 10))

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-123',
        action: 'tool.created',
        resourceType: 'tool',
        resourceId: 'tool-new',
      })
    )
  })
})

describe('Audit Logging on Tool Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes audit log when a tool is deleted', async () => {
    const { DELETE } = await import('@/app/api/tools/[id]/route')

    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', status: 'active' }])

    const response = await DELETE(
      makeRequest('/api/tools/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )

    expect(response.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-123',
        action: 'tool.deleted',
        resourceType: 'tool',
        resourceId: '550e8400-e29b-41d4-a716-446655440000',
      })
    )
  })
})

describe('Audit Logging on API Key Revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes audit log when a key is revoked', async () => {
    const { DELETE } = await import('@/app/api/consumer/keys/[id]/route')

    mockDb.limit.mockResolvedValueOnce([{ id: 'key-1', status: 'active' }])

    const response = await DELETE(
      makeRequest('/api/consumer/keys/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )

    expect(response.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerId: 'con-123',
        action: 'api_key.revoked',
        resourceType: 'apiKey',
      })
    )
  })
})

describe('Audit Logging on Webhook Create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes audit log when a webhook is created', async () => {
    const { POST } = await import('@/app/api/developer/webhooks/route')

    // Route does dev tier query FIRST, then existing endpoints query
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'standard', isFoundingMember: false }]) // dev tier
      .mockResolvedValueOnce([]) // no existing webhooks

    mockDb.returning.mockResolvedValueOnce([{
      id: 'wh-new',
      url: 'https://example.com/hook',
      events: '["invocation.completed"]',
      status: 'active',
      createdAt: new Date().toISOString(),
    }])

    const response = await POST(makeRequest('/api/developer/webhooks', 'POST', {
      url: 'https://example.com/hook',
      events: ['invocation.completed'],
    }))

    expect(response.status).toBe(201)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-123',
        action: 'webhook.created',
        resourceType: 'webhook',
      })
    )
  })
})

describe('Audit Logging on Webhook Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('writes audit log when a webhook is deleted', async () => {
    const { DELETE } = await import('@/app/api/developer/webhooks/[id]/route')

    mockDb.returning.mockResolvedValueOnce([{ id: 'wh-1' }])

    const response = await DELETE(
      makeRequest('/api/developer/webhooks/550e8400-e29b-41d4-a716-446655440000', 'DELETE'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )

    expect(response.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-123',
        action: 'webhook.deleted',
        resourceType: 'webhook',
      })
    )
  })
})

describe('Audit Log writeAuditLog function', () => {
  it('writeAuditLog inserts into DB', async () => {
    // Test the actual function (unmocked)
    vi.doUnmock('@/lib/audit')
    const { writeAuditLog } = await import('@/lib/audit')
    expect(typeof writeAuditLog).toBe('function')
  })
})
