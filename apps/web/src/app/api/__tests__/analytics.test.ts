import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    groupBy: vi.fn(),
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
  tools: {
    id: 'id',
    developerId: 'developer_id',
    name: 'name',
    slug: 'slug',
    status: 'status',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    method: 'method',
    costCents: 'cost_cents',
    latencyMs: 'latency_ms',
    status: 'status',
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
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  inArray: vi.fn().mockImplementation((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/dashboard/developer/stats/analytics/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('Developer Analytics (GET /api/dashboard/developer/stats/analytics)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns empty analytics when developer has no tools', async () => {
    // developerTools query ends with .limit(500)
    mockDb.limit.mockResolvedValueOnce([]) // no tools

    const response = await GET(makeRequest('/api/dashboard/developer/stats/analytics'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.methodBreakdown).toEqual([])
    expect(data.topConsumers).toEqual([])
    expect(data.hourlyDistribution).toEqual([])
    expect(data.latencyPercentiles).toEqual({ p50: 0, p95: 0, p99: 0 })
    expect(data.errorRate).toBe(0)
    expect(data.revenueTrend).toEqual([])
  })

  it('returns analytics with all 6 sections when tools exist', async () => {
    // Query 1: developerTools — .limit(500)
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])    // developer tools
      .mockResolvedValueOnce([                        // method breakdown (ends with .limit(50))
        { method: 'classify', count: 100, totalRevenueCents: 500, avgLatencyMs: 150, errorRate: 2.5 },
      ])
      .mockResolvedValueOnce([                        // top consumers (ends with .limit(10))
        { consumerId: 'con-1', totalSpendCents: 350, invocationCount: 70 },
      ])
      .mockResolvedValueOnce([                        // hourly distribution (ends with .limit(24))
        { hour: 9, count: 25 },
      ])

    // Queries 5 & 6 (percentiles, errorStats) end with .where() — no .limit()
    // They use array destructuring: const [percentiles] = await db.select().from().where()
    // .where() currently returns mockDb (not an array). We need it to resolve to arrays.
    let whereCallCount = 0
    mockDb.where.mockImplementation(() => {
      whereCallCount++
      // Calls 1-4 are from queries that chain further (.groupBy/.limit)
      // Call 5 = percentiles query (query ends at .where)
      // Call 6 = errorStats query (query ends at .where)
      if (whereCallCount === 5) {
        const result = [{ p50: 120, p95: 350, p99: 500 }]
        // Must also be chainable for further .groupBy if needed,
        // but percentiles query stops here
        return Object.assign(Promise.resolve(result), {
          select: mockDb.select,
          from: mockDb.from,
          where: mockDb.where,
          groupBy: mockDb.groupBy,
          orderBy: mockDb.orderBy,
          limit: mockDb.limit,
        })
      }
      if (whereCallCount === 6) {
        const result = [{ total: 100, errors: 5 }]
        return Object.assign(Promise.resolve(result), {
          select: mockDb.select,
          from: mockDb.from,
          where: mockDb.where,
          groupBy: mockDb.groupBy,
          orderBy: mockDb.orderBy,
          limit: mockDb.limit,
        })
      }
      return mockDb
    })

    // Query 7: revenueTrend — ends with .limit(30)
    mockDb.limit.mockResolvedValueOnce([
      { date: '2026-03-01', revenueCents: 150 },
    ])

    const response = await GET(makeRequest('/api/dashboard/developer/stats/analytics'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('methodBreakdown')
    expect(data).toHaveProperty('topConsumers')
    expect(data).toHaveProperty('hourlyDistribution')
    expect(data).toHaveProperty('latencyPercentiles')
    expect(data.latencyPercentiles).toEqual({ p50: 120, p95: 350, p99: 500 })
    expect(data).toHaveProperty('errorRate')
    expect(data.errorRate).toBe(5) // 5/100 * 100 = 5%
    expect(data).toHaveProperty('revenueTrend')
  })

  it('returns correct empty defaults structure shape', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no tools

    const response = await GET(makeRequest('/api/dashboard/developer/stats/analytics'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.methodBreakdown)).toBe(true)
    expect(Array.isArray(data.topConsumers)).toBe(true)
    expect(Array.isArray(data.hourlyDistribution)).toBe(true)
    expect(typeof data.latencyPercentiles).toBe('object')
    expect(typeof data.errorRate).toBe('number')
    expect(Array.isArray(data.revenueTrend)).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await GET(makeRequest('/api/dashboard/developer/stats/analytics'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await GET(makeRequest('/api/dashboard/developer/stats/analytics'))
    expect(response.status).toBe(429)
  })
})
