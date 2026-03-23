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
  tools: { id: 'id', developerId: 'developer_id' },
  conversionEvents: { toolId: 'tool_id', consumerId: 'consumer_id', event: 'event', fromTier: 'from_tier', toTier: 'to_tier', metadata: 'metadata', createdAt: 'created_at' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  inArray: vi.fn().mockImplementation((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/dashboard/developer/stats/funnel/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R12: Funnel (GET /api/dashboard/developer/stats/funnel)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns empty funnel when developer has no tools', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.funnelSummary).toEqual({ totalTrials: 0, totalUpgrades: 0, totalDowngrades: 0, totalChurns: 0 })
  })

  it('returns funnel data when tools exist', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])
      .mockResolvedValueOnce([{ event: 'upgrade', count: 5, uniqueConsumers: 3 }])
      .mockResolvedValueOnce([{ fromTier: 'free', toTier: 'pro', count: 5 }])
      .mockResolvedValueOnce([])

    let whereCount = 0
    mockDb.where.mockImplementation(() => {
      whereCount++
      if (whereCount === 5) {
        return Object.assign(Promise.resolve([{ totalTrials: 10, totalUpgrades: 5, totalDowngrades: 1, totalChurns: 2 }]), mockDb)
      }
      return mockDb
    })

    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('conversionRates')
    expect(data).toHaveProperty('upgradeTriggers')
    expect(data).toHaveProperty('churnSignals')
    expect(data).toHaveProperty('funnelSummary')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    expect(res.status).toBe(429)
  })

  it('response has correct empty shape', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    const data = await res.json()
    expect(Array.isArray(data.conversionRates)).toBe(true)
    expect(Array.isArray(data.upgradeTriggers)).toBe(true)
    expect(Array.isArray(data.churnSignals)).toBe(true)
    expect(typeof data.funnelSummary).toBe('object')
  })

  it('limits tool query to 500', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    expect(mockDb.limit).toHaveBeenCalledWith(500)
  })

  it('returns conversion rates grouped by event type', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/dashboard/developer/stats/funnel'))
    const data = await res.json()
    expect(data.conversionRates).toEqual([])
  })
})
