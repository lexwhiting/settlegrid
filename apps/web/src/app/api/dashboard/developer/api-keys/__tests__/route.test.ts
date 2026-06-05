/**
 * Tests for the publisher API-keys dashboard routes:
 *   GET / POST /api/dashboard/developer/api-keys
 *   DELETE     /api/dashboard/developer/api-keys/[id]
 *
 * Auth (requireDeveloper) is importable, so it is mocked directly rather than
 * via the db. Crypto and the response helpers (@/lib/api) run for real so
 * status codes and the sg_pub_ key format are exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockWriteAuditLog } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  mockRequireDeveloper: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  developerApiKeys: {
    id: 'id',
    developerId: 'developer_id',
    keyHash: 'key_hash',
    keyPrefix: 'key_prefix',
    label: 'label',
    status: 'status',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
    revokedAt: 'revoked_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  desc: vi.fn((a) => ({ desc: a })),
}))

vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))

vi.mock('@/lib/notifications', () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/email', () => ({
  publisherApiKeyCreatedEmail: vi.fn(() => ({ subject: 's', html: 'h' })),
  publisherApiKeyRevokedEmail: vi.fn(() => ({ subject: 's', html: 'h' })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET, POST } from '../route'
import { DELETE } from '../[id]/route'

const DEV = { id: 'dev-1', email: 'dev@example.com' }
const VALID_UUID = '11111111-1111-1111-1111-111111111111'

function listReq(): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/developer/api-keys')
}
function createReq(body: unknown = {}): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/developer/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function delReq(): NextRequest {
  return new NextRequest(`http://localhost/api/dashboard/developer/api-keys/${VALID_UUID}`, {
    method: 'DELETE',
  })
}
function ctx(id = VALID_UUID) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockReturnThis()
  mockDb.insert.mockReturnThis()
  mockDb.values.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset().mockResolvedValue([])
  mockDb.returning.mockReset().mockResolvedValue([])
  mockRequireDeveloper.mockResolvedValue(DEV)
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockWriteAuditLog.mockResolvedValue(undefined)
})

describe('GET /api/dashboard/developer/api-keys', () => {
  it('401 when unauthenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))
    const res = await GET(listReq())
    expect(res.status).toBe(401)
  })

  it('429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false })
    const res = await GET(listReq())
    expect(res.status).toBe(429)
  })

  it('returns keys and never selects the secret hash column', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'k1', keyPrefix: 'sg_pub_abcd', label: 'CI', status: 'active', lastUsedAt: null, createdAt: new Date(), revokedAt: null },
    ])
    const res = await GET(listReq())
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.keys).toHaveLength(1)
    // Load-bearing: the SELECT projection must never include the key hash.
    expect(mockDb.select).toHaveBeenCalledWith(expect.not.objectContaining({ keyHash: expect.anything() }))
  })
})

describe('POST /api/dashboard/developer/api-keys', () => {
  it('201 returns the plaintext sg_pub_ key once and writes a create audit log', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // active-key count = 0
    mockDb.returning.mockResolvedValueOnce([
      { id: 'k-new', keyPrefix: 'sg_pub_abcd', label: null, status: 'active', createdAt: new Date() },
    ])
    const res = await POST(createReq({ label: '' }))
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(typeof data.key).toBe('string')
    expect(data.key.startsWith('sg_pub_')).toBe(true)
    expect(data.apiKey.keyPrefix).toBe('sg_pub_abcd')
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'publisher_api_key.created', developerId: 'dev-1' })
    )
  })

  it('422 when the active-key cap is reached', async () => {
    mockDb.limit.mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: `k${i}` })))
    const res = await POST(createReq({ label: 'over the cap' }))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.code).toBe('MAX_KEYS_EXCEEDED')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('422 when the label exceeds 100 chars', async () => {
    const res = await POST(createReq({ label: 'x'.repeat(101) }))
    expect(res.status).toBe(422)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('401 when unauthenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required'))
    const res = await POST(createReq())
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/dashboard/developer/api-keys/[id]', () => {
  it('revokes an active key (status=revoked + revokedAt) and writes a revoke audit log', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'active', keyPrefix: 'sg_pub_abcd', label: 'CI' },
    ])
    const res = await DELETE(delReq(), ctx())
    expect(res.status).toBe(200)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }))
    expect(mockDb.set.mock.calls[0][0].revokedAt).toBeInstanceOf(Date)
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'publisher_api_key.revoked' })
    )
  })

  it('404 when the key does not exist or belongs to another developer', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await DELETE(delReq(), ctx())
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('400 when the key is already revoked', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'revoked', keyPrefix: 'sg_pub_abcd', label: null },
    ])
    const res = await DELETE(delReq(), ctx())
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.code).toBe('ALREADY_REVOKED')
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('400 on a malformed key id without touching the database', async () => {
    const res = await DELETE(delReq(), ctx('not-a-uuid'))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('401 when unauthenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required'))
    const res = await DELETE(delReq(), ctx())
    expect(res.status).toBe(401)
  })
})
