import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
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
  developers: {
    id: 'id',
    name: 'name',
    publicBio: 'public_bio',
    avatarUrl: 'avatar_url',
    publicProfile: 'public_profile',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  tools: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    category: 'category',
    totalInvocations: 'total_invocations',
    developerId: 'developer_id',
    status: 'status',
  },
  toolReviews: {
    id: 'id',
    toolId: 'tool_id',
    rating: 'rating',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    latencyMs: 'latency_ms',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn().mockReturnValue('test-request-id-123'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  count: vi.fn().mockImplementation((col: unknown) => ({ count: col })),
  inArray: vi.fn().mockImplementation((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as getPublicProfile } from '@/app/api/developers/[id]/profile/route'
import { PATCH as updateProfile } from '@/app/api/dashboard/developer/profile/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

function makeIdParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

const devUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('Public Developer Profile (GET /api/developers/[id]/profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns public profile with tools and aggregate stats', async () => {
    // Three queries, each ending with .limit():
    // Q1: developer record
    // Q2: active tools list
    // Q3: aggregate stats
    mockDb.limit
      .mockResolvedValueOnce([{
        id: devUuid,
        name: 'Jane Dev',
        publicBio: 'Building cool tools',
        avatarUrl: 'https://example.com/avatar.png',
        publicProfile: true,
        createdAt: new Date('2026-01-15').toISOString(),
      }])
      .mockResolvedValueOnce([
        {
          id: 'tool-abc',
          name: 'My Tool',
          slug: 'my-tool',
          category: 'nlp',
          totalInvocations: 200,
          averageRating: 4.5,
        },
      ])
      .mockResolvedValueOnce([{
        totalInvocations: 500,
        avgResponseTimeMs: 120.5,
      }])

    const response = await getPublicProfile(
      makeRequest(`/api/developers/${devUuid}/profile`),
      makeIdParams(devUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('Jane Dev')
    expect(data.bio).toBe('Building cool tools')
    expect(data.stats.toolCount).toBe(1)
    expect(data.stats.totalInvocations).toBe(500)
    expect(data.stats.avgResponseTimeMs).toBe(120.5)
    expect(data.tools).toHaveLength(1)
    expect(data.tools[0].name).toBe('My Tool')
    expect(response.headers.get('x-request-id')).toBe('test-request-id-123')
  })

  it('returns 404 for private profile', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: devUuid,
      name: 'Hidden Dev',
      publicBio: null,
      avatarUrl: null,
      publicProfile: false,
      createdAt: new Date().toISOString(),
    }])

    const response = await getPublicProfile(
      makeRequest(`/api/developers/${devUuid}/profile`),
      makeIdParams(devUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 404 for non-existent developer', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await getPublicProfile(
      makeRequest(`/api/developers/${devUuid}/profile`),
      makeIdParams(devUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 404 for non-existent slug (non-UUID treated as slug lookup)', async () => {
    const response = await getPublicProfile(
      makeRequest('/api/developers/not-a-uuid/profile'),
      makeIdParams('not-a-uuid')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await getPublicProfile(
      makeRequest(`/api/developers/${devUuid}/profile`),
      makeIdParams(devUuid)
    )
    expect(response.status).toBe(429)
  })

  it('returns zero stats when developer has no tools', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: devUuid,
        name: 'New Dev',
        publicBio: 'Just starting out',
        avatarUrl: null,
        publicProfile: true,
        createdAt: new Date('2026-03-01').toISOString(),
      }])
      .mockResolvedValueOnce([]) // no active tools — aggregate stats skipped

    const response = await getPublicProfile(
      makeRequest(`/api/developers/${devUuid}/profile`),
      makeIdParams(devUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.stats.toolCount).toBe(0)
    expect(data.stats.totalInvocations).toBe(0)
    expect(data.stats.avgResponseTimeMs).toBe(0)
  })
})

describe('Update Developer Profile (PATCH /api/dashboard/developer/profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('updates profile fields', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      publicProfile: true,
      publicBio: 'Updated bio here',
      avatarUrl: 'https://example.com/new-avatar.png',
      updatedAt: new Date().toISOString(),
    }])

    const response = await updateProfile(
      makeRequest('/api/dashboard/developer/profile', 'PATCH', {
        publicProfile: true,
        publicBio: 'Updated bio here',
        avatarUrl: 'https://example.com/new-avatar.png',
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profile.publicProfile).toBe(true)
    expect(data.profile.publicBio).toBe('Updated bio here')
    expect(data.profile.avatarUrl).toBe('https://example.com/new-avatar.png')
  })

  it('validates bio length (max 500 chars)', async () => {
    const longBio = 'x'.repeat(501)

    const response = await updateProfile(
      makeRequest('/api/dashboard/developer/profile', 'PATCH', {
        publicBio: longBio,
      })
    )

    expect(response.status).toBe(422)
  })

  it('requires auth (401)', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await updateProfile(
      makeRequest('/api/dashboard/developer/profile', 'PATCH', {
        publicProfile: true,
      })
    )

    expect(response.status).toBe(401)
  })
})
