import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
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
    name: 'name',
    slug: 'slug',
    description: 'description',
    category: 'category',
    tags: 'tags',
    currentVersion: 'current_version',
    totalInvocations: 'total_invocations',
    status: 'status',
    developerId: 'developer_id',
  },
  developers: {
    id: 'id',
    name: 'name',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  ilike: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ ilike: [a, b] })),
  or: vi.fn().mockImplementation((...args: unknown[]) => ({ or: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as getDirectory } from '@/app/api/tools/directory/route'
import { GET as getCategories } from '@/app/api/tools/categories/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Tool Directory (GET /api/tools/directory)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.limit.mockReturnThis()
    mockDb.offset.mockResolvedValue([])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns tools list', async () => {
    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'tool-1',
        name: 'AI Classifier',
        slug: 'ai-classifier',
        description: 'Classify text',
        category: 'nlp',
        tags: ['ai', 'text'],
        currentVersion: '1.0.0',
        totalInvocations: 500,
        developerName: 'Dev Co',
      },
      {
        id: 'tool-2',
        name: 'Image Resizer',
        slug: 'image-resizer',
        description: 'Resize images',
        category: 'image',
        tags: ['image'],
        currentVersion: '2.1.0',
        totalInvocations: 300,
        developerName: 'Img Inc',
      },
    ])

    const response = await getDirectory(makeRequest('/api/tools/directory'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tools).toHaveLength(2)
    expect(data.tools[0].name).toBe('AI Classifier')
    expect(data.tools[1].slug).toBe('image-resizer')
  })

  it('returns empty list when no tools match', async () => {
    mockDb.offset.mockResolvedValueOnce([])

    const response = await getDirectory(makeRequest('/api/tools/directory'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tools).toHaveLength(0)
  })

  it('passes category filter parameter', async () => {
    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'tool-1',
        name: 'Finance Tool',
        slug: 'finance-tool',
        description: 'Financial data',
        category: 'finance',
        tags: [],
        currentVersion: '1.0.0',
        totalInvocations: 100,
        developerName: 'Fin Dev',
      },
    ])

    const response = await getDirectory(makeRequest('/api/tools/directory?category=finance'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tools).toHaveLength(1)
    expect(data.tools[0].category).toBe('finance')
  })

  it('rejects invalid category', async () => {
    const response = await getDirectory(makeRequest('/api/tools/directory?category=invalid'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_CATEGORY')
  })

  it('handles search parameter', async () => {
    mockDb.offset.mockResolvedValueOnce([
      {
        id: 'tool-1',
        name: 'Text Analyzer',
        slug: 'text-analyzer',
        description: 'Analyze text content',
        category: 'nlp',
        tags: ['text'],
        currentVersion: '1.0.0',
        totalInvocations: 50,
        developerName: 'NLP Dev',
      },
    ])

    const response = await getDirectory(makeRequest('/api/tools/directory?search=text'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tools).toHaveLength(1)
    expect(data.tools[0].name).toBe('Text Analyzer')
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await getDirectory(makeRequest('/api/tools/directory'))
    expect(response.status).toBe(429)
  })
})

describe('Tool Categories (GET /api/tools/categories)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns all 10 categories with counts', async () => {
    mockDb.groupBy.mockResolvedValueOnce([
      { category: 'data', count: 5 },
      { category: 'nlp', count: 12 },
      { category: 'image', count: 3 },
    ])

    const response = await getCategories(makeRequest('/api/tools/categories'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.categories).toHaveLength(10)

    // Verify known counts
    const nlp = data.categories.find((c: { slug: string }) => c.slug === 'nlp')
    expect(nlp.name).toBe('Natural Language Processing')
    expect(nlp.count).toBe(12)

    const dataCategory = data.categories.find((c: { slug: string }) => c.slug === 'data')
    expect(dataCategory.count).toBe(5)

    // Categories with no tools should show count 0
    const security = data.categories.find((c: { slug: string }) => c.slug === 'security')
    expect(security.name).toBe('Security & Compliance')
    expect(security.count).toBe(0)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await getCategories(makeRequest('/api/tools/categories'))
    expect(response.status).toBe(429)
  })
})
