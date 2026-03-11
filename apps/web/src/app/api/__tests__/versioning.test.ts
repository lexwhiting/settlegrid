import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
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
  tools: {
    id: 'id',
    developerId: 'developer_id',
    currentVersion: 'current_version',
    updatedAt: 'updated_at',
  },
  toolChangelogs: {
    id: 'id',
    toolId: 'tool_id',
    version: 'version',
    changeType: 'change_type',
    summary: 'summary',
    details: 'details',
    createdAt: 'created_at',
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
}))

import { POST as createVersion } from '@/app/api/tools/[id]/version/route'
import { GET as getChangelog } from '@/app/api/tools/[id]/changelog/route'

const toolUuid = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
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

describe('Create Version (POST /api/tools/[id]/version)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('bumps patch version (1.0.0 -> 1.0.1)', async () => {
    // POST chains:
    // Q1: select.from(tools).where(and(...)).limit(1) — where#1 chains to limit
    // Q2: insert(changelogs).values().returning()     — returns changelog
    // Q3: update(tools).set().where()                 — where#2 is terminal
    mockDb.where
      .mockReturnValueOnce(mockDb)          // Q1: chains to .limit
      .mockResolvedValueOnce(undefined)     // Q3: update terminal (void)

    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid, currentVersion: '1.0.0' }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'cl-1',
      version: '1.0.1',
      changeType: 'patch',
      summary: 'Bug fix',
      details: null,
      createdAt: new Date().toISOString(),
    }])

    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'patch',
        summary: 'Bug fix',
      }),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.version).toBe('1.0.1')
    expect(data.changelog.changeType).toBe('patch')
    expect(data.changelog.summary).toBe('Bug fix')
  })

  it('bumps minor version (1.0.0 -> 1.1.0)', async () => {
    mockDb.where
      .mockReturnValueOnce(mockDb)
      .mockResolvedValueOnce(undefined)

    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid, currentVersion: '1.0.0' }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'cl-2',
      version: '1.1.0',
      changeType: 'minor',
      summary: 'New feature added',
      details: null,
      createdAt: new Date().toISOString(),
    }])

    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'minor',
        summary: 'New feature added',
      }),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.version).toBe('1.1.0')
    expect(data.changelog.changeType).toBe('minor')
  })

  it('bumps major version (1.0.0 -> 2.0.0)', async () => {
    mockDb.where
      .mockReturnValueOnce(mockDb)
      .mockResolvedValueOnce(undefined)

    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid, currentVersion: '1.0.0' }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'cl-3',
      version: '2.0.0',
      changeType: 'major',
      summary: 'Breaking API change',
      details: { breaking: true },
      createdAt: new Date().toISOString(),
    }])

    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'major',
        summary: 'Breaking API change',
        details: { breaking: true },
      }),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.version).toBe('2.0.0')
    expect(data.changelog.changeType).toBe('major')
  })

  it('requires auth and tool ownership (401)', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'patch',
        summary: 'Fix',
      }),
      makeParams(toolUuid)
    )

    expect(response.status).toBe(401)
  })

  it('returns 404 when tool not found or not owned', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // tool not found for this developer

    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'patch',
        summary: 'Fix',
      }),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('validates changeType enum', async () => {
    const response = await createVersion(
      makeRequest(`/api/tools/${toolUuid}/version`, 'POST', {
        changeType: 'invalid',
        summary: 'Something',
      }),
      makeParams(toolUuid)
    )

    expect(response.status).toBe(422)
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await createVersion(
      makeRequest('/api/tools/not-a-uuid/version', 'POST', {
        changeType: 'patch',
        summary: 'Fix',
      }),
      makeParams('not-a-uuid')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })
})

describe('Get Changelog (GET /api/tools/[id]/changelog)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns changelog entries', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'cl-1',
        version: '1.1.0',
        changeType: 'minor',
        summary: 'Added search feature',
        details: null,
        createdAt: new Date('2026-03-10').toISOString(),
      },
      {
        id: 'cl-2',
        version: '1.0.0',
        changeType: 'major',
        summary: 'Initial release',
        details: null,
        createdAt: new Date('2026-03-01').toISOString(),
      },
    ])

    const response = await getChangelog(
      makeRequest(`/api/tools/${toolUuid}/changelog`),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.changelogs).toHaveLength(2)
    expect(data.changelogs[0].version).toBe('1.1.0')
    expect(data.changelogs[1].version).toBe('1.0.0')
  })

  it('returns empty changelog for new tool', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const response = await getChangelog(
      makeRequest(`/api/tools/${toolUuid}/changelog`),
      makeParams(toolUuid)
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.changelogs).toHaveLength(0)
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await getChangelog(
      makeRequest('/api/tools/bad-id/changelog'),
      makeParams('bad-id')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })
})
