import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    innerJoin: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
  }
  for (const key of Object.keys(mockDb)) {
    (mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }
  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', name: 'name', publicProfile: 'public_profile' },
  developerReputation: { id: 'id', developerId: 'developer_id', score: 'score', responseTimePct: 'response_time_pct', uptimePct: 'uptime_pct', reviewAvg: 'review_avg', totalTools: 'total_tools', totalConsumers: 'total_consumers', calculatedAt: 'calculated_at' },
  tools: { id: 'id', developerId: 'developer_id', status: 'status' },
  toolReviews: { toolId: 'tool_id', rating: 'rating' },
  toolHealthChecks: { toolId: 'tool_id', status: 'status', checkedAt: 'checked_at' },
  invocations: { toolId: 'tool_id', consumerId: 'consumer_id', latencyMs: 'latency_ms', createdAt: 'created_at' },
}))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/developers/[id]/reputation/route'

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

describe('R20: Developer Reputation (GET /api/developers/[id]/reputation)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns cached reputation if recent', async () => {
    const recentTime = new Date().toISOString()
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Dev Name', publicProfile: true }])
      .mockResolvedValueOnce([{
        score: 85, responseTimePct: 90, uptimePct: 99, reviewAvg: 450, totalTools: 5, totalConsumers: 50, calculatedAt: recentTime,
      }])

    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.score).toBe(85)
    expect(data.breakdown.reviewAvg).toBe(4.5)
  })

  it('computes fresh reputation when no cache', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Dev Name', publicProfile: true }])
      .mockResolvedValueOnce([])

    let whereCount = 0
    mockDb.where.mockImplementation(() => {
      whereCount++
      // toolStats
      if (whereCount === 3) return Object.assign(Promise.resolve([{ count: 3 }]), mockDb)
      // reviewStats (through innerJoin)
      if (whereCount === 4) return Object.assign(Promise.resolve([{ avg: 4.2 }]), mockDb)
      // uptimeData (through innerJoin)
      if (whereCount === 5) return Object.assign(Promise.resolve([{ total: 100, upCount: 95 }]), mockDb)
      // latencyData (through innerJoin)
      if (whereCount === 6) return Object.assign(Promise.resolve([{ medianMs: 150 }]), mockDb)
      // consumerStats
      if (whereCount === 7) return Object.assign(Promise.resolve([{ count: 25 }]), mockDb)
      return mockDb
    })

    // insert call (store computed score) — values().onConflictDoUpdate() chain
    mockDb.onConflictDoUpdate.mockResolvedValueOnce(undefined)

    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('score')
    expect(data).toHaveProperty('breakdown')
    expect(data).toHaveProperty('calculatedAt')
  })

  it('returns 404 when developer not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await GET(makeRequest('/api/developers/bad-id/reputation'), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    expect(res.status).toBe(429)
  })

  it('score is between 0 and 100', async () => {
    const recentTime = new Date().toISOString()
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Dev Name', publicProfile: true }])
      .mockResolvedValueOnce([{
        score: 42, responseTimePct: 60, uptimePct: 80, reviewAvg: 300, totalTools: 2, totalConsumers: 10, calculatedAt: recentTime,
      }])

    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(data.score).toBeGreaterThanOrEqual(0)
    expect(data.score).toBeLessThanOrEqual(100)
  })

  it('returns developer name in response', async () => {
    const recentTime = new Date().toISOString()
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'John Dev', publicProfile: true }])
      .mockResolvedValueOnce([{
        score: 75, responseTimePct: 80, uptimePct: 95, reviewAvg: 400, totalTools: 3, totalConsumers: 20, calculatedAt: recentTime,
      }])

    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(data.name).toBe('John Dev')
  })

  it('breakdown contains all expected fields', async () => {
    const recentTime = new Date().toISOString()
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Dev', publicProfile: true }])
      .mockResolvedValueOnce([{
        score: 50, responseTimePct: 50, uptimePct: 50, reviewAvg: 250, totalTools: 1, totalConsumers: 5, calculatedAt: recentTime,
      }])

    const res = await GET(makeRequest(`/api/developers/${validUuid}/reputation`), { params: Promise.resolve({ id: validUuid }) })
    const data = await res.json()
    expect(data.breakdown).toHaveProperty('responseTimePct')
    expect(data.breakdown).toHaveProperty('uptimePct')
    expect(data.breakdown).toHaveProperty('reviewAvg')
    expect(data.breakdown).toHaveProperty('totalTools')
    expect(data.breakdown).toHaveProperty('totalConsumers')
  })
})
