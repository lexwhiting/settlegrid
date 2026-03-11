import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
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
  },
  invocations: {
    id: 'id',
    toolId: 'tool_id',
    createdAt: 'created_at',
    method: 'method',
    costCents: 'cost_cents',
    latencyMs: 'latency_ms',
    status: 'status',
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
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET } from '@/app/api/dashboard/developer/stats/export/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('CSV Export (GET /api/dashboard/developer/stats/export)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  })

  it('returns CSV with header row when developer has no tools', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no tools

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('settlegrid-export')

    const text = await response.text()
    expect(text).toContain('timestamp,tool,method,cost_cents,latency_ms,status')
  })

  it('returns CSV data for invocations', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', name: 'My Tool' }]) // tools
      .mockResolvedValueOnce([
        {
          createdAt: new Date('2026-03-01T10:00:00Z'),
          toolId: 'tool-1',
          method: 'classify',
          costCents: 5,
          latencyMs: 120,
          status: 'success',
        },
      ]) // invocations

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export'))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('My Tool')
    expect(text).toContain('classify')
    expect(text).toContain('5')
    expect(text).toContain('120')
    expect(text).toContain('success')
  })

  it('respects days parameter', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no tools

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export?days=7'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('7d.csv')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export'))
    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export'))
    expect(response.status).toBe(429)
  })

  it('escapes commas in tool names', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', name: 'Tool, With, Commas' }])
      .mockResolvedValueOnce([
        {
          createdAt: new Date('2026-03-01T10:00:00Z'),
          toolId: 'tool-1',
          method: 'test',
          costCents: 1,
          latencyMs: null,
          status: 'success',
        },
      ])

    const response = await GET(makeRequest('/api/dashboard/developer/stats/export'))
    const text = await response.text()

    // Commas should be replaced with spaces in CSV output
    expect(text).not.toContain('Tool, With, Commas')
    expect(text).toContain('Tool  With  Commas')
  })
})
