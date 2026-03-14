import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
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
  tools: { id: 'id', name: 'name', slug: 'slug', status: 'status', pricingConfig: 'pricing_config' },
}))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/tools/by-slug/[slug]/pricing-widget/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R15: Pricing Widget (GET /api/tools/[slug]/pricing-widget)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns pricing widget for active tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'My Tool', slug: 'my-tool', pricingConfig: { tiers: [{ name: 'Free' }, { name: 'Pro' }] } }])
    const res = await GET(makeRequest('/api/tools/my-tool/pricing-widget'), { params: Promise.resolve({ slug: 'my-tool' }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.tool.name).toBe('My Tool')
    expect(data.tiers).toHaveLength(2)
    expect(data.embedCode).toContain('iframe')
    expect(data.checkoutUrl).toContain('my-tool')
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/tools/nonexistent/pricing-widget'), { params: Promise.resolve({ slug: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns default tier when no pricing config', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Basic Tool', slug: 'basic-tool', pricingConfig: null }])
    const res = await GET(makeRequest('/api/tools/basic-tool/pricing-widget'), { params: Promise.resolve({ slug: 'basic-tool' }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.tiers).toHaveLength(1)
    expect(data.tiers[0].name).toBe('Pay Per Call')
  })

  it('returns embed code with correct slug', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test-slug', pricingConfig: null }])
    const res = await GET(makeRequest('/api/tools/test-slug/pricing-widget'), { params: Promise.resolve({ slug: 'test-slug' }) })
    const data = await res.json()
    expect(data.embedCode).toContain('test-slug')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest('/api/tools/test/pricing-widget'), { params: Promise.resolve({ slug: 'test' }) })
    expect(res.status).toBe(429)
  })

  it('includes checkout URL', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test', pricingConfig: null }])
    const res = await GET(makeRequest('/api/tools/test/pricing-widget'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    expect(data.checkoutUrl).toContain('settlegrid.com')
    expect(data.checkoutUrl).toContain('#pricing')
  })

  it('limits tiers to 10', async () => {
    const manyTiers = Array.from({ length: 15 }, (_, i) => ({ name: `Tier ${i}` }))
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test', pricingConfig: { tiers: manyTiers } }])
    const res = await GET(makeRequest('/api/tools/test/pricing-widget'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    expect(data.tiers.length).toBeLessThanOrEqual(10)
  })
})
