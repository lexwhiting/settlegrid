/**
 * P3.RAIL3 — Tests for POST /api/payouts/schedule.
 *
 * Covers the route's decision tree: rate-limit, auth, Zod validation,
 * "no Stripe account" 409, Stripe error → 502, success path persists
 * cache + audit-log.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockRequireDeveloper,
  mockUpdatePayoutSchedule,
  mockGetStripeClient,
  mockWriteAuditLog,
  mockCheckRateLimit,
  FakeInvalidPayoutScheduleError,
} = vi.hoisted(() => {
  class FakeInvalidPayoutScheduleError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'InvalidPayoutScheduleError'
    }
  }
  return {
    mockDb: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
    mockRequireDeveloper: vi
      .fn()
      .mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockUpdatePayoutSchedule: vi.fn(),
    mockGetStripeClient: vi.fn().mockReturnValue({}),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true }),
    FakeInvalidPayoutScheduleError,
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    stripeConnectId: 'stripe_connect_id',
    payoutSchedule: 'payout_schedule',
    payoutScheduleWeekday: 'payout_schedule_weekday',
    payoutScheduleMonthDay: 'payout_schedule_month_day',
    payoutScheduleSyncedAt: 'payout_schedule_synced_at',
    updatedAt: 'updated_at',
  },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/rails', () => ({ getStripeClient: mockGetStripeClient }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@settlegrid/rails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@settlegrid/rails')>()
  return {
    ...actual,
    updatePayoutSchedule: mockUpdatePayoutSchedule,
    InvalidPayoutScheduleError: FakeInvalidPayoutScheduleError,
  }
})

import { POST } from '@/app/api/payouts/schedule/route'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/payouts/schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/payouts/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true })
    mockRequireDeveloper.mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false })
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('returns 401 when auth fails', async () => {
    mockRequireDeveloper.mockRejectedValue(new Error('not signed in'))
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 422 on Zod validation failure (missing weekday for weekly)', async () => {
    const res = await POST(buildRequest({ interval: 'weekly' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 on out-of-range monthDay', async () => {
    const res = await POST(buildRequest({ interval: 'monthly', monthDay: 32 }))
    expect(res.status).toBe(422)
  })

  it('returns 404 when developer record missing post-auth (race)', async () => {
    mockDb.limit.mockResolvedValue([])
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('returns 409 NO_STRIPE_ACCOUNT when developer has no Connect ID', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeConnectId: null,
        payoutSchedule: 'monthly',
        payoutScheduleWeekday: null,
        payoutScheduleMonthDay: 1,
      },
    ])
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('NO_STRIPE_ACCOUNT')
  })

  it('returns 400 INVALID_PAYOUT_SCHEDULE when rails helper rejects', async () => {
    mockDb.limit.mockResolvedValue([
      { stripeConnectId: 'acct_x', payoutSchedule: 'monthly', payoutScheduleWeekday: null, payoutScheduleMonthDay: 1 },
    ])
    mockUpdatePayoutSchedule.mockRejectedValue(
      new FakeInvalidPayoutScheduleError('bad shape'),
    )
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_PAYOUT_SCHEDULE')
  })

  it('returns 502 STRIPE_ERROR when Stripe write throws (not InvalidPayoutScheduleError)', async () => {
    mockDb.limit.mockResolvedValue([
      { stripeConnectId: 'acct_x', payoutSchedule: 'monthly', payoutScheduleWeekday: null, payoutScheduleMonthDay: 1 },
    ])
    mockUpdatePayoutSchedule.mockRejectedValue(new Error('Stripe network blip'))
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('STRIPE_ERROR')
    // The error message must NOT leak the underlying Stripe error
    expect(body.error).not.toContain('Stripe network blip')
  })

  it('happy path: 200, persists cache, writes audit log', async () => {
    mockDb.limit.mockResolvedValue([
      { stripeConnectId: 'acct_x', payoutSchedule: 'monthly', payoutScheduleWeekday: null, payoutScheduleMonthDay: 1 },
    ])
    mockUpdatePayoutSchedule.mockResolvedValue({
      updated: true,
      schedule: { interval: 'weekly', weekly_anchor: 'monday' },
      reason: 'applied',
    })
    const res = await POST(buildRequest({ interval: 'weekly', weekday: 'monday' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.applied).toBe(true)
    expect(body.interval).toBe('weekly')
    expect(body.weekday).toBe('monday')
    // Persistence + audit-log were called.
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockWriteAuditLog).toHaveBeenCalled()
  })

  it('idempotent path: applied=false when helper reports no-op', async () => {
    mockDb.limit.mockResolvedValue([
      { stripeConnectId: 'acct_x', payoutSchedule: 'daily', payoutScheduleWeekday: null, payoutScheduleMonthDay: null },
    ])
    mockUpdatePayoutSchedule.mockResolvedValue({
      updated: false,
      schedule: { interval: 'daily' },
      reason: 'already-current',
    })
    const res = await POST(buildRequest({ interval: 'daily' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.applied).toBe(false)
  })
})
