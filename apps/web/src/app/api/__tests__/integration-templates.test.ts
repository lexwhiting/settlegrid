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
  tools: { id: 'id', name: 'name', slug: 'slug', status: 'status' },
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

import { GET } from '@/app/api/tools/by-slug/[slug]/integration/route'

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
}

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockClear()
    vi.mocked((mockDb as Record<string, ReturnType<typeof vi.fn>>)[key]).mockReturnValue(mockDb)
  }
}

describe('R13: Integration Templates (GET /api/tools/[slug]/integration)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockDb() })

  it('returns integration templates for an active tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'My Tool', slug: 'my-tool' }])
    const res = await GET(makeRequest('/api/tools/my-tool/integration'), { params: Promise.resolve({ slug: 'my-tool' }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.templates).toHaveLength(5)
    expect(data.tool.name).toBe('My Tool')
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('/api/tools/nonexistent/integration'), { params: Promise.resolve({ slug: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('includes Claude Desktop template', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test' }])
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    const claude = data.templates.find((t: { client: string }) => t.client === 'Claude Desktop')
    expect(claude).toBeDefined()
    expect(claude.config).toContain('mcpServers')
    expect(claude.instructions).toContain('Claude Desktop')
  })

  it('includes Cursor template', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test' }])
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    const cursor = data.templates.find((t: { client: string }) => t.client === 'Cursor')
    expect(cursor).toBeDefined()
    expect(cursor.instructions).toContain('Cursor')
  })

  it('includes Windsurf template', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test' }])
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    const ws = data.templates.find((t: { client: string }) => t.client === 'Windsurf')
    expect(ws).toBeDefined()
  })

  it('includes VS Code Copilot template', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test' }])
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    const vsc = data.templates.find((t: { client: string }) => t.client === 'VS Code Copilot')
    expect(vsc).toBeDefined()
  })

  it('includes Continue template', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Test', slug: 'test' }])
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    const data = await res.json()
    const cont = data.templates.find((t: { client: string }) => t.client === 'Continue')
    expect(cont).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await GET(makeRequest('/api/tools/test/integration'), { params: Promise.resolve({ slug: 'test' }) })
    expect(res.status).toBe(429)
  })

  it('templates contain tool slug in config', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Custom Tool', slug: 'custom-tool' }])
    const res = await GET(makeRequest('/api/tools/custom-tool/integration'), { params: Promise.resolve({ slug: 'custom-tool' }) })
    const data = await res.json()
    for (const tmpl of data.templates) {
      expect(tmpl.config).toContain('custom-tool')
    }
  })
})
