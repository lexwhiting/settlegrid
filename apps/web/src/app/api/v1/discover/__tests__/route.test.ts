/**
 * GET /api/v1/discover must use the canonical marketplace inclusion predicate
 * (lib/marketplace-visibility.ts) so the public API and the marketplace UI
 * agree on which tools are discoverable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, INCLUSION, mockAnd } = vi.hoisted(() => {
  const INCLUSION = { marketplaceInclusion: true }
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn(),
  }
  return {
    mockDb,
    INCLUSION,
    mockAnd: vi.fn((...args: unknown[]) => ({ and: args })),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id', name: 'name', slug: 'slug', description: 'description', category: 'category',
    tags: 'tags', status: 'status', currentVersion: 'current_version', pricingConfig: 'pricing_config',
    totalInvocations: 'total_invocations', verified: 'verified', developerId: 'developer_id',
    createdAt: 'created_at', listedInMarketplace: 'listed_in_marketplace',
  },
  developers: { id: 'id', name: 'name', slug: 'slug' },
  toolReviews: { rating: 'rating', toolId: 'tool_id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: mockAnd,
  or: vi.fn((...args: unknown[]) => ({ or: args })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  asc: vi.fn((a: unknown) => ({ asc: a })),
  ilike: vi.fn((a: unknown, b: unknown) => ({ ilike: [a, b] })),
  sql: vi.fn(() => ({ sql: true })),
}))
vi.mock('@/lib/marketplace-visibility', () => ({
  marketplaceInclusionSql: vi.fn(() => INCLUSION),
}))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  getClientIp: () => '203.0.113.5',
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { GET } from '../route'
import { marketplaceInclusionSql } from '@/lib/marketplace-visibility'

beforeEach(() => {
  vi.clearAllMocks()
  // First where() belongs to the results query (chained), second to the count query.
  mockDb.where.mockReturnValueOnce(mockDb).mockResolvedValueOnce([{ count: 0 }])
  mockDb.offset.mockResolvedValueOnce([])
})

describe('GET /api/v1/discover', () => {
  it('filters with the canonical marketplace inclusion predicate', async () => {
    const res = await GET(new NextRequest('http://localhost/api/v1/discover'))

    expect(res.status).toBe(200)
    expect(marketplaceInclusionSql).toHaveBeenCalled()
    expect(mockAnd).toHaveBeenCalledWith(INCLUSION)
  })

  it('keeps the predicate first when other filters are added', async () => {
    await GET(new NextRequest('http://localhost/api/v1/discover?category=data'))

    expect(mockAnd.mock.calls[0][0]).toBe(INCLUSION)
    expect(mockAnd.mock.calls[0]).toHaveLength(2)
  })
})
