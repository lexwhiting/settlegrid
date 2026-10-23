/**
 * Tests for /api/developer/tools/[id]/endpoint — the route the dashboard uses
 * to set, read and clear a tool's upstream (proxy) URL. URL validation is the
 * real isPublicUrlString from lib/safe-egress.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-1', email: 'dev@example.com' }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    slug: 'slug',
    developerId: 'developer_id',
    proxyEndpoint: 'proxy_endpoint',
    updatedAt: 'updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  getClientIp: () => '203.0.113.7',
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/request-id', () => ({ getOrCreateRequestId: vi.fn().mockReturnValue('req-test') }))

import { PUT, GET, DELETE } from '../route'

const TOOL_ID = '550e8400-e29b-41d4-a716-446655440010'
const params = { params: Promise.resolve({ id: TOOL_ID }) }

function put(endpointUrl: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/developer/tools/${TOOL_ID}/endpoint`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointUrl }),
  })
}

function req(method: string): NextRequest {
  return new NextRequest(`http://localhost/api/developer/tools/${TOOL_ID}/endpoint`, { method })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset()
  mockDb.returning.mockReset()
})

describe('PUT /api/developer/tools/[id]/endpoint', () => {
  it('saves a public https URL', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: TOOL_ID, slug: 'my-tool' }])
    mockDb.returning.mockResolvedValueOnce([
      { id: TOOL_ID, slug: 'my-tool', proxyEndpoint: 'https://api.example.com/v1', updatedAt: new Date() },
    ])

    const res = await PUT(put('https://api.example.com/v1'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ proxyEndpoint: 'https://api.example.com/v1' })
    )
    expect(data.tool.proxyUrl).toBe('https://settlegrid.ai/api/proxy/my-tool')
  })

  it.each([
    ['http://api.example.com/v1'],
    ['https://127.0.0.1/hook'],
    ['https://10.0.0.5/'],
    ['https://localhost:8080/'],
    ['https://service.internal/'],
    ['not a url'],
  ])('rejects %s with 422 and writes nothing', async (url) => {
    const res = await PUT(put(url), params)

    expect(res.status).toBe(422)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the tool does not belong to the developer', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const res = await PUT(put('https://api.example.com/v1'), params)

    expect(res.status).toBe(404)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('returns 401 without a session', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))

    const res = await PUT(put('https://api.example.com/v1'), params)

    expect(res.status).toBe(401)
  })

  it('returns 400 for a malformed tool id', async () => {
    const res = await PUT(put('https://api.example.com/v1'), { params: Promise.resolve({ id: 'nope' }) })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/developer/tools/[id]/endpoint', () => {
  it('returns a null proxyUrl when no endpoint is set', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: TOOL_ID, slug: 'my-tool', proxyEndpoint: null, updatedAt: new Date() },
    ])

    const res = await GET(req('GET'), params)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tool.proxyUrl).toBeNull()
  })
})

describe('DELETE /api/developer/tools/[id]/endpoint', () => {
  it('clears the endpoint for the owner', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: TOOL_ID }])
    mockDb.where.mockReturnValueOnce(mockDb).mockResolvedValueOnce(undefined)

    const res = await DELETE(req('DELETE'), params)

    expect(res.status).toBe(200)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ proxyEndpoint: null }))
  })
})
