/**
 * Tests for PUT /api/tools/publish (API-key publish path).
 *
 * Core coverage is the producer-audit #8 fix: the route must gate `status='active'`
 * behind validateToolForActivation (same checks the dashboard PATCH enforces), and
 * the post-fix regression-guard: a failed gate must NOT demote an already-active
 * tool to 'draft' — the earlier two-phase write did exactly that, surprising
 * developers who expected a failed update to leave their live listing untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockValidate } = vi.hoisted(() => {
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
    // The new publish-auth path fires a non-awaited lastUsedAt update:
    //   db.update(...).set(...).where(...).then().catch()
    then: vi.fn((resolve?: () => void) => { resolve?.(); return mockDb }),
    catch: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockValidate: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    developerId: 'developer_id',
    slug: 'slug',
    name: 'name',
    description: 'description',
    pricingConfig: 'pricing_config',
    category: 'category',
    tags: 'tags',
    currentVersion: 'current_version',
    healthEndpoint: 'health_endpoint',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  developers: {
    id: 'id',
    email: 'email',
  },
  developerApiKeys: {
    id: 'id',
    developerId: 'developer_id',
    keyHash: 'key_hash',
    status: 'status',
    lastUsedAt: 'last_used_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ field: a, value: b })),
  inArray: vi.fn().mockImplementation((col, vals) => ({ inArray: [col, vals] })),
  and: vi.fn().mockImplementation((...args) => ({ and: args })),
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/quality-gates', () => ({
  validateToolForActivation: mockValidate,
}))

vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn().mockReturnValue('req-test'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { PUT } from '../route'
import { checkRateLimit } from '@/lib/rate-limit'

const VALID_BODY = {
  name: 'My Tool',
  slug: 'my-tool',
  description: 'A very valid description that exceeds the minimum length threshold.',
  pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
  category: 'data',
  tags: ['example'],
  version: '1.0.0',
}

function makeRequest(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/tools/publish', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      // Publisher keys carry the sg_pub_ prefix; the route fast-fails any
      // other prefix before hashing (register #4). Use a valid publisher
      // key so the mocked auth join is what gates these tests.
      'x-api-key': 'sg_pub_testkeyplaceholder123456789012',
    },
    body: JSON.stringify(body),
  })
}

/**
 * The route's `authenticateDeveloperByApiKey` helper is defined in the
 * same file (not importable to mock directly). It issues a SELECT joining
 * developer_api_keys → developers (status='active'); we satisfy it by making
 * the first mockDb.limit call resolve to a row carrying the developer
 * id/email plus the matched keyId. Each test is responsible for its
 * subsequent mockDb.limit mocks.
 */
function mockAuth(): void {
  mockDb.limit.mockResolvedValueOnce([{ id: 'dev-123', email: 'dev@example.com', keyId: 'key-123' }])
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.insert.mockReturnThis()
  mockDb.values.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset()
  mockDb.returning.mockReset()
  mockValidate.mockResolvedValue({ passed: true, failures: [] })
})

describe('PUT /api/tools/publish — producer-audit #8 quality gate', () => {
  it('CREATE: flips a new tool to status="active" when the gate passes', async () => {
    mockAuth()
    mockDb.limit.mockResolvedValueOnce([]) // no existing tool
    mockDb.returning.mockResolvedValueOnce([
      { id: 'tool-new', slug: 'my-tool', name: 'My Tool', status: 'draft', currentVersion: '1.0.0', createdAt: new Date(), updatedAt: new Date() },
    ])
    // Gate flip → active
    mockDb.returning.mockResolvedValueOnce([{ status: 'active', updatedAt: new Date() }])
    mockValidate.mockResolvedValueOnce({ passed: true, failures: [] })

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.tool.status).toBe('active')
    expect(mockValidate).toHaveBeenCalledWith('tool-new', 'dev-123')
  })

  it('CREATE: stays at status="draft" and returns 422 when the gate fails', async () => {
    mockAuth()
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.returning.mockResolvedValueOnce([
      { id: 'tool-new-bad', slug: 'my-tool', name: 'My Tool', status: 'draft', currentVersion: '1.0.0', createdAt: new Date(), updatedAt: new Date() },
    ])
    mockValidate.mockResolvedValueOnce({
      passed: false,
      failures: ['Description must be at least 50 characters'],
    })

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.code).toBe('QUALITY_GATE_FAILED')
    expect(data.currentStatus).toBe('draft')
    expect(data.failures).toContain('Description must be at least 50 characters')
  })
})

