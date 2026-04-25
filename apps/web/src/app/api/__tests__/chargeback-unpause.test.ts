/**
 * P3.RAIL3 — Tests for POST /api/admin/chargeback-watch/unpause.
 *
 * Hostile contracts under test:
 *   (c) auto-pause is reversible — admin endpoint flips
 *       developers.onboarding_paused back to false.
 *
 * Decision tree exercised:
 *   - rate-limit (429), auth (401), founder gate (403)
 *   - 404 NOT_FOUND when target developer missing
 *   - idempotent 200 / applied=false when already unpaused
 *   - happy path 200 / applied=true with audit log + chargeback row resolution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockWriteAuditLog,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  mockRequireDeveloper: vi.fn(),
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    onboardingPaused: 'onboarding_paused',
    onboardingPausedAt: 'onboarding_paused_at',
    onboardingPausedReason: 'onboarding_paused_reason',
    updatedAt: 'updated_at',
  },
  chargebackAlerts: {
    developerId: 'developer_id',
    tier: 'tier',
    resolvedAt: 'resolved_at',
    resolvedReason: 'resolved_reason',
  },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { POST } from '@/app/api/admin/chargeback-watch/unpause/route'

const ADMIN_EMAIL = 'lexwhiting365@gmail.com'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(
    'http://localhost/api/admin/chargeback-watch/unpause',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

describe('POST /api/admin/chargeback-watch/unpause', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true })
    mockRequireDeveloper.mockResolvedValue({ id: 'admin-1', email: ADMIN_EMAIL })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false })
    const res = await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    expect(res.status).toBe(429)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireDeveloper.mockRejectedValue(new Error('not signed in'))
    const res = await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 FORBIDDEN to non-admin developers', async () => {
    mockRequireDeveloper.mockResolvedValue({
      id: 'dev-99',
      email: 'random@example.com',
    })
    const res = await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
    // Defence in depth: don't leak which check failed.
    expect(body.error.toLowerCase()).not.toContain('admin')
  })

  it('returns 422 on Zod validation failure (missing developerId)', async () => {
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(422)
  })

  it('returns 422 on invalid UUID developerId', async () => {
    const res = await POST(buildRequest({ developerId: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })

  it('returns 404 when target developer not found', async () => {
    mockDb.limit.mockResolvedValue([])
    const res = await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('idempotent: returns 200 / applied=false when developer is already un-paused', async () => {
    mockDb.limit.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'target@example.com',
        onboardingPaused: false,
      },
    ])
    const res = await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.applied).toBe(false)
    expect(body.reason).toBe('already-unpaused')
    // No DB update was issued in the idempotent path.
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('happy path: 200 / applied=true, flips pause + resolves alerts + audit-logs', async () => {
    mockDb.limit.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'target@example.com',
        onboardingPaused: true,
      },
    ])
    const res = await POST(
      buildRequest({
        developerId: '00000000-0000-0000-0000-000000000001',
        note: 'discussed remediation',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.applied).toBe(true)
    expect(body.reason).toBe('unpaused')
    // Two UPDATEs: developers + chargeback_alerts
    expect(mockDb.update).toHaveBeenCalledTimes(2)
    // Audit log captured admin email + note
    expect(mockWriteAuditLog).toHaveBeenCalled()
    const auditCall = mockWriteAuditLog.mock.calls[0][0]
    expect(auditCall.action).toBe('chargeback.unpause')
    expect(auditCall.details.adminEmail).toBe(ADMIN_EMAIL)
    expect(auditCall.details.note).toBe('discussed remediation')
  })

  it('happy path without note: audit captures note=null', async () => {
    mockDb.limit.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'target@example.com',
        onboardingPaused: true,
      },
    ])
    await POST(
      buildRequest({ developerId: '00000000-0000-0000-0000-000000000001' }),
    )
    const auditCall = mockWriteAuditLog.mock.calls[0][0]
    expect(auditCall.details.note).toBeNull()
  })

  it('rejects note longer than 500 chars (Zod max)', async () => {
    const res = await POST(
      buildRequest({
        developerId: '00000000-0000-0000-0000-000000000001',
        note: 'x'.repeat(501),
      }),
    )
    expect(res.status).toBe(422)
  })
})
