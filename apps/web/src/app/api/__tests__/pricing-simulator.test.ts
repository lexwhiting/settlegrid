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
  invocations: { toolId: 'tool_id', method: 'method', costCents: 'cost_cents', createdAt: 'created_at' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { POST } from '@/app/api/tools/[id]/pricing-simulator/route'

const validUuid = '00000000-0000-0000-0000-000000000001'

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R19: Pricing Simulator (POST /api/tools/[id]/pricing-simulator)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns projected revenue impact', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, developerId: 'dev-123' }])
      .mockResolvedValueOnce([
        { method: 'classify', count: 100, currentRevenueCents: 500 },
        { method: 'search', count: 50, currentRevenueCents: 250 },
      ])

    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toHaveProperty('projectedRevenue30d')
    expect(data).toHaveProperty('currentRevenue30d')
    expect(data).toHaveProperty('impactPct')
    expect(data).toHaveProperty('topAffectedMethods')
  })

  it('returns 404 when tool not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when not tool owner', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: validUuid, developerId: 'dev-other' }])
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await POST(
      makePost('/api/tools/bad-id/pricing-simulator', {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: 'bad-id' }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(429)
  })

  it('validates model field', async () => {
    // Tool lookup must succeed before parseBody is called
    mockDb.limit.mockResolvedValueOnce([{ id: validUuid, developerId: 'dev-123' }])
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'invalid_model',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(422)
  })

  it('validates prices array is non-empty', async () => {
    // Tool lookup must succeed before parseBody is called
    mockDb.limit.mockResolvedValueOnce([{ id: validUuid, developerId: 'dev-123' }])
    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    expect(res.status).toBe(422)
  })

  it('returns 0 impact when no historical data', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: validUuid, developerId: 'dev-123' }])
      .mockResolvedValueOnce([])

    const res = await POST(
      makePost(`/api/tools/${validUuid}/pricing-simulator`, {
        model: 'per_call',
        prices: [{ method: 'classify', cents: 10 }],
      }),
      { params: Promise.resolve({ id: validUuid }) }
    )
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.currentRevenue30d).toBe(0)
    expect(data.projectedRevenue30d).toBe(0)
    expect(data.impactPct).toBe(0)
  })

  it('has a maxDuration export of 30', async () => {
    const mod = await import('@/app/api/tools/[id]/pricing-simulator/route')
    expect(mod.maxDuration).toBe(30)
  })
})
