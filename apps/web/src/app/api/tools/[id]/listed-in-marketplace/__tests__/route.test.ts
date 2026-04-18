/**
 * Tests for PATCH /api/tools/[id]/listed-in-marketplace (P2.INTL2).
 *
 * Coverage close-out: the route was at 0% before this file. The full matrix
 * here locks in the INTL2 toggle contract end-to-end — rate limit, auth,
 * UUID validation, body validation, ownership filter, deleted-tool guard,
 * the SELECT-vs-UPDATE race, audit log wiring, and success response shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockWriteAuditLog } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    developerId: 'developer_id',
    name: 'name',
    slug: 'slug',
    status: 'status',
    listedInMarketplace: 'listed_in_marketplace',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { PATCH } from '../route'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440001'

function makeRequest(body: unknown, ip = '1.2.3.4'): NextRequest {
  return new NextRequest(
    `http://localhost/api/tools/${VALID_UUID}/listed-in-marketplace`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset()
  mockDb.returning.mockReset()
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' })
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockWriteAuditLog.mockResolvedValue(undefined)
})

describe('PATCH /api/tools/[id]/listed-in-marketplace — auth + rate limit', () => {
  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('returns 401 when requireDeveloper throws', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Missing developer token'))
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.error).toContain('Missing developer token')
  })

  it('returns 401 with fallback message when auth throws non-Error', async () => {
    mockRequireDeveloper.mockRejectedValueOnce('bare-string-throw')
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Authentication required')
  })

  it('uses x-forwarded-for as the rate-limit key (per-IP throttling)', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([
      { id: VALID_UUID, name: 'T', slug: 't', status: 'draft', listedInMarketplace: true, updatedAt: new Date() },
    ])
    await PATCH(makeRequest({ listedInMarketplace: true }, '9.9.9.9'), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.anything(), 'tool-listed:9.9.9.9')
  })

  it('falls back to "unknown" when x-forwarded-for is missing', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([
      { id: VALID_UUID, name: 'T', slug: 't', status: 'draft', listedInMarketplace: true, updatedAt: new Date() },
    ])
    const req = new NextRequest(
      `http://localhost/api/tools/${VALID_UUID}/listed-in-marketplace`,
      {
        method: 'PATCH',
        body: JSON.stringify({ listedInMarketplace: true }),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    await PATCH(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.anything(), 'tool-listed:unknown')
  })
})

describe('PATCH /api/tools/[id]/listed-in-marketplace — param + body validation', () => {
  it('returns 400 for malformed UUID', async () => {
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_ID')
  })

  it('returns 422 when listedInMarketplace is missing', async () => {
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(422)
  })

  it('returns 422 when listedInMarketplace is a string instead of a boolean', async () => {
    const res = await PATCH(makeRequest({ listedInMarketplace: 'true' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(422)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/tools/${VALID_UUID}/listed-in-marketplace`,
      {
        method: 'PATCH',
        body: '{not-json',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/tools/[id]/listed-in-marketplace — ownership + state guards', () => {
  it('returns 404 when no row matches the id + developer combo (non-owner)', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // SELECT returns nothing
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: OTHER_UUID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('returns 400 when the tool is soft-deleted', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'deleted', listedInMarketplace: false },
    ])
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('TOOL_DELETED')
  })

  it('returns 404 when the UPDATE affects no rows (SELECT/UPDATE race)', async () => {
    // SELECT saw the tool, but UPDATE's ownership filter returned nothing
    // (ownership changed between SELECT and UPDATE, or tool was concurrently
    // reassigned). The defense-in-depth pattern documented in the route.
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([]) // UPDATE returned 0 rows
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /api/tools/[id]/listed-in-marketplace — success cases', () => {
  it('toggles a draft tool on (the INTL2 happy path)', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: 'Regional Tool',
        slug: 'regional-tool',
        status: 'draft',
        listedInMarketplace: true,
        updatedAt: new Date('2026-04-18T00:00:00Z'),
      },
    ])

    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tool.listedInMarketplace).toBe(true)
    expect(body.tool.status).toBe('draft')
  })

  it('toggles a draft tool off (developer hides from marketplace)', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: true },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: 'Hidden Tool',
        slug: 'hidden-tool',
        status: 'draft',
        listedInMarketplace: false,
        updatedAt: new Date(),
      },
    ])

    const res = await PATCH(makeRequest({ listedInMarketplace: false }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tool.listedInMarketplace).toBe(false)
  })

  it('accepts the toggle on active tools (flag stored but has no effect)', async () => {
    // Active tools are always in the marketplace regardless of the flag
    // (per shouldIncludeInMarketplace). We still accept the write so the
    // flag is preserved across status transitions — a dev who flips off
    // visibility while active, then moves back to draft, stays hidden.
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'active', listedInMarketplace: true },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: 'Active Tool',
        slug: 'active-tool',
        status: 'active',
        listedInMarketplace: false,
        updatedAt: new Date(),
      },
    ])

    const res = await PATCH(makeRequest({ listedInMarketplace: false }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(200)
  })

  it('writes an audit log entry with from/to values and status', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: 'Audited Tool',
        slug: 'audited-tool',
        status: 'draft',
        listedInMarketplace: true,
        updatedAt: new Date(),
      },
    ])

    await PATCH(makeRequest({ listedInMarketplace: true }, '5.5.5.5'), {
      params: Promise.resolve({ id: VALID_UUID }),
    })

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1)
    const call = mockWriteAuditLog.mock.calls[0][0]
    expect(call).toMatchObject({
      developerId: 'dev-123',
      action: 'tool.listed_in_marketplace_changed',
      resourceType: 'tool',
      resourceId: VALID_UUID,
      ipAddress: '5.5.5.5',
      details: {
        fromListed: false,
        toListed: true,
        status: 'draft',
      },
    })
  })

  it('does not fail the request when audit log writer throws', async () => {
    // Audit log is defense-in-depth telemetry, not a transactional guarantee.
    // If Sentry/logger is unavailable, the user-facing PATCH must still 200.
    mockWriteAuditLog.mockRejectedValueOnce(new Error('audit sink down'))
    mockDb.limit.mockResolvedValueOnce([
      { id: VALID_UUID, status: 'draft', listedInMarketplace: false },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        name: 'T',
        slug: 't',
        status: 'draft',
        listedInMarketplace: true,
        updatedAt: new Date(),
      },
    ])

    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/tools/[id]/listed-in-marketplace — unexpected error path', () => {
  it('returns 500 when the SELECT throws an unexpected DB error', async () => {
    mockDb.limit.mockRejectedValueOnce(new Error('ECONNREFUSED: postgres down'))
    const res = await PATCH(makeRequest({ listedInMarketplace: true }), {
      params: Promise.resolve({ id: VALID_UUID }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})
