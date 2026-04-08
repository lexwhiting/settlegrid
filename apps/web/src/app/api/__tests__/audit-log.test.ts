import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
  }

  // Default: all methods return mockDb for chaining
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  auditLogs: {
    id: 'id',
    developerId: 'developer_id',
    consumerId: 'consumer_id',
    action: 'action',
    resourceType: 'resource_type',
    resourceId: 'resource_id',
    details: 'details',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    createdAt: 'created_at',
  },
  // Route also queries developers for the audit_logs feature gate
  developers: {
    id: 'id',
    tier: 'tier',
    isFoundingMember: 'is_founding_member',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as getAuditLog } from '@/app/api/audit-log/route'
import { GET as exportAuditLog } from '@/app/api/audit-log/export/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    // mockReset() clears both call history AND prior mockImplementation
    // calls. mockClear() (which we used to use) only clears history, which
    // caused mockImplementation from one test to leak into the next (e.g.
    // GET tests setting mockDb.where.mockImplementation polluted Export
    // tests that didn't expect a custom where impl).
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReset()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('Audit Log (GET /api/audit-log)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
    // The audit-log route does a tier check via developers query before the
    // audit_logs queries. Use mockResolvedValueOnce so only the FIRST .limit()
    // call returns the dev tier — subsequent .limit() calls (in the entries
    // query chain) fall through to the default mockDb chain.
    mockDb.limit.mockResolvedValueOnce([{ tier: 'scale', isFoundingMember: false }])
  })

  it('returns paginated audit log entries', async () => {
    // The audit-log route does THREE queries:
    // 0. Dev tier check: db.select(...).from(developers).where().limit(1)
    //    — chains through to .limit(), handled by mockDb.limit.mockResolvedValueOnce
    //      in beforeEach above
    // 1. Count: const [countResult] = await db.select({total}).from().where(and(...))
    //    — ends at .where(), destructures array
    // 2. Entries: await db.select({...}).from().where().orderBy().limit().offset()
    //    — ends at .offset()
    // We track .where() calls; call 1 is dev tier (chain on), call 2 is count
    // (resolve array), call 3 is entries (chain on).
    let whereCallCount = 0
    mockDb.where.mockImplementation(() => {
      whereCallCount++
      if (whereCallCount === 1) {
        // Dev tier query — chain to .limit()
        return mockDb
      }
      if (whereCallCount === 2) {
        // Count query — return a thenable array-like
        return Promise.resolve([{ total: 2 }])
      }
      // Entries query — chain further
      return mockDb
    })

    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'tool.created',
        resourceType: 'tool',
        resourceId: 'tool-1',
        details: { name: 'My Tool' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-03-10T10:00:00Z'),
      },
      {
        id: 'log-2',
        action: 'key.revoked',
        resourceType: 'apiKey',
        resourceId: 'key-1',
        details: null,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-03-09T14:00:00Z'),
      },
    ])

    const response = await getAuditLog(makeRequest('/api/audit-log'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.entries).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.limit).toBe(50) // default
    expect(data.offset).toBe(0) // default
  })

  it('filters by action parameter', async () => {
    let whereCallCount = 0
    mockDb.where.mockImplementation(() => {
      whereCallCount++
      if (whereCallCount === 1) return mockDb // dev tier query
      if (whereCallCount === 2) return Promise.resolve([{ total: 1 }]) // count
      return mockDb // entries query
    })

    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'tool.created',
        resourceType: 'tool',
        resourceId: 'tool-1',
        details: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-03-10T10:00:00Z'),
      },
    ])

    const response = await getAuditLog(makeRequest('/api/audit-log?action=tool.created'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].action).toBe('tool.created')
  })

  it('filters by resourceType parameter', async () => {
    let whereCallCount = 0
    mockDb.where.mockImplementation(() => {
      whereCallCount++
      if (whereCallCount === 1) return mockDb // dev tier query
      if (whereCallCount === 2) return Promise.resolve([{ total: 1 }]) // count
      return mockDb // entries query
    })

    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'log-3',
        action: 'key.revoked',
        resourceType: 'apiKey',
        resourceId: 'key-2',
        details: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
    ])

    const response = await getAuditLog(makeRequest('/api/audit-log?resourceType=apiKey'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].resourceType).toBe('apiKey')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await getAuditLog(makeRequest('/api/audit-log'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await getAuditLog(makeRequest('/api/audit-log'))
    expect(response.status).toBe(429)
  })
})

describe('Audit Log Export (GET /api/audit-log/export)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
    // The audit-log route does a tier check via developers query before the
    // audit_logs queries. Use mockResolvedValueOnce so only the FIRST .limit()
    // call returns the dev tier — subsequent .limit() calls (in the entries
    // query chain) fall through to the default mockDb chain.
    mockDb.limit.mockResolvedValueOnce([{ tier: 'scale', isFoundingMember: false }])
  })

  it('returns CSV with header row when no entries', async () => {
    // Export route: db.select().from().where(and(...)).orderBy().limit(50000)
    // .limit() is the terminal call
    mockDb.limit.mockResolvedValueOnce([])

    const response = await exportAuditLog(makeRequest('/api/audit-log/export'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('settlegrid-audit-log')
    expect(response.headers.get('Content-Disposition')).toContain('30d.csv')

    const text = await response.text()
    expect(text).toContain('timestamp,action,resource_type,resource_id,ip_address,details')
  })

  it('returns CSV with audit entries', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'tool.created',
        resourceType: 'tool',
        resourceId: 'tool-1',
        details: { name: 'Test' },
        ipAddress: '10.0.0.1',
        userAgent: 'CLI',
        createdAt: new Date('2026-03-10T10:00:00Z'),
      },
    ])

    const response = await exportAuditLog(makeRequest('/api/audit-log/export'))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('tool.created')
    expect(text).toContain('tool')
    expect(text).toContain('10.0.0.1')
  })

  it('respects days parameter in filename', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await exportAuditLog(makeRequest('/api/audit-log/export?days=7'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('7d.csv')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await exportAuditLog(makeRequest('/api/audit-log/export'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await exportAuditLog(makeRequest('/api/audit-log/export'))
    expect(response.status).toBe(429)
  })
})

describe('writeAuditLog utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
  })

  it('does not throw on database error', async () => {
    mockDb.insert.mockReturnThis()
    mockDb.values.mockRejectedValueOnce(new Error('DB connection lost'))

    const { writeAuditLog } = await import('@/lib/audit')

    await expect(
      writeAuditLog({
        developerId: 'dev-123',
        action: 'tool.created',
        resourceType: 'tool',
        resourceId: 'tool-1',
      })
    ).resolves.toBeUndefined()
  })
})
