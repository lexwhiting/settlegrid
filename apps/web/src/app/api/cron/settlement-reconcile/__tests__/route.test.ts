/**
 * B1.4 — settlement-reconcile cron handler. Cron-secret auth gating + delegates
 * to reconcilePendingSettlements and returns its summary. (The reconcile logic
 * itself is covered by reconcile.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockGetCronSecret, mockReconcile } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockGetCronSecret: vi.fn(),
  mockReconcile: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit, getClientIp: (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip' }))
vi.mock('@/lib/env', () => ({ getCronSecret: mockGetCronSecret }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/settlement/reconcile', () => ({ reconcilePendingSettlements: mockReconcile }))

import { GET } from '../route'
// Mocked above — imported for the done-log assertion.
import { logger } from '@/lib/logger'

function req(auth?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (auth) headers['authorization'] = auth
  return new NextRequest('http://localhost/api/cron/settlement-reconcile', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  mockGetCronSecret.mockReturnValue('test-secret')
  mockReconcile.mockResolvedValue({
    scanned: 0, settled: 0, failed: 0, pending: 0, skipped: 0,
    noop: 0, errored: 0, deferred: 0, overdue: 0, outcomes: {},
  })
})

describe('settlement-reconcile cron', () => {
  it('401 without the cron-secret bearer (and never reconciles) — and leaves a Sentry-mirrored trail (③: a dead cron must not be silent)', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockReconcile).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'cron.settlement_reconcile.unauthorized',
      expect.objectContaining({ ip: expect.any(String) }),
    )
  })

  it('500 when CRON_SECRET is unset (and never reconciles)', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await GET(req('Bearer anything'))
    expect(res.status).toBe(500)
    expect(mockReconcile).not.toHaveBeenCalled()
  })

  it('runs the reconciler and returns its summary when authorized — done-log carries the (S) truthful-telemetry fields', async () => {
    mockReconcile.mockResolvedValue({
      scanned: 5, settled: 2, failed: 1, pending: 0, skipped: 0,
      noop: 1, errored: 1, deferred: 1, overdue: 3, outcomes: {},
    })
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scanned).toBe(5)
    expect(body.settled).toBe(2)
    expect(body.noop).toBe(1)
    expect(body.errored).toBe(1)
    expect(body.overdue).toBe(3)
    expect(mockReconcile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'cron.settlement_reconcile.done',
      expect.objectContaining({ scanned: 5, settled: 2, noop: 1, errored: 1, overdue: 3, deferred: 1 }),
    )
  })
})
