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
  inArray: vi.fn().mockImplementation((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
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
    // Developer found, no cached reputation
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, name: 'Dev Name', publicProfile: true }])
      .mockResolvedValueOnce([])

    // The route uses .where(sql).then(r => ...).catch(() => default) for aggregate queries.
    // We need .where() to return a thenable that resolves with sensible data.
    let whereCount = 0
    mockDb.where.mockImplementation(() => {
      whereCount++
      // First 2 where calls are for the developer and cache lookups (chained with .limit())
      if (whereCount <= 2) return mockDb
      // Remaining where calls are for aggregate queries using .then().catch() chains.
      // Return a real Promise that also has mockDb's methods for chaining.
      const resolved = Promise.resolve([{ count: 0, avg: 0, pct: 100, median: 0 }])
      return Object.assign(resolved, {
        // Some queries chain further methods after .where(), like .catch()
        catch: resolved.catch.bind(resolved),
        then: resolved.then.bind(resolved),
      })
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

  it('returns 404 for non-existent slug (non-UUID treated as slug lookup)', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/developers/bad-id/reputation'), { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
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