describe('PUT /api/tools/publish — regression guard: UPDATE preserves existing status on gate failure', () => {
  it('an already-active tool that fails the gate stays ACTIVE (post-fix: no demote)', async () => {
    mockAuth()
    // Existing tool is currently live in the marketplace.
    mockDb.limit.mockResolvedValueOnce([
      { id: 'tool-live', developerId: 'dev-123', name: 'Live Tool', status: 'active' },
    ])
    // The initial write preserves status='active' per the regression fix.
    mockDb.returning.mockResolvedValueOnce([
      { id: 'tool-live', slug: 'my-tool', name: 'Live Tool', status: 'active', currentVersion: '1.0.0', createdAt: new Date(), updatedAt: new Date() },
    ])
    // Gate fails on the new body.
    mockValidate.mockResolvedValueOnce({
      passed: false,
      failures: ['Pricing must be configured'],
    })

    const res = await PUT(makeRequest({
      ...VALID_BODY,
      pricingConfig: { model: 'per-invocation', defaultCostCents: 0 },
    }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.code).toBe('QUALITY_GATE_FAILED')
    // The load-bearing assertion: currentStatus reflects the preserved
    // existing status, not a 'draft' demotion. If this flips to 'draft'
    // the regression is back.
    expect(data.currentStatus).toBe('active')
  })

  it('an existing draft tool that fails the gate stays DRAFT (status unchanged)', async () => {
    mockAuth()
    mockDb.limit.mockResolvedValueOnce([
      { id: 'tool-draft', developerId: 'dev-123', name: 'Draft Tool', status: 'draft' },
    ])
    mockDb.returning.mockResolvedValueOnce([
      { id: 'tool-draft', slug: 'my-tool', name: 'Draft Tool', status: 'draft', currentVersion: '1.0.0', createdAt: new Date(), updatedAt: new Date() },
    ])
    // Send a valid body so Zod parsing succeeds; force the gate to fail
    // via the mock so we exercise the status-preservation branch cleanly.
    mockValidate.mockResolvedValueOnce({ passed: false, failures: ['Pricing required'] })

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.code).toBe('QUALITY_GATE_FAILED')
    expect(data.currentStatus).toBe('draft')
  })

  it('UPDATE: passes the gate → flips to active (the common successful re-publish path)', async () => {
    mockAuth()
    mockDb.limit.mockResolvedValueOnce([
      { id: 'tool-u', developerId: 'dev-123', name: 'T', status: 'draft' },
    ])
    mockDb.returning.mockResolvedValueOnce([
      { id: 'tool-u', slug: 'my-tool', name: 'T', status: 'draft', currentVersion: '1.0.0', createdAt: new Date(), updatedAt: new Date() },
    ])
    // The activate flip:
    mockDb.returning.mockResolvedValueOnce([{ status: 'active', updatedAt: new Date() }])
    mockValidate.mockResolvedValueOnce({ passed: true, failures: [] })

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tool.status).toBe('active')
  })

  it('UPDATE: rejects with 409 when a different developer owns the slug', async () => {
    mockAuth()
    mockDb.limit.mockResolvedValueOnce([
      { id: 'tool-other', developerId: 'dev-someone-else', name: 'Other', status: 'active' },
    ])

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.code).toBe('SLUG_CONFLICT')
    expect(mockValidate).not.toHaveBeenCalled()
  })
})

describe('PUT /api/tools/publish — auth via developer_api_keys', () => {
  it('rejects a revoked or unknown key with 401 (auth matches active keys only)', async () => {
    // The auth join (developer_api_keys status=active ⨝ developers) returns no
    // row — i.e. the key is revoked or unknown. Must fail closed with 401 and
    // never reach the publish / quality-gate logic.
    mockDb.limit.mockResolvedValueOnce([])

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
    expect(mockValidate).not.toHaveBeenCalled()
  })
})

describe('PUT /api/tools/publish — sg_pub_ prefix fast-fail (register #4)', () => {
  it('fast-fails a 16+ char non-sg_pub_ key with a byte-identical 401 and NO db query', async () => {
    // A long-enough but wrong-prefix key (e.g. a consumer sg_live_ key). The
    // route must short-circuit BEFORE hashing/DB — proving the fast-fail — yet
    // return the SAME 401 body as the hash-miss path (client-invisible parity).
    const req = new NextRequest('http://localhost/api/tools/publish', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sg_live_testkeyplaceholder123456789012',
      },
      body: JSON.stringify(VALID_BODY),
    })

    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
    expect(data.error).toBe('Invalid API key.') // identical to the hash-miss message
    // Load-bearing fail-pre-fix assertion: the DB is never touched for a
    // non-prefixed key. Pre-fix this would query the auth join.
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('an sg_pub_ key passes the prefix gate and reaches the auth db lookup (gate is not over-eager)', async () => {
    // Positive companion: a correctly-prefixed key must still hit the hash
    // lookup. Auth join returns no row → 401, but the SELECT WAS issued.
    mockDb.limit.mockResolvedValueOnce([])

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
    expect(mockDb.select).toHaveBeenCalled()
  })
})

describe('PUT /api/tools/publish — per-user (uid) rate limit', () => {
  it('returns 429 keyed on the API-key developer id when the uid limit trips', async () => {
    mockAuth()
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({ success: true, limit: 100, remaining: 99, reset: 0 })
      .mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })

    const res = await PUT(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(vi.mocked(checkRateLimit)).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'tools-publish:uid:dev-123'
    )
    expect(mockValidate).not.toHaveBeenCalled()
  })
})
