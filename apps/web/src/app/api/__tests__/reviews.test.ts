import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'consumer-123', email: 'user@example.com' }),
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
    slug: 'slug',
    status: 'status',
  },
  toolReviews: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    rating: 'rating',
    comment: 'comment',
    createdAt: 'created_at',
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET, POST } from '@/app/api/tools/[slug]/reviews/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

function makeParams(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) }
}

describe('List Reviews (GET /api/tools/[slug]/reviews)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns reviews with averageRating', async () => {
    // GET route query chain order:
    // Q1: select.from(tools).where().limit(1) — where calls: #1 (chains to limit)
    // Q2: select.from(reviews).where().orderBy().limit(50) — where calls: #2 (chains to orderBy)
    // Q3: select.from(reviews).where() — where calls: #3 (terminal, must resolve)
    mockDb.where
      .mockReturnValueOnce(mockDb)  // Q1: chains to .limit
      .mockReturnValueOnce(mockDb)  // Q2: chains to .orderBy
      .mockResolvedValueOnce([{ averageRating: 4.5, totalReviews: 2 }])  // Q3: stats terminal

    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])       // Q1: tool found
      .mockResolvedValueOnce([                          // Q2: reviews
        { id: 'review-1', rating: 5, comment: 'Great tool!', createdAt: new Date().toISOString() },
        { id: 'review-2', rating: 4, comment: 'Very useful', createdAt: new Date().toISOString() },
      ])

    const response = await GET(
      makeRequest('/api/tools/my-tool/reviews'),
      makeParams('my-tool')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(2)
    expect(data.reviews[0].rating).toBe(5)
    expect(data.averageRating).toBe(4.5)
    expect(data.totalReviews).toBe(2)
  })

  it('returns empty list for new tool', async () => {
    mockDb.where
      .mockReturnValueOnce(mockDb)
      .mockReturnValueOnce(mockDb)
      .mockResolvedValueOnce([{ averageRating: 0, totalReviews: 0 }])

    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-new' }])
      .mockResolvedValueOnce([])

    const response = await GET(
      makeRequest('/api/tools/new-tool/reviews'),
      makeParams('new-tool')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(0)
    expect(data.averageRating).toBe(0)
    expect(data.totalReviews).toBe(0)
  })

  it('returns 404 for unknown slug', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // tool not found

    const response = await GET(
      makeRequest('/api/tools/nonexistent/reviews'),
      makeParams('nonexistent')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await GET(
      makeRequest('/api/tools/my-tool/reviews'),
      makeParams('my-tool')
    )
    expect(response.status).toBe(429)
  })
})

describe('Create Review (POST /api/tools/[slug]/reviews)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('creates a review when consumer has invocations', async () => {
    // POST chains (all use .limit(1) as terminal):
    // Q1: select.from(tools).where().limit(1)        -> tool exists
    // Q2: select.from(invocations).where().limit(1)   -> has invocations
    // Q3: select.from(reviews).where().limit(1)       -> no existing review
    // Q4: insert.values.returning                     -> created review
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])     // tool exists
      .mockResolvedValueOnce([{ id: 'inv-1' }])       // consumer has invocations
      .mockResolvedValueOnce([])                       // no existing review

    mockDb.returning.mockResolvedValueOnce([{
      id: 'review-new',
      rating: 4,
      comment: 'Solid tool',
      createdAt: new Date().toISOString(),
    }])

    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 4, comment: 'Solid tool' }),
      makeParams('my-tool')
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.review.rating).toBe(4)
    expect(data.review.comment).toBe('Solid tool')
  })

  it('rejects duplicate review with 409', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])         // tool exists
      .mockResolvedValueOnce([{ id: 'inv-1' }])           // consumer has invocations
      .mockResolvedValueOnce([{ id: 'existing-rev' }])    // review already exists

    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 5 }),
      makeParams('my-tool')
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('REVIEW_EXISTS')
  })

  it('rejects if consumer has no invocations with 403', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1' }])   // tool exists
      .mockResolvedValueOnce([])                     // no invocations

    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 3 }),
      makeParams('my-tool')
    )
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('NO_INVOCATIONS')
  })

  it('returns 404 when tool not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // tool not found

    const response = await POST(
      makeRequest('/api/tools/unknown/reviews', 'POST', { rating: 4 }),
      makeParams('unknown')
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('validates rating range (too high)', async () => {
    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 6 }),
      makeParams('my-tool')
    )

    expect(response.status).toBe(422)
  })

  it('validates rating range (too low)', async () => {
    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 0 }),
      makeParams('my-tool')
    )

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await POST(
      makeRequest('/api/tools/my-tool/reviews', 'POST', { rating: 4 }),
      makeParams('my-tool')
    )

    expect(response.status).toBe(401)
  })
})
