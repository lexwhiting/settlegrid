/**
 * Tests for the developer GDPR Art. 15/20 data-export endpoint:
 *   POST /api/dashboard/developer/data-export
 *
 * G5-2 (gdpr-access-consumer-erase): this is the subject-access / portability
 * export of the developer's OWN personal + business data. It was previously gated
 * to Scale+ (`hasFeature(tier, 'data_export')` → 403 TIER_REQUIRED); the gate is
 * REMOVED so a free-tier developer can exercise the right for free.
 *
 * REVERT TEETH (DC-24): `@/lib/tier-config`.hasFeature is mocked to return FALSE
 * (a free-tier developer lacking data_export) and `@/lib/db` returns a free-tier
 * developer row. The CURRENT (un-gated) route imports NEITHER, so both mocks are
 * inert and a free-tier POST returns 200. If the tier gate is RESTORED, the route
 * re-imports them, hasFeature returns false, and the POST returns 403 → the
 * `expect(200)` / `not 403` assertions go RED. (The paid CSV analytics export at
 * stats/export/route.ts KEEPS its gate — guarded in src/app/api/__tests__/export.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockCheckRateLimit,
  mockRequestDataExport,
  mockProcessDataExport,
  mockSendEmail,
  mockDataExportReadyEmail,
  mockWriteAuditLog,
  mockHasFeature,
} = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ tier: 'free', isFoundingMember: false }]),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockRequestDataExport: vi.fn(),
    mockProcessDataExport: vi.fn(),
    mockSendEmail: vi.fn(),
    mockDataExportReadyEmail: vi.fn(() => ({ subject: 's', html: 'h' })),
    mockWriteAuditLog: vi.fn(),
    // Returns FALSE for a free-tier developer — the pre-G5-2 gate would 403 on this.
    mockHasFeature: vi.fn(() => false),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', tier: 'tier', isFoundingMember: 'is_founding_member' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/settlement/compliance', () => ({
  requestDataExport: mockRequestDataExport,
  processDataExport: mockProcessDataExport,
  ALL_EXPORT_CATEGORIES: ['profile', 'tools', 'invocations', 'payouts', 'webhooks', 'audit_logs'],
}))
vi.mock('@/lib/email', () => ({
  dataExportReadyEmail: mockDataExportReadyEmail,
  sendEmail: mockSendEmail,
}))
vi.mock('@/lib/env', () => ({ getAppUrl: () => 'http://localhost:3005' }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
// Inert for the current (un-gated) route; the RESTORED gate would consult this.
vi.mock('@/lib/tier-config', () => ({ hasFeature: mockHasFeature }))

import { POST } from '../route'

const DEV = { id: 'dev-1', email: 'dev@example.com' }

function postReq(body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/dashboard/developer/data-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockRequireDeveloper.mockResolvedValue(DEV)
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.limit.mockResolvedValue([{ tier: 'free', isFoundingMember: false }])
  mockRequestDataExport.mockResolvedValue({ id: 'export-1', status: 'pending' })
  mockProcessDataExport.mockResolvedValue({ status: 'completed', resultUrl: 'data:application/json;base64,e30=' })
  mockSendEmail.mockResolvedValue(true)
  mockWriteAuditLog.mockResolvedValue(undefined)
  mockHasFeature.mockReturnValue(false)
})

describe('POST /api/dashboard/developer/data-export — G5-2 un-gate', () => {
  it('a FREE-tier developer is NOT 403 — the export runs (RED if the tier gate is restored)', async () => {
    const res = await POST(postReq())
    const body = await res.json()
    // The load-bearing G5-2 assertion: a free-tier developer succeeds.
    expect(res.status).toBe(200)
    expect(res.status).not.toBe(403)
    expect(body.success).toBe(true)
    expect(body.exportId).toBe('export-1')
    expect(mockProcessDataExport).toHaveBeenCalledTimes(1)
  })

  it('drives the export for the authenticated developer (self-scope) + sends the ready email', async () => {
    const res = await POST(postReq())
    expect(res.status).toBe(200)
    expect(mockRequestDataExport).toHaveBeenCalledWith('provider', DEV.id)
    expect(mockDataExportReadyEmail).toHaveBeenCalledWith(DEV.email, expect.stringContaining('export-1'))
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: DEV.email }))
  })

  it('does NOT consult a tier gate at all (the un-gate removed the hasFeature check)', async () => {
    await POST(postReq())
    // The un-gated route never calls hasFeature; a revert re-introduces it (→ 403).
    expect(mockHasFeature).not.toHaveBeenCalled()
  })

  it('401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))
    const res = await POST(postReq())
    expect(res.status).toBe(401)
    expect(mockProcessDataExport).not.toHaveBeenCalled()
  })

  it('429 when the per-user rate limit is exceeded', async () => {
    // First (IP) bucket ok, second (uid) bucket exceeded.
    mockCheckRateLimit
      .mockResolvedValueOnce({ success: true, limit: 100, remaining: 99, reset: 0 })
      .mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 60 })
    const res = await POST(postReq())
    expect(res.status).toBe(429)
    expect(mockProcessDataExport).not.toHaveBeenCalled()
  })
})
