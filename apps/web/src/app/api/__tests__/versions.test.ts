import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  }

  return {
    mockDb,
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
    currentVersion: 'current_version',
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

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn().mockReturnValue('test-request-id-versions'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
}))

import { GET } from '@/app/api/tools/[id]/versions/route'

const toolUuid = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

describe('Tool Version History (GET /api/tools/[id]/versions)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns version history for existing tool', async () => {
    // Q1: tool lookup
    mockDb.limit
      .mockResolvedValueOnce([{ id: toolUuid, currentVersion: '2.1.0' }])
      // Q2: changelog entries
      .mockResolvedValueOnce([
        {
          id: 'cl-3',
          version: '2.1.0',
          changeType: 'minor',
          summary: 'Added search',
          details: null,
          createdAt: new Date('2026-03-10').toISOString(),
        },
        {
          id: 'cl-2',
          version: '2.0.0',
          changeType: 'major',
          summary: 'Breaking API change',
          details: { breaking: true },
          createdAt: new Date('2026-03-01').toISOString(),
        },
        {
          id: 'cl-1',
          version: '1.0.0',
          changeType: 'major',
          summary: 'Initial release',
          details: null,
          createdAt: new Date('2026-02-01').toISOString(),
        },
      ])

    const response = await GET(makeRequest(`/api/tools/${toolUuid}/versions`), makeParams(toolUuid))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.currentVersion).toBe('2.1.0')
    expect(data.versions).toHaveLength(3)
    expect(data.versions[0].version).toBe('2.1.0')
    expect(data.versions[2].version).toBe('1.0.0')
    expect(response.headers.get('x-request-id')).toBe('test-request-id-versions')
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // tool not found

    const response = await GET(makeRequest(`/api/tools/${toolUuid}/versions`), makeParams(toolUuid))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns empty versions for tool with no changelog', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: toolUuid, currentVersion: '1.0.0' }]) // tool exists
      .mockResolvedValueOnce([]) // no changelog entries

    const response = await GET(makeRequest(`/api/tools/${toolUuid}/versions`), makeParams(toolUuid))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.currentVersion).toBe('1.0.0')
    expect(data.versions).toHaveLength(0)
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await GET(
      makeRequest('/api/tools/not-a-uuid/versions'),
      makeParams('not-a-uuid')
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_ID')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await GET(makeRequest(`/api/tools/${toolUuid}/versions`), makeParams(toolUuid))
    expect(response.status).toBe(429)
  })

  it('includes details field in version entries', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: toolUuid, currentVersion: '1.1.0' }])
      .mockResolvedValueOnce([
        {
          id: 'cl-1',
          version: '1.1.0',
          changeType: 'minor',
          summary: 'Added batch endpoint',
          details: { endpoints: ['/batch'] },
          createdAt: new Date('2026-03-05').toISOString(),
        },
      ])

    const response = await GET(makeRequest(`/api/tools/${toolUuid}/versions`), makeParams(toolUuid))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.versions[0].details).toEqual({ endpoints: ['/batch'] })
  })
})
