/**
 * Tests for POST /api/tools/quick-publish.
 *
 * The tool is inserted as a hidden draft, the dashboard's quality gate runs,
 * and only a passing gate flips it to 'active'. A failing gate returns 422
 * QUALITY_GATE_FAILED with the reasons and leaves the draft in place.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockValidate, mockRequireDeveloper, mockQueueSeed, mockOnToolActivated } = vi.hoisted(() => {
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
  }
  return {
    mockDb,
    mockValidate: vi.fn(),
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-1', email: 'dev@example.com' }),
    mockQueueSeed: vi.fn(),
    mockOnToolActivated: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    developerId: 'developer_id',
    name: 'name',
    slug: 'slug',
    description: 'description',
    pricingConfig: 'pricing_config',
    status: 'status',
    toolType: 'tool_type',
    category: 'category',
    proxyEndpoint: 'proxy_endpoint',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  getClientIp: () => '203.0.113.8',
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/request-id', () => ({ getOrCreateRequestId: vi.fn().mockReturnValue('req-test') }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/seed-invocations', () => ({ queueSeedInvocations: mockQueueSeed }))
vi.mock('@/lib/quality-gates', () => ({ validateToolForActivation: mockValidate }))
vi.mock('@/lib/tool-activation', () => ({ onToolActivated: mockOnToolActivated }))

import { POST } from '../route'

const VALID_BODY = {
  url: 'https://api.example.com/v1/search',
  name: 'Example Search',
  category: 'search',
  costCents: 5,
  description: 'Full-text search over a curated public dataset, returning ranked JSON results.',
}

function makeRequest(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/tools/quick-publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const DRAFT_ROW = {
  id: 'tool-1',
  name: 'Example Search',
  slug: 'example-search',
  description: VALID_BODY.description,
  pricingConfig: { model: 'per-invocation', defaultCostCents: 5 },
  status: 'draft',
  toolType: 'mcp-server',
  category: 'search',
  proxyEndpoint: VALID_BODY.url,
  createdAt: new Date('2026-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.insert.mockReturnThis()
  mockDb.values.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset()
  mockDb.limit.mockResolvedValue([]) // slug is free
  mockDb.returning.mockReset()
})

describe('POST /api/tools/quick-publish', () => {
  it('inserts a hidden draft and activates it when the gate passes', async () => {
    mockDb.returning
      .mockResolvedValueOnce([DRAFT_ROW])
      .mockResolvedValueOnce([{ status: 'active' }])
    mockValidate.mockResolvedValueOnce({ passed: true, failures: [] })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        listedInMarketplace: false,
        proxyEndpoint: VALID_BODY.url,
        description: VALID_BODY.description,
        category: 'search',
      })
    )
    expect(mockValidate).toHaveBeenCalledWith('tool-1', 'dev-1')
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
    expect(data.tool.status).toBe('active')
    expect(data.tool.proxyUrl).toMatch(/\/api\/proxy\/example-search$/)
    expect(mockQueueSeed).toHaveBeenCalled()
    expect(mockOnToolActivated).toHaveBeenCalledWith({ developerId: 'dev-1', toolId: 'tool-1' })
  })

  it('returns 422 with the gate reasons and leaves the tool as a draft', async () => {
    mockDb.returning.mockResolvedValueOnce([{ ...DRAFT_ROW, description: 'Too short' }])
    mockValidate.mockResolvedValueOnce({
      passed: false,
      failures: [
        'Description must be at least 50 characters (currently 9)',
        'Your developer profile must have a display name and slug set (go to Settings > Profile)',
      ],
    })

    const res = await POST(makeRequest({ ...VALID_BODY, description: 'Too short' }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.code).toBe('QUALITY_GATE_FAILED')
    expect(data.failures).toHaveLength(2)
    expect(data.toolId).toBe('tool-1')
    expect(data.currentStatus).toBe('draft')
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(mockQueueSeed).not.toHaveBeenCalled()
    expect(mockOnToolActivated).not.toHaveBeenCalled()
  })

  it('rejects a category outside the canonical list before inserting', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, category: 'not-a-category' }))
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.code).toBe('INVALID_CATEGORY')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['http://api.example.com/v1'],
    ['https://127.0.0.1/v1'],
  ])('rejects the upstream URL %s', async (url) => {
    const res = await POST(makeRequest({ ...VALID_BODY, url }))

    expect(res.status).toBe(422)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('returns 401 without a session', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
  })
})
