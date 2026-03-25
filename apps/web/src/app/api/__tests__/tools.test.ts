import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockValidateToolForActivation } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    mockValidateToolForActivation: vi.fn().mockResolvedValue({ passed: true, failures: [] }),
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
    description: 'description',
    pricingConfig: 'pricing_config',
    status: 'status',
    category: 'category',
    verified: 'verified',
    reportedAt: 'reported_at',
    totalInvocations: 'total_invocations',
    totalRevenueCents: 'total_revenue_cents',
    healthEndpoint: 'health_endpoint',
    currentVersion: 'current_version',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  developers: {
    id: 'id',
    name: 'name',
    slug: 'slug',
  },
  toolReviews: {
    id: 'id',
    toolId: 'tool_id',
    rating: 'rating',
    comment: 'comment',
    createdAt: 'created_at',
    consumerId: 'consumer_id',
  },
  toolChangelogs: {
    id: 'id',
    toolId: 'tool_id',
    version: 'version',
    changeType: 'change_type',
    summary: 'summary',
    releasedAt: 'released_at',
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
}))

vi.mock('@/lib/quality-gates', () => ({
  validateToolForActivation: mockValidateToolForActivation,
}))

import { GET, POST } from '@/app/api/tools/route'
import { GET as getById, PATCH, DELETE } from '@/app/api/tools/[id]/route'
import { PATCH as patchStatus } from '@/app/api/tools/[id]/status/route'
import { GET as getPublic } from '@/app/api/tools/public/[slug]/route'

const mockTool = {
  id: 'tool-1',
  name: 'Test Tool',
  slug: 'test-tool',
  description: 'A test tool',
  pricingConfig: { model: 'per_call', perCallCents: 5 },
  status: 'active',
  totalInvocations: 100,
  totalRevenueCents: 500,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Tools List (GET /api/tools)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([mockTool])
  })

  it('returns developer tools list', async () => {
    const request = makeRequest('/api/tools')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tools).toBeDefined()
    expect(Array.isArray(data.tools)).toBe(true)
  })

  it('returns 401 if not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. No session token found.'))

    const request = makeRequest('/api/tools')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })
})

describe('Create Tool (POST /api/tools)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([mockTool])
  })

  it('creates a tool with valid data', async () => {
    const request = makeRequest('/api/tools', 'POST', {
      name: 'Test Tool',
      slug: 'test-tool',
      description: 'A test tool',
      pricingConfig: { model: 'per_call', perCallCents: 5 },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.tool).toBeDefined()
  })

  it('returns 409 for duplicate slug', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing-tool' }])

    const request = makeRequest('/api/tools', 'POST', {
      name: 'Dupe Tool',
      slug: 'existing-slug',
      pricingConfig: { model: 'per_call', perCallCents: 5 },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('SLUG_EXISTS')
  })

  it('returns 422 for invalid slug format', async () => {
    const request = makeRequest('/api/tools', 'POST', {
      name: 'Tool',
      slug: 'INVALID SLUG!',
      pricingConfig: { model: 'per_call', perCallCents: 5 },
    })

    const response = await POST(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 for missing pricingConfig', async () => {
    const request = makeRequest('/api/tools', 'POST', {
      name: 'Tool',
      slug: 'my-tool',
    })

    const response = await POST(request)
    expect(response.status).toBe(422)
  })
})

describe('Get Tool by ID (GET /api/tools/[id])', () => {
  const toolUuid = '550e8400-e29b-41d4-a716-446655440001'
  const missingUuid = '550e8400-e29b-41d4-a716-446655440099'

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('returns a single tool by id', async () => {
    mockDb.limit.mockResolvedValueOnce([mockTool])

    const request = makeRequest(`/api/tools/${toolUuid}`)
    const response = await getById(request, { params: Promise.resolve({ id: toolUuid }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tool).toBeDefined()
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest(`/api/tools/${missingUuid}`)
    const response = await getById(request, { params: Promise.resolve({ id: missingUuid }) })

    expect(response.status).toBe(404)
  })
})

describe('Update Tool (PATCH /api/tools/[id])', () => {
  const toolUuid = '550e8400-e29b-41d4-a716-446655440002'
  const otherUuid = '550e8400-e29b-41d4-a716-446655440003'

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('updates tool fields', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid }])
    mockDb.returning.mockResolvedValueOnce([{ ...mockTool, name: 'Updated Tool' }])

    const request = makeRequest(`/api/tools/${toolUuid}`, 'PATCH', { name: 'Updated Tool' })
    const response = await PATCH(request, { params: Promise.resolve({ id: toolUuid }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tool.name).toBe('Updated Tool')
  })

  it('returns 404 for tool not belonging to developer', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest(`/api/tools/${otherUuid}`, 'PATCH', { name: 'Nope' })
    const response = await PATCH(request, { params: Promise.resolve({ id: otherUuid }) })

    expect(response.status).toBe(404)
  })
})

describe('Delete Tool (DELETE /api/tools/[id])', () => {
  const toolUuid = '550e8400-e29b-41d4-a716-446655440004'

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('soft-deletes a tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid, status: 'active' }])

    const request = makeRequest(`/api/tools/${toolUuid}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: toolUuid }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain('deleted')
  })

  it('returns 400 for already deleted tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: toolUuid, status: 'deleted' }])

    const request = makeRequest(`/api/tools/${toolUuid}`, 'DELETE')
    const response = await DELETE(request, { params: Promise.resolve({ id: toolUuid }) })

    expect(response.status).toBe(400)
  })
})

describe('Toggle Tool Status (PATCH /api/tools/[id]/status)', () => {
  const statusUuid = '550e8400-e29b-41d4-a716-446655440005'

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('toggles tool to active', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: statusUuid, status: 'draft' }])
    mockDb.returning.mockResolvedValueOnce([{ id: statusUuid, name: 'Tool', slug: 'tool', status: 'active', updatedAt: new Date() }])

    const request = makeRequest(`/api/tools/${statusUuid}/status`, 'PATCH', { status: 'active' })
    const response = await patchStatus(request, { params: Promise.resolve({ id: statusUuid }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tool.status).toBe('active')
  })

  it('returns 400 for deleted tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: statusUuid, status: 'deleted' }])

    const request = makeRequest(`/api/tools/${statusUuid}/status`, 'PATCH', { status: 'active' })
    const response = await patchStatus(request, { params: Promise.resolve({ id: statusUuid }) })

    expect(response.status).toBe(400)
  })
})

describe('Public Tool (GET /api/tools/public/[slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.limit.mockReset()
    mockDb.limit.mockResolvedValue([])
  })

  it('returns public tool data for active tool', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'tool-1',
        name: 'Public Tool',
        slug: 'public-tool',
        description: 'A public tool',
        pricingConfig: { model: 'per_call', perCallCents: 5 },
        developerName: 'Dev Co',
      },
    ])

    const request = makeRequest('/api/tools/public/public-tool')
    const response = await getPublic(request, { params: Promise.resolve({ slug: 'public-tool' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.name).toBe('Public Tool')
    expect(data.data.developerName).toBe('Dev Co')
  })

  it('returns 404 for non-existent slug', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/tools/public/nonexistent')
    const response = await getPublic(request, { params: Promise.resolve({ slug: 'nonexistent' }) })

    expect(response.status).toBe(404)
  })
})
