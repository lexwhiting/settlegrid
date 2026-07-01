/**
 * G3-1 regression — consumer/academic $500 grant.
 *
 * Pins the money boundary closed: the grant requires an authenticated +
 * email-VERIFIED session, keys eligibility on the VERIFIED session email (never
 * a body field), rejects the substring/non-SLD bypasses, is minted EXACTLY ONCE
 * (the conditional UPDATE's rowCount gate), and fails CLOSED on the Supabase
 * auto-confirm signature.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, mockRequireConsumer, mockSendEmail, mockLogger } = vi.hoisted(() => {
  const mockDb = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    // Default: a fresh grant (1 row). Individual tests override.
    returning: vi.fn().mockResolvedValue([{ id: 'con-1' }]),
  }
  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 3, remaining: 2, reset: 0 }),
    mockRequireConsumer: vi.fn(),
    mockSendEmail: vi.fn().mockResolvedValue(undefined),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  consumers: {
    id: 'id',
    email: 'email',
    globalBalanceCents: 'global_balance_cents',
    academicGrantedAt: 'academic_granted_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({ requireConsumer: mockRequireConsumer }))

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({})),
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => '203.0.113.7',
}))

vi.mock('@/lib/email', () => ({ sendEmail: mockSendEmail }))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((c: unknown) => ({ isNull: c })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { POST } from '@/app/api/consumer/academic/route'
import { isNull } from 'drizzle-orm'

function makeRequest(body: Record<string, unknown> = { email: 'ignored@example.com', institutionName: 'Test University' }) {
  return new NextRequest('http://localhost/api/consumer/academic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** A verified, non-auto-confirmed academic session. */
function verifiedAcademic(verifiedEmail = 'alice@harvard.edu') {
  mockRequireConsumer.mockResolvedValue({
    id: 'con-1',
    email: 'db-copy@harvard.edu',
    verifiedEmail,
    emailAutoConfirmSuspected: false,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 3, remaining: 2, reset: 0 })
  mockSendEmail.mockResolvedValue(undefined)
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.returning.mockResolvedValue([{ id: 'con-1' }])
})

describe('POST /api/consumer/academic — G3-1', () => {
  it('401s an unauthenticated caller (no grant)', async () => {
    mockRequireConsumer.mockRejectedValue(new Error('Authentication required. Please sign in.'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('401s an authenticated-but-unverified caller (requireEmailVerified throws → no grant)', async () => {
    mockRequireConsumer.mockRejectedValue(new Error('Email verification required. Please confirm your email address.'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('requests eligibility with requireEmailVerified: true', async () => {
    verifiedAcademic()
    await POST(makeRequest())
    expect(mockRequireConsumer).toHaveBeenCalledWith(expect.anything(), { requireEmailVerified: true })
  })

  it('422s a verified NON-academic session email — even if the body email is academic', async () => {
    verifiedAcademic('joe@gmail.com')
    // Attacker supplies an academic body email; it MUST be ignored.
    const res = await POST(makeRequest({ email: 'victim@harvard.edu', institutionName: 'Harvard' }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.code).toBe('NON_ACADEMIC_EMAIL')
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('grants $500 exactly once for a verified academic session (fresh grant → 1 row)', async () => {
    verifiedAcademic('alice@harvard.edu')
    mockDb.returning.mockResolvedValue([{ id: 'con-1' }]) // marker flip won the race
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.creditAmount).toBe('$500')
    // Grant went through the atomic conditional UPDATE, credit sent to the
    // VERIFIED session email, not the body email.
    expect(mockDb.update).toHaveBeenCalledTimes(1)
    // Idempotency teeth: the UPDATE MUST be null-gated on the marker
    // (WHERE academic_granted_at IS NULL). Without this, a second claim would
    // re-credit $500 — and the outcome-stub tests below would not catch it.
    expect(isNull).toHaveBeenCalledWith('academic_granted_at')
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail.mock.calls[0][0].to).toBe('alice@harvard.edu')
  })

  it('does NOT double-grant on a second call (marker already set → 0 rows, idempotent)', async () => {
    verifiedAcademic('alice@harvard.edu')
    mockDb.returning.mockResolvedValue([]) // WHERE academic_granted_at IS NULL matched nothing
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.creditAmount).toBeUndefined() // no fresh credit advertised
    expect(mockSendEmail).not.toHaveBeenCalled() // no repeated welcome/$500 email
  })

  it('rejects the .includes substring bypass (myuni-hack.com)', async () => {
    verifiedAcademic('x@myuni-hack.com')
    const res = await POST(makeRequest())
    expect(res.status).toBe(422)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('rejects a non-SLD uni- label (uni-hack.attacker.com)', async () => {
    verifiedAcademic('x@uni-hack.attacker.com')
    const res = await POST(makeRequest())
    expect(res.status).toBe(422)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('rejects a malformed double-@ email (a@harvard.edu@evil.com)', async () => {
    // The middle token must NOT be treated as an eligible domain while mail
    // would route to evil.com.
    verifiedAcademic('a@harvard.edu@evil.com')
    const res = await POST(makeRequest())
    expect(res.status).toBe(422)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('admits a real second-level uni- label (stud.uni-muenchen.de)', async () => {
    verifiedAcademic('s@stud.uni-muenchen.de')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('fails CLOSED on the Supabase auto-confirm signature (no grant, money_loss alert)', async () => {
    mockRequireConsumer.mockResolvedValue({
      id: 'con-1',
      email: 'db-copy@harvard.edu',
      verifiedEmail: 'alice@harvard.edu',
      emailAutoConfirmSuspected: true,
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('EMAIL_VERIFICATION_UNAVAILABLE')
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
    const alerted = mockLogger.error.mock.calls.some(
      ([, ctx]) => ctx && (ctx as { money_loss?: boolean }).money_loss === true
    )
    expect(alerted).toBe(true)
  })

  it('still grants when the welcome email throws (email is non-fatal)', async () => {
    verifiedAcademic('alice@harvard.edu')
    mockDb.returning.mockResolvedValue([{ id: 'con-1' }])
    mockSendEmail.mockRejectedValue(new Error('email provider down'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.creditAmount).toBe('$500')
  })
})
