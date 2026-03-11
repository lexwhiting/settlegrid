import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
  }
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))
vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', name: 'name', developerId: 'developer_id' },
  toolHealthChecks: { id: 'id', toolId: 'tool_id', status: 'status', responseTimeMs: 'response_time_ms', checkedAt: 'checked_at' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/tools/[id]/health/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

const validUuid = '00000000-0000-0000-0000-000000000001'

describe('R16: Tool Health (GET /api/tools/[id]/health)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns public health for non-owner', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Not authenticated'))
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Test Tool', developerId: 'dev-other' }])
      .mockResolvedValueOnce([{ status: 'up', responseTimeMs: 120, checkedAt: '2026-03-10' }])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ total: 100, upCount: 95, avgResponseTimeMs: 150 }]), mockDb)
    })

    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.currentStatus).toBe('up')
    expect(data).not.toHaveProperty('incidents')
  })

  it('returns detailed health for owner', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Test Tool', developerId: 'dev-123' }])
      .mockResolvedValueOnce([{ status: 'up', responseTimeMs: 120, checkedAt: '2026-03-10' }])

    let whereCount = 0
    mockDb.where.mockImplementation(() => {
      whereCount++
      if (whereCount === 3) {
        return Object.assign(Promise.resolve([{ total: 100, upCount: 95, avgResponseTimeMs: 150 }]), mockDb)
      }
      return mockDb
    })

    mockDb.limit.mockResolvedValueOnce([
      { status: 'down', responseTimeMs: 0, checkedAt: '2026-03-09' },
    ])

    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('toolId')
    expect(data).toHaveProperty('uptimePct30d')
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await GET(makeRequest('/api/tools/bad-id/health'), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when tool not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    expect(res.status).toBe(429)
  })

  it('returns unknown status when no health checks exist', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Not authenticated'))
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'New Tool', developerId: 'dev-other' }])
      .mockResolvedValueOnce([])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ total: 0, upCount: 0, avgResponseTimeMs: 0 }]), mockDb)
    })

    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.currentStatus).toBe('unknown')
    expect(data.uptimePct30d).toBe(100)
  })

  it('has a maxDuration export of 15', async () => {
    const mod = await import('@/app/api/tools/[id]/health/route')
    expect(mod.maxDuration).toBe(15)
  })

  it('returns avgResponseTimeMs', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Not authenticated'))
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Test', developerId: 'dev-other' }])
      .mockResolvedValueOnce([{ status: 'up', responseTimeMs: 200, checkedAt: '2026-03-10' }])

    mockDb.where.mockImplementation(() => {
      return Object.assign(Promise.resolve([{ total: 50, upCount: 48, avgResponseTimeMs: 175 }]), mockDb)
    })

    const res = await GET(makeRequest(`/api/tools/${validUuid}/health`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(data).toHaveProperty('avgResponseTimeMs')
  })
})
