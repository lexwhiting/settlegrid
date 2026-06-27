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
 * confirmation (422), step-up re-auth — password (required/verified; OAuth-only
 * skips) AND the MFA/AAL2 branch (LB-1/LB-2: fresh challenge+verify, fail-closed
 * probe-error, fixed-string no-leak, capability-keyed TERMINAL precedence, the
 * never-block-erasure invariant per account shape), NO tier gate (free-tier
 * succeeds — guards §3.2/§13.13), self-scope
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
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        // Present so a regression that re-introduces the session-AAL2-bypass trap
        // (gating on getAAL().currentLevel) can be pinned as NEVER called.
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
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
// `verifyStepUp` now re-verifies against the AUTHENTICATED user's own email
// (`user.email`), NOT the passed developers.email. The fixture's auth-user email is
// deliberately DISTINCT from `DEV.email` so the literal-2 assertion below actually
// discriminates the two (an equal value would let a developers.email regression pass).
const PASSWORD_USER = { id: 'user-1', email: 'auth-user-1@x.com', app_metadata: { providers: ['email'] }, identities: [{ provider: 'email' }] }
const OAUTH_USER = { id: 'user-2', email: 'dev@x.com', app_metadata: { providers: ['github'] }, identities: [{ provider: 'github' }] }
// A user shape with NO password identity and ambiguous/empty provider evidence —
// pins the sec-3a residual (no-identities-evidence + no-MFA → ACCEPT, not blocked).
const NO_EVIDENCE_USER = { id: 'user-3', email: 'dev@x.com', app_metadata: {}, identities: [] as Array<{ provider: string }> }

// listFactors() shapes. The DEFAULT (beforeEach) is no-verified-MFA so the 4
// pre-existing step-up tests still exercise the password/OAuth paths.
const NO_FACTORS = { data: { totp: [], phone: [], webauthn: [], all: [] }, error: null }
const verifiedTotp = (...factors: Array<{ id: string; status: string }>) => ({
  data: { totp: factors, phone: [], webauthn: [], all: factors },
  error: null,
})

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
  // MFA DEFAULT: no verified factor — the no-MFA path. Per-test overrides with
  // mockResolvedValueOnce. challenge/verify default to clean success so an MFA test
  // that omits a verify override still resolves deterministically.
  mockSupabaseAuth.mfa.listFactors.mockResolvedValue(NO_FACTORS)
  mockSupabaseAuth.mfa.challenge.mockResolvedValue({ data: { id: 'chal-1' }, error: null })
  mockSupabaseAuth.mfa.verify.mockResolvedValue({ data: { access_token: 'tok', user: { id: 'user-1' } }, error: null })
  mockSupabaseAuth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
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

  it('verifies the password against the authenticated user’s OWN email (not the developers row)', async () => {
    await DELETE(delReq({ confirm: 'DELETE', password: 'pw' }))
    // PASSWORD_USER.email is DISTINCT from DEV.email, so this pins user.email (the
    // auth identity) and would fail a regression that re-verified developers.email.
    expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({ email: PASSWORD_USER.email, password: 'pw' })
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalledWith({ email: DEV.email, password: 'pw' })
  })

  it('a pure-OAuth account (no password identity) succeeds WITHOUT a password', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: OAUTH_USER } })
    const res = await DELETE(delReq({ confirm: 'DELETE' })) // no password
    expect(res.status).toBe(200)
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })
})

