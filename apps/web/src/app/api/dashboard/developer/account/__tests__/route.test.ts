/**
 * Tests for the developer self-service GDPR account-deletion endpoint:
 *   DELETE /api/dashboard/developer/account
 *
 * Mirrors the api-keys route test style: requireDeveloper, the rate limiter, the
 * compliance functions, email, audit, and the Supabase client (step-up re-auth)
 * are all importable, so they are mocked directly. The response helpers
 * (@/lib/api) run for real so status codes are exercised end-to-end.
 *
 * Coverage maps to handoff §6 + §13: auth (401), CSRF same-origin (403),
 * confirmation (422), step-up re-auth (password required/verified; OAuth-only
 * skips), NO tier gate (free-tier succeeds — guards §3.2/§13.13), self-scope
 * (auth.id only), success (→completed + email + audit), idempotency / double-
 * submit (processing→409, completed→200, no raw 500 / UUID leak — §13.4/§13.5),
 * fail-mode alert (failed→500 + logger.error — §13.7), find-or-reuse (§13.4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockCheckRateLimit,
  mockRequestDataDeletion,
  mockProcessDataDeletion,
  mockSendEmail,
  mockAccountDeletedEmail,
  mockWriteAuditLog,
  mockLoggerError,
  mockSupabaseAuth,
} = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // default: no existing deletion row
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockRequestDataDeletion: vi.fn(),
    mockProcessDataDeletion: vi.fn(),
    mockSendEmail: vi.fn(),
    mockAccountDeletedEmail: vi.fn(() => ({ subject: 's', html: 'h' })),
    mockWriteAuditLog: vi.fn(),
    mockLoggerError: vi.fn(),
    mockSupabaseAuth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  complianceExports: {
    id: 'id',
    requestType: 'request_type',
    entityType: 'entity_type',
    entityId: 'entity_id',
    status: 'status',
    createdAt: 'created_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  ne: vi.fn((a, b) => ({ ne: [a, b] })),
  desc: vi.fn((a) => ({ desc: a })),
}))

vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  authLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/settlement/compliance', () => ({
  requestDataDeletion: mockRequestDataDeletion,
  processDataDeletion: mockProcessDataDeletion,
}))

vi.mock('@/lib/email', () => ({
  accountDeletedEmail: mockAccountDeletedEmail,
  sendEmail: mockSendEmail,
}))

vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mockLoggerError },
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: mockSupabaseAuth })),
}))

import { DELETE } from '../route'

const DEV = { id: 'dev-1', email: 'dev@x.com' }
const PASSWORD_USER = { id: 'user-1', app_metadata: { providers: ['email'] }, identities: [{ provider: 'email' }] }
const OAUTH_USER = { id: 'user-2', app_metadata: { providers: ['github'] }, identities: [{ provider: 'github' }] }

function delReq(body: unknown = { confirm: 'DELETE', password: 'pw' }, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/developer/account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default happy path: rate-limit ok, authed developer, password user with a
  // correct password, no existing deletion row, a fresh export, completed scrub.
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  mockRequireDeveloper.mockResolvedValue(DEV)
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockReturnThis()
  mockDb.limit.mockResolvedValue([])
  mockRequestDataDeletion.mockResolvedValue({ id: 'export-new', status: 'pending' })
  mockProcessDataDeletion.mockResolvedValue({ status: 'completed' })
  mockSendEmail.mockResolvedValue(true)
  // writeAuditLog is fire-and-forget (`.catch(...)`) — it MUST return a promise.
  mockWriteAuditLog.mockResolvedValue(undefined)
  mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: PASSWORD_USER } })
  mockSupabaseAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

describe('DELETE /api/dashboard/developer/account — auth + CSRF + confirmation', () => {
  it('429 when the IP rate limit is exceeded (before auth)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 5, remaining: 0, reset: 0 })
    const res = await DELETE(delReq())
    expect(res.status).toBe(429)
    expect(mockRequireDeveloper).not.toHaveBeenCalled()
  })

  it('403 when the request is cross-site (CSRF same-origin check)', async () => {
    const res = await DELETE(delReq(undefined, { 'sec-fetch-site': 'cross-site' }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('CSRF_REJECTED')
    // Rejected before authenticating.
    expect(mockRequireDeveloper).not.toHaveBeenCalled()
  })

  it('401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))
    const res = await DELETE(delReq())
    expect(res.status).toBe(401)
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('422 when the confirmation string is not exactly DELETE', async () => {
    const res = await DELETE(delReq({ confirm: 'delete', password: 'pw' }))
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.code).toBe('CONFIRMATION_REQUIRED')
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/dashboard/developer/account — step-up re-auth (§13.8b)', () => {
  it('401 REAUTH_REQUIRED when a password user omits the password', async () => {
    const res = await DELETE(delReq({ confirm: 'DELETE' })) // no password
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_REQUIRED')
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('401 REAUTH_FAILED when the re-entered password is wrong', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials' } })
    const res = await DELETE(delReq({ confirm: 'DELETE', password: 'wrong' }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_FAILED')
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('verifies the password against the authenticated user’s OWN email', async () => {
    await DELETE(delReq({ confirm: 'DELETE', password: 'pw' }))
    expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({ email: DEV.email, password: 'pw' })
  })

  it('a pure-OAuth account (no password identity) succeeds WITHOUT a password', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: OAUTH_USER } })
    const res = await DELETE(delReq({ confirm: 'DELETE' })) // no password
    expect(res.status).toBe(200)
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })
})

describe('DELETE /api/dashboard/developer/account — success path', () => {
  it('NO TIER GATE: a developer succeeds with no tier lookup at all (GDPR Art.17 — §3.2/§13.13)', async () => {
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')
    // The route never queries developers.tier / hasFeature — the only db.select is
    // the idempotency find-or-reuse (selects compliance_exports), never a tier row.
    expect(mockProcessDataDeletion).toHaveBeenCalledTimes(1)
  })

  it('SELF-SCOPE: deletes ONLY auth.id, ignoring any body-supplied target id (DC-03)', async () => {
    await DELETE(delReq({ confirm: 'DELETE', password: 'pw', entityId: 'victim-id', target: 'victim-id' }))
    // The deletion is keyed to the authenticated developer, never a body field.
    expect(mockRequestDataDeletion).toHaveBeenCalledWith('provider', DEV.id)
  })

  it('on success sends accountDeletedEmail to the pre-deletion address + attempts an audit log', async () => {
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockAccountDeletedEmail).toHaveBeenCalledWith(DEV.email)
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: DEV.email }))
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ developerId: DEV.id, action: 'privacy.account_deletion_completed' }),
    )
  })

  it('accountDeletedEmail is called WITHOUT an exportUrl (the deletion resultUrl is not served)', async () => {
    await DELETE(delReq())
    expect(mockAccountDeletedEmail).toHaveBeenCalledTimes(1)
    expect(mockAccountDeletedEmail.mock.calls[0]).toEqual([DEV.email]) // exactly one arg
  })

  it('the completion audit row carries NO ip/ua/details — it post-dates step 5, so any such field would escape the scrub and falsify the `anonymized: audit_logs.*` disclosure + the public "IP addresses are removed" docs claim (DC-16)', async () => {
    await DELETE(delReq())
    const auditArg = mockWriteAuditLog.mock.calls[0][0]
    expect(auditArg).toMatchObject({ developerId: DEV.id, action: 'privacy.account_deletion_completed' })
    expect(auditArg).not.toHaveProperty('ipAddress')
    expect(auditArg).not.toHaveProperty('userAgent')
    expect(auditArg).not.toHaveProperty('details')
  })
})

describe('DELETE /api/dashboard/developer/account — idempotency + fail-mode (§13.4/§13.5/§13.7)', () => {
  it('reuses an existing PENDING row instead of creating a fresh one (find-or-reuse)', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'export-pending', status: 'pending' }])
    await DELETE(delReq())
    expect(mockRequestDataDeletion).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-pending')
  })

  it('double-submit while PROCESSING → 409 with a fixed string (no raw 500, no UUID leak)', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: '11111111-2222-3333-4444-555555555555', status: 'processing' }])
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe('DELETION_IN_PROGRESS')
    expect(JSON.stringify(body)).not.toContain('11111111-2222-3333-4444-555555555555')
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('a COMPLETED prior deletion → 200 idempotent, no re-run, no second email', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'export-done', status: 'completed' }])
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.alreadyDeleted).toBe(true)
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('a concurrent processing THROW from processDataDeletion → 409, never a raw 500/UUID', async () => {
    mockProcessDataDeletion.mockRejectedValueOnce(new Error('Deletion already in progress: 11111111-2222-3333-4444-555555555555'))
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe('DELETION_IN_PROGRESS')
    expect(JSON.stringify(body)).not.toContain('11111111-2222-3333-4444-555555555555')
  })

  it('a FAILED scrub → 500 DELETION_FAILED + a structured fail alert (§13.7a), no UUID', async () => {
    mockProcessDataDeletion.mockResolvedValueOnce({ status: 'failed' })
    const res = await DELETE(delReq())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.code).toBe('DELETION_FAILED')
    expect(mockLoggerError).toHaveBeenCalledWith(
      'compliance.account_deletion.alert_failed',
      expect.objectContaining({ developerId: DEV.id, status: 'failed' }),
    )
    // No download link / UUID is offered on the failure path.
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
