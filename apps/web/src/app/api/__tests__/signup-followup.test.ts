/**
 * P4.8 — signup-followup route tests.
 *
 * Coverage:
 *   - GET auth gates: 429 / 401 / 403
 *   - GET happy path: shape of `{total, rows}`, latest-status reduction,
 *     default-to-not_sent for untouched rows, latest_at null pass-through
 *   - POST auth gates: 429 / 401 / 403
 *   - POST validation: invalid body shape (Zod), bad UUID, bad enum,
 *     overlong note
 *   - POST happy path: writes audit log, returns {ok: true, status}
 *   - POST 404: developer not found
 *   - isValidStatus type guard
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockCheckRateLimit,
  mockWriteAuditLog,
  mockLogger,
} = vi.hoisted(() => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  }
  // Chainable select() / from() / where() / limit() — last call returns
  // a Promise resolving to whatever rows the test pre-stages via
  // mockDb.limit.mockResolvedValueOnce(...). Mirrors the existing
  // audit-logging.test.ts pattern.
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  // limit is the last call before await — return value from this is awaited.
  return {
    mockDb,
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', email: 'email', name: 'name', createdAt: 'created_at' },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
vi.mock('drizzle-orm', () => ({
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({
    sql: strings,
    values,
  })),
}))

import {
  GET,
  POST,
  SIGNUP_FOLLOWUP_STATUSES,
  isValidStatus,
} from '../admin/signup-followup/route'

const ADMIN_EMAIL = 'lexwhiting365@gmail.com'
const VALID_DEV_UUID = '11111111-1111-1111-1111-111111111111'

function makeGet(): NextRequest {
  return new NextRequest('http://localhost:3005/api/admin/signup-followup', {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/admin/signup-followup', {
    method: 'POST',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'Content-Type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: ADMIN_EMAIL })
  // Default: empty list for GET, found-developer for POST.
  mockDb.execute.mockResolvedValue([])
  mockDb.limit.mockResolvedValue([{ id: VALID_DEV_UUID }])
  mockWriteAuditLog.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('isValidStatus', () => {
  it('accepts every spec-literal status', () => {
    for (const s of SIGNUP_FOLLOWUP_STATUSES) {
      expect(isValidStatus(s)).toBe(true)
    }
  })
  it('rejects unknown strings (e.g., "skipped" — dropped per HC22)', () => {
    expect(isValidStatus('skipped')).toBe(false)
    expect(isValidStatus('SENT')).toBe(false)
    expect(isValidStatus('')).toBe(false)
  })
  it('rejects non-strings', () => {
    expect(isValidStatus(null)).toBe(false)
    expect(isValidStatus(undefined)).toBe(false)
    expect(isValidStatus(42)).toBe(false)
    expect(isValidStatus({})).toBe(false)
  })
  it('matches exactly the 4 spec-literal statuses (length check)', () => {
    expect(SIGNUP_FOLLOWUP_STATUSES).toHaveLength(4)
    expect(SIGNUP_FOLLOWUP_STATUSES).toEqual([
      'not_sent',
      'sent',
      'scheduled',
      'interviewed',
    ])
  })
})

describe('GET /api/admin/signup-followup — auth gates', () => {
  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await GET(makeGet())
    expect(res.status).toBe(429)
  })
  it('returns 401 when requireDeveloper throws', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('not authed'))
    const res = await GET(makeGet())
    expect(res.status).toBe(401)
  })
  it('returns 403 when authed user not in ADMIN_EMAILS', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({
      id: 'dev-x',
      email: 'someone-else@example.com',
    })
    const res = await GET(makeGet())
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/signup-followup — happy path', () => {
  it('returns {total, rows} with empty list when DB has no signups', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ total: 0, rows: [] })
  })

  it('maps DB rows to the response shape, defaulting status to not_sent', async () => {
    const signedUp = new Date('2026-04-25T10:00:00Z')
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: 'Jane Doe',
        signed_up_at: signedUp,
        latest_action: null,
        latest_details: null,
        latest_at: null,
      },
    ])
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.rows[0]).toEqual({
      developerId: VALID_DEV_UUID,
      email: 'jane@example.com',
      name: 'Jane Doe',
      signedUpAt: '2026-04-25T10:00:00.000Z',
      status: 'not_sent',
      statusUpdatedAt: null,
      note: null,
    })
  })

  it('reduces audit_logs latest details into status + note', async () => {
    const signedUp = new Date('2026-04-25T10:00:00Z')
    const updatedAt = new Date('2026-04-26T14:30:00Z')
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: 'Jane Doe',
        signed_up_at: signedUp,
        latest_action: 'signup_followup.update',
        latest_details: { status: 'scheduled', note: 'Booked Tuesday 2pm' },
        latest_at: updatedAt,
      },
    ])
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.rows[0].status).toBe('scheduled')
    expect(body.rows[0].note).toBe('Booked Tuesday 2pm')
    expect(body.rows[0].statusUpdatedAt).toBe('2026-04-26T14:30:00.000Z')
  })

  it('coerces unknown stored status to not_sent (defensive — legacy/garbage data)', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: null,
        signed_up_at: new Date('2026-04-25T10:00:00Z'),
        latest_action: 'signup_followup.update',
        // 'skipped' was removed per HC22; old rows MUST coerce to not_sent.
        latest_details: { status: 'skipped', note: 'old workflow' },
        latest_at: new Date('2026-04-26T14:30:00Z'),
      },
    ])
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.rows[0].status).toBe('not_sent')
    // Note still flows through.
    expect(body.rows[0].note).toBe('old workflow')
  })

  it('handles {rows: ...} driver shape (pg vs postgres-js variance)', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          developer_id: VALID_DEV_UUID,
          email: 'jane@example.com',
          name: null,
          signed_up_at: new Date('2026-04-25T10:00:00Z'),
          latest_action: null,
          latest_details: null,
          latest_at: null,
        },
      ],
    })
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.total).toBe(1)
  })

  it('renders epoch-0 sentinel for malformed signed_up_at (defensive — HC5)', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: null,
        // Garbage value the driver might return on a corrupt row.
        signed_up_at: 'not a real timestamp',
        latest_action: null,
        latest_details: null,
        latest_at: null,
      },
    ])
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows[0].signedUpAt).toBe('1970-01-01T00:00:00.000Z')
  })

  it('handles numeric (epoch-ms) timestamp shape from the driver', async () => {
    // Some Postgres drivers can be configured to return timestamps
    // as numbers; toIso must handle that branch.
    const epochMs = 1750000000000 // 2025-06-15T17:46:40Z
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: null,
        signed_up_at: epochMs,
        latest_action: null,
        latest_details: null,
        latest_at: null,
      },
    ])
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.rows[0].signedUpAt).toBe(new Date(epochMs).toISOString())
  })

  it('renders epoch-0 sentinel for non-Date/non-string/non-number timestamp shapes', async () => {
    // Defensive fall-through: object/array/etc. matches no branch.
    mockDb.execute.mockResolvedValueOnce([
      {
        developer_id: VALID_DEV_UUID,
        email: 'jane@example.com',
        name: null,
        signed_up_at: { weird: 'shape' },
        latest_action: null,
        latest_details: null,
        latest_at: null,
      },
    ])
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.rows[0].signedUpAt).toBe('1970-01-01T00:00:00.000Z')
  })

  it('returns 500 from internalErrorResponse when the DB query throws', async () => {
    // Exercises the outer try/catch in GET — last-resort guard.
    mockDb.execute.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await GET(makeGet())
    expect(res.status).toBe(500)
  })
})

describe('POST /api/admin/signup-followup — auth gates', () => {
  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'sent' }),
    )
    expect(res.status).toBe(429)
  })
  it('returns 401 when requireDeveloper throws', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('not authed'))
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'sent' }),
    )
    expect(res.status).toBe(401)
  })
  it('returns 403 when authed user not in ADMIN_EMAILS', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({
      id: 'dev-x',
      email: 'someone-else@example.com',
    })
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'sent' }),
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/signup-followup — body validation', () => {
  it('returns 400 on non-JSON body', async () => {
    const res = await POST(makePost('not-json{'))
    expect([400, 422]).toContain(res.status)
  })
  it('returns 422 on missing developerId', async () => {
    const res = await POST(makePost({ status: 'sent' }))
    expect(res.status).toBe(422)
  })
  it('returns 422 on non-UUID developerId', async () => {
    const res = await POST(
      makePost({ developerId: 'not-a-uuid', status: 'sent' }),
    )
    expect(res.status).toBe(422)
  })
  it('returns 422 on unknown status enum', async () => {
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'maybe' }),
    )
    expect(res.status).toBe(422)
  })
  it('returns 422 on legacy "skipped" status (dropped per HC22)', async () => {
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'skipped' }),
    )
    expect(res.status).toBe(422)
  })
  it('returns 422 on note > 500 chars', async () => {
    const res = await POST(
      makePost({
        developerId: VALID_DEV_UUID,
        status: 'sent',
        note: 'x'.repeat(501),
      }),
    )
    expect(res.status).toBe(422)
  })
  it('accepts note exactly 500 chars', async () => {
    const res = await POST(
      makePost({
        developerId: VALID_DEV_UUID,
        status: 'sent',
        note: 'x'.repeat(500),
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('POST /api/admin/signup-followup — happy path', () => {
  it('writes an audit log and returns {ok, status}', async () => {
    const res = await POST(
      makePost({
        developerId: VALID_DEV_UUID,
        status: 'sent',
        note: 'emailed at 14:30',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: 'sent' })
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: VALID_DEV_UUID,
        action: 'signup_followup.update',
        resourceType: 'developer_signup',
        resourceId: VALID_DEV_UUID,
        details: expect.objectContaining({
          status: 'sent',
          note: 'emailed at 14:30',
          actor_email: ADMIN_EMAIL,
        }),
      }),
    )
  })

  it('records actor_email so the audit trail attributes the change', async () => {
    await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'interviewed' }),
    )
    const callArgs = mockWriteAuditLog.mock.calls[0]?.[0] as
      | { details?: { actor_email?: string } }
      | undefined
    expect(callArgs?.details?.actor_email).toBe(ADMIN_EMAIL)
  })

  it('omits note as null when not supplied', async () => {
    await POST(makePost({ developerId: VALID_DEV_UUID, status: 'sent' }))
    const callArgs = mockWriteAuditLog.mock.calls[0]?.[0] as
      | { details?: { note?: string | null } }
      | undefined
    expect(callArgs?.details?.note).toBeNull()
  })

  it('accepts every spec-literal status value', async () => {
    for (const status of SIGNUP_FOLLOWUP_STATUSES) {
      mockWriteAuditLog.mockClear()
      const res = await POST(
        makePost({ developerId: VALID_DEV_UUID, status }),
      )
      expect(res.status).toBe(200)
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1)
    }
  })
})

describe('POST /api/admin/signup-followup — 404 on unknown developer', () => {
  it('returns 404 when the developer is not in the DB', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await POST(
      makePost({ developerId: VALID_DEV_UUID, status: 'sent' }),
    )
    expect(res.status).toBe(404)
    expect(mockWriteAuditLog).not.toHaveBeenCalled()
  })
})