describe('DELETE /api/dashboard/developer/account — step-up MFA/AAL2 branch (LB-1/LB-2)', () => {
  const FACTOR_ID = '11111111-aaaa-bbbb-cccc-222222222222'
  const RAW_VERIFY_ERR = 'Invalid TOTP code reported by GoTrue'

  it('MFA-enrolled, omits the code → REAUTH_REQUIRED (no challenge round-trip, no scrub)', async () => {
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'verified' }))
    const res = await DELETE(delReq({ confirm: 'DELETE' })) // no mfaCode
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_REQUIRED')
    // Shape guard short-circuits BEFORE any SDK round-trip.
    expect(mockSupabaseAuth.mfa.challenge).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('MFA-enrolled, wrong code → REAUTH_FAILED with a FIXED string (no factorId / raw SDK message leak)', async () => {
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'verified' }))
    mockSupabaseAuth.mfa.verify.mockResolvedValueOnce({ data: null, error: { message: RAW_VERIFY_ERR } })
    const res = await DELETE(delReq({ confirm: 'DELETE', mfaCode: '000000' }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_FAILED')
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(FACTOR_ID)
    expect(serialized).not.toContain(RAW_VERIFY_ERR)
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('MFA-enrolled, correct code → success + the scrub runs (and the password branch is SKIPPED)', async () => {
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'verified' }))
    const res = await DELETE(delReq({ confirm: 'DELETE', mfaCode: '123456' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(mockSupabaseAuth.mfa.challenge).toHaveBeenCalledWith({ factorId: FACTOR_ID })
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })

  it('FRESHNESS (spec-1): an already-AAL2 session does NOT bypass — a wrong code is still rejected, challenge+verify ran, getAAL never consulted', async () => {
    mockSupabaseAuth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'verified' }))
    mockSupabaseAuth.mfa.verify.mockResolvedValueOnce({ data: null, error: { message: RAW_VERIFY_ERR } })
    const res = await DELETE(delReq({ confirm: 'DELETE', mfaCode: '000000' }))
    expect(res.status).toBe(401)
    // A FRESH challenge+verify ran on THIS request (the elevated session is not trusted)…
    expect(mockSupabaseAuth.mfa.challenge).toHaveBeenCalled()
    expect(mockSupabaseAuth.mfa.verify).toHaveBeenCalled()
    // …and the session-AAL2 level is never read (no getAAL().currentLevel bypass trap).
    expect(mockSupabaseAuth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('CAPABILITY-TERMINAL (sec-3): a password+MFA account sending a CORRECT password but no code → REAUTH_REQUIRED, signInWithPassword NOT called', async () => {
    // PASSWORD_USER (password-capable) WITH a verified factor → MFA is terminal.
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'verified' }))
    const res = await DELETE(delReq({ confirm: 'DELETE', password: 'correct-password' })) // no mfaCode
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_REQUIRED')
    // A password must NOT satisfy an MFA-enrolled account.
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('UNVERIFIED-factor non-block (spec-2): an enrolling-only factor is treated as NON-MFA — not challenged, not blocked', async () => {
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(verifiedTotp({ id: FACTOR_ID, status: 'unverified' }))
    // PASSWORD_USER with the correct password completes via the password branch.
    const res = await DELETE(delReq({ confirm: 'DELETE', password: 'pw' }))
    expect(res.status).toBe(200)
    expect(mockSupabaseAuth.mfa.challenge).not.toHaveBeenCalled()
    expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })

  it('PROBE-ERROR (sec-2): listFactors() rejects → fail-CLOSED-retryable (NOT accept), even for an OAuth user', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: OAUTH_USER } })
    mockSupabaseAuth.mfa.listFactors.mockRejectedValueOnce(new Error('network blip'))
    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_FAILED')
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('PROBE-ERROR (sec-2, error-return variant): listFactors() returns an error → fail-CLOSED-retryable', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: OAUTH_USER } })
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce({ data: null, error: { message: 'service unavailable' } })
    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_FAILED')
    expect(mockProcessDataDeletion).not.toHaveBeenCalled()
  })

  it('MULTI-FACTOR (literal-3): two verified factors, the code matches the SECOND → success (iterates, no false-reject)', async () => {
    const FACTOR_2 = '33333333-dddd-eeee-ffff-444444444444'
    mockSupabaseAuth.mfa.listFactors.mockResolvedValueOnce(
      verifiedTotp({ id: FACTOR_ID, status: 'verified' }, { id: FACTOR_2, status: 'verified' }),
    )
    // First factor's verify fails (wrong factor for this code); second succeeds.
    mockSupabaseAuth.mfa.verify
      .mockResolvedValueOnce({ data: null, error: { message: 'wrong factor' } })
      .mockResolvedValueOnce({ data: { access_token: 'tok' }, error: null })
    const res = await DELETE(delReq({ confirm: 'DELETE', mfaCode: '123456' }))
    expect(res.status).toBe(200)
    expect(mockSupabaseAuth.mfa.challenge).toHaveBeenCalledTimes(2)
    expect(mockSupabaseAuth.mfa.verify).toHaveBeenCalledTimes(2)
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })

  it('OAuth-no-MFA → ACCEPT without any proof (no challenge, no signInWithPassword)', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: OAUTH_USER } })
    // listFactors default = NO_FACTORS.
    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(mockSupabaseAuth.mfa.challenge).not.toHaveBeenCalled()
    expect(mockSupabaseAuth.signInWithPassword).not.toHaveBeenCalled()
    expect(mockProcessDataDeletion).toHaveBeenCalledWith('export-new')
  })

  it('sec-3a residual (spec-7): ambiguous/empty identities + no MFA → ACCEPT (not forced-password, not blocked)', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({ data: { user: NO_EVIDENCE_USER } })
    const res = await DELETE(delReq({ confirm: 'DELETE' }))
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
