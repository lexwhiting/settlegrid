/**
 * P5.PAYOUTS-4 — Daily payout cron tests.
 *
 * The cron handler is small but the failure modes are critical — a
 * crashed run leaves money sitting in dev balances; a careless run
 * could double-pay or fire-and-forget when the platform is short.
 *
 * Coverage:
 *   - 401 without Bearer secret
 *   - 500 if CRON_SECRET unset
 *   - happy path: ≥1 eligible dev, all succeed, returns counts
 *   - one dev's processPayout failure does NOT block another's success
 *   - 503 INSUFFICIENT_PLATFORM_BALANCE when Stripe available < eligible total
 *   - 503 BALANCE_CHECK_FAILED when stripe.balance.retrieve throws
 *   - empty eligible list → 200 with zero counts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockProcessPayout,
  mockGetCronSecret,
  mockStripeBalanceRetrieve,
  mockCheckRateLimit,
} = vi.hoisted(() => {
  const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // eligible-select resolves here
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]), // orphan-update resolves here
  }
  return {
    mockDb,
    mockProcessPayout: vi.fn(),
    mockGetCronSecret: vi.fn().mockReturnValue('test-secret'),
    mockStripeBalanceRetrieve: vi.fn().mockResolvedValue({
      available: [{ currency: 'usd', amount: 100_000_000 }],
    }),
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    balanceCents: 'balance_cents',
    payoutMinimumCents: 'payout_minimum_cents',
    stripeConnectStatus: 'stripe_connect_status',
  },
  payouts: {
    id: 'id',
    developerId: 'developer_id',
    createdAt: 'created_at',
    status: 'status',
    errorMessage: 'error_message',
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: mockGetCronSecret,
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
}))

vi.mock('@/lib/payouts/process', () => ({ processPayout: mockProcessPayout }))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    balance: { retrieve: mockStripeBalanceRetrieve },
  })),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings, values,
    })),
    { raw: vi.fn() },
  ),
}))

import { GET as processPayoutsCron } from '@/app/api/cron/process-payouts/route'

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/process-payouts', {
    method: 'GET',
    headers,
  })
}

describe('GET /api/cron/process-payouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.returning.mockResolvedValue([])
    mockGetCronSecret.mockReturnValue('test-secret')
    mockCheckRateLimit.mockResolvedValue({ success: true })
    mockStripeBalanceRetrieve.mockResolvedValue({
      available: [{ currency: 'usd', amount: 100_000_000 }],
    })
  })

  it('returns 401 without Bearer secret', async () => {
    const res = await processPayoutsCron(makeReq())
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 with wrong Bearer secret', async () => {
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(undefined as unknown as string)
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer anything' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 200 with zero counts when no eligible developers', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processedCount).toBe(0)
    expect(data.succeededCount).toBe(0)
    expect(data.failedCount).toBe(0)
    // Stripe balance not even consulted when nothing to pay out.
    expect(mockStripeBalanceRetrieve).not.toHaveBeenCalled()
  })

  it('happy path: 2 developers eligible, both succeed', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'dev-a', balanceCents: 50000 },
      { id: 'dev-b', balanceCents: 30000 },
    ])
    mockProcessPayout
      .mockResolvedValueOnce({
        ok: true, payoutId: 'p-a', amountCents: 50000, platformFeeCents: 0,
        grossCents: 50000, stripeTransferId: 'tr_a', createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        ok: true, payoutId: 'p-b', amountCents: 30000, platformFeeCents: 0,
        grossCents: 30000, stripeTransferId: 'tr_b', createdAt: new Date(),
      })

    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processedCount).toBe(2)
    expect(data.succeededCount).toBe(2)
    expect(data.failedCount).toBe(0)
    expect(mockProcessPayout).toHaveBeenCalledTimes(2)
    // Each dev called with trigger='cron'.
    expect(mockProcessPayout).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ developerId: 'dev-a', trigger: 'cron' }))
    expect(mockProcessPayout).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ developerId: 'dev-b', trigger: 'cron' }))
  })

  it('one dev failure does NOT block another dev success', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'dev-bad', balanceCents: 5000 },
      { id: 'dev-good', balanceCents: 7000 },
    ])
    mockProcessPayout
      .mockResolvedValueOnce({
        ok: false, errorCode: 'NEEDS_RECONNECT',
        errorMessage: 'account_invalid', httpStatus: 502,
      })
      .mockResolvedValueOnce({
        ok: true, payoutId: 'p-good', amountCents: 7000, platformFeeCents: 0,
        grossCents: 7000, stripeTransferId: 'tr_good', createdAt: new Date(),
      })

    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processedCount).toBe(2)
    expect(data.succeededCount).toBe(1)
    expect(data.failedCount).toBe(1)
    expect(data.outcomes).toEqual([
      expect.objectContaining({ developerId: 'dev-bad', ok: false, errorCode: 'NEEDS_RECONNECT' }),
      expect.objectContaining({ developerId: 'dev-good', ok: true, amountCents: 7000 }),
    ])
  })

  it('thrown error inside processPayout does NOT crash the run', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: 'dev-throw', balanceCents: 5000 },
      { id: 'dev-ok', balanceCents: 5000 },
    ])
    mockProcessPayout
      .mockRejectedValueOnce(new Error('unexpected'))
      .mockResolvedValueOnce({
        ok: true, payoutId: 'p-ok', amountCents: 5000, platformFeeCents: 0,
        grossCents: 5000, stripeTransferId: 'tr_ok', createdAt: new Date(),
      })

    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.failedCount).toBe(1)
    expect(data.succeededCount).toBe(1)
    expect(data.outcomes[0]).toEqual(expect.objectContaining({
      developerId: 'dev-throw', ok: false, errorCode: 'INTERNAL',
    }))
  })

  it('returns 503 INSUFFICIENT_PLATFORM_BALANCE when Stripe balance < eligible total', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'dev-a', balanceCents: 200_000 }])
    mockStripeBalanceRetrieve.mockResolvedValueOnce({
      available: [{ currency: 'usd', amount: 100_000 }], // half of needed
    })
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.code).toBe('INSUFFICIENT_PLATFORM_BALANCE')
    // Critically: we must NOT have called processPayout when balance is short.
    expect(mockProcessPayout).not.toHaveBeenCalled()
  })

  it('returns 503 BALANCE_CHECK_FAILED when stripe.balance.retrieve throws', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'dev-a', balanceCents: 5000 }])
    mockStripeBalanceRetrieve.mockRejectedValueOnce(new Error('Stripe down'))
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.code).toBe('BALANCE_CHECK_FAILED')
    expect(mockProcessPayout).not.toHaveBeenCalled()
  })

  it('429 when rate-limited (auth pattern parity with sibling crons)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false })
    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(429)
  })

  it('orphan-row cleanup: marks stuck processing rows older than 24h as failed', async () => {
    // Step 0 of the cron: a stuck row from a prior run blocks the
    // partial unique index for that developer. The cron pre-marks
    // such rows 'failed' so the next preflight INSERT can succeed.
    mockDb.returning.mockResolvedValueOnce([
      { id: 'orphan-1' },
      { id: 'orphan-2' },
    ])
    mockDb.limit.mockResolvedValueOnce([])

    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    // The UPDATE was issued.
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: expect.stringContaining('auto-released'),
      }),
    )
  })

  it('balance pre-flight uses NET, not gross (so platform fee held back is not double-counted)', async () => {
    // Balance = 200_000 → progressive take = 2000 (2% over $1K) →
    // net payout = 198_000. Platform balance of 200_000 should be
    // SUFFICIENT (we only need 198_000), not insufficient.
    mockDb.limit.mockResolvedValueOnce([{ id: 'dev-x', balanceCents: 200_000 }])
    mockStripeBalanceRetrieve.mockResolvedValueOnce({
      available: [{ currency: 'usd', amount: 198_500 }],
    })
    mockProcessPayout.mockResolvedValueOnce({
      ok: true, payoutId: 'p-x', amountCents: 198_000, platformFeeCents: 2000,
      grossCents: 200_000, stripeTransferId: 'tr_x', createdAt: new Date(),
    })

    const res = await processPayoutsCron(makeReq({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.succeededCount).toBe(1)
  })
})
