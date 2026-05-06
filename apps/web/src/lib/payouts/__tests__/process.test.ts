/**
 * P5.PAYOUTS-3 — `processPayout` helper tests.
 *
 * Covers every branch of the typed result:
 *   ok:true (happy path)
 *   ok:false NOT_FOUND
 *   ok:false STRIPE_NOT_ACTIVE
 *   ok:false NO_STRIPE_ACCOUNT
 *   ok:false BELOW_MINIMUM
 *   ok:false PAYOUT_IN_PROGRESS (partial-unique-index 23505 collision)
 *   ok:false STRIPE_TRANSFER_FAILED (non-terminal Stripe error → balance restored)
 *   ok:false NEEDS_RECONNECT (account_invalid → connect status flipped)
 *   ok:false INTERNAL (preflight transaction throws unrelated error)
 *
 * Identical mock pattern to payouts.test.ts so behavior parity
 * between the route + helper is testable side-by-side.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockStripeTransfers } = vi.hoisted(() => {
  const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
  }
  mockDb.transaction = vi.fn().mockImplementation(async (fn) => fn(mockDb))

  const mockStripeTransfers = {
    create: vi.fn().mockResolvedValue({ id: 'tr_test_123' }),
  }

  return { mockDb, mockStripeTransfers }
})

vi.mock('@/lib/db', () => ({ db: mockDb, schema: {} }))

vi.mock('@/lib/db/schema', () => ({
  payouts: {
    id: 'id',
    developerId: 'developer_id',
    amountCents: 'amount_cents',
    platformFeeCents: 'platform_fee_cents',
    stripeTransferId: 'stripe_transfer_id',
    periodStart: 'period_start',
    periodEnd: 'period_end',
    status: 'status',
    errorMessage: 'error_message',
    createdAt: 'created_at',
  },
  developers: {
    id: 'id',
    email: 'email',
    name: 'name',
    balanceCents: 'balance_cents',
    revenueSharePct: 'revenue_share_pct',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    payoutMinimumCents: 'payout_minimum_cents',
    updatedAt: 'updated_at',
  },
  auditLogs: {
    id: 'id',
    developerId: 'developer_id',
    action: 'action',
    resourceType: 'resource_type',
    resourceId: 'resource_id',
    details: 'details',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    createdAt: 'created_at',
  },
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({ transfers: mockStripeTransfers })),
}))

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() },
  ),
}))

import { processPayout } from '@/lib/payouts/process'

describe('processPayout — typed result for every branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
    mockDb.for.mockReturnThis()
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb),
    )
    mockStripeTransfers.create.mockResolvedValue({ id: 'tr_test_123' })
  })

  it('ok:true on happy path with progressive take applied', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-1',
      email: 'dev@example.com',
      name: 'Dev',
      balanceCents: 200000, // $2000 → $20 fee, $1980 payout
      stripeConnectId: 'acct_x',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
      createdAt: new Date('2026-01-01'),
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-1',
      amountCents: 198000,
      platformFeeCents: 2000,
      createdAt: new Date(),
    }])

    const result = await processPayout({ developerId: 'dev-1', trigger: 'manual' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.amountCents).toBe(198000)
      expect(result.platformFeeCents).toBe(2000)
      expect(result.grossCents).toBe(200000)
      expect(result.stripeTransferId).toBe('tr_test_123')
    }
  })

  it('ok:false NOT_FOUND when developer row missing', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const result = await processPayout({ developerId: 'ghost', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('NOT_FOUND')
      expect(result.httpStatus).toBe(404)
    }
  })

  it('ok:false STRIPE_NOT_ACTIVE when connect status is pending', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-2', email: 'd@e.com', name: null, balanceCents: 5000,
      stripeConnectId: 'acct', stripeConnectStatus: 'pending', payoutMinimumCents: 100,
    }])
    const result = await processPayout({ developerId: 'dev-2', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('STRIPE_NOT_ACTIVE')
      expect(result.httpStatus).toBe(400)
    }
  })

  it('ok:false NO_STRIPE_ACCOUNT when stripeConnectId is null', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-3', email: 'd@e.com', name: null, balanceCents: 5000,
      stripeConnectId: null, stripeConnectStatus: 'active', payoutMinimumCents: 100,
    }])
    const result = await processPayout({ developerId: 'dev-3', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorCode).toBe('NO_STRIPE_ACCOUNT')
  })

  it('ok:false BELOW_MINIMUM when balance under threshold', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-4', email: 'd@e.com', name: null, balanceCents: 50,
      stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
    }])
    const result = await processPayout({ developerId: 'dev-4', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorCode).toBe('BELOW_MINIMUM')
  })

  it('ok:false PAYOUT_IN_PROGRESS when partial-unique-index rejects concurrent INSERT', async () => {
    const collision = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'payouts_one_processing_per_dev',
    })
    mockDb.transaction.mockRejectedValueOnce(collision)
    const result = await processPayout({ developerId: 'dev-5', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('PAYOUT_IN_PROGRESS')
      expect(result.httpStatus).toBe(409)
    }
  })

  it('ok:false STRIPE_TRANSFER_FAILED + balance restored when Stripe throws non-terminal error', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-6', email: 'd@e.com', name: null, balanceCents: 5000,
      stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
      createdAt: new Date('2026-01-01'),
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-failed', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])
    mockStripeTransfers.create.mockRejectedValueOnce(new Error('Insufficient funds'))

    const result = await processPayout({ developerId: 'dev-6', trigger: 'cron' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('STRIPE_TRANSFER_FAILED')
      expect(result.httpStatus).toBe(502)
    }
    // 2 transactions = preflight + rollback. If only 1, balance was lost.
    expect(mockDb.transaction).toHaveBeenCalledTimes(2)
  })

  it('ok:false NEEDS_RECONNECT on terminal account_invalid Stripe error', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-7', email: 'd@e.com', name: null, balanceCents: 5000,
      stripeConnectId: 'acct_dead', stripeConnectStatus: 'active', payoutMinimumCents: 100,
      createdAt: new Date('2026-01-01'),
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-dead', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])
    mockStripeTransfers.create.mockRejectedValueOnce(
      Object.assign(new Error('No such account'), { code: 'account_invalid' }),
    )

    const result = await processPayout({ developerId: 'dev-7', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('NEEDS_RECONNECT')
      expect(result.httpStatus).toBe(502)
    }
    // The rollback set stripeConnectStatus to 'needs_reconnect'.
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeConnectStatus: 'needs_reconnect' }),
    )
  })

  it('ok:false INTERNAL when preflight transaction throws unrelated error', async () => {
    mockDb.transaction.mockRejectedValueOnce(new Error('connection lost'))
    const result = await processPayout({ developerId: 'dev-8', trigger: 'cron' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL')
      expect(result.httpStatus).toBe(500)
    }
  })

  it('passes deterministic idempotency key to Stripe', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-9', email: 'd@e.com', name: null, balanceCents: 3000,
      stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
      createdAt: new Date('2026-01-01'),
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-key', amountCents: 3000, platformFeeCents: 0, createdAt: new Date(),
    }])

    await processPayout({ developerId: 'dev-9', trigger: 'manual' })
    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, destination: 'acct' }),
      expect.objectContaining({ idempotencyKey: 'payout:payout-key' }),
    )
  })

  it('periodStart derives from previous completed payout periodEnd', async () => {
    // Developer SELECT returns the dev row, then the previous-payout
    // SELECT returns a completed payout whose periodEnd should become
    // the new payout's periodStart.
    const prevPeriodEnd = new Date('2026-04-01T00:00:00Z')
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'dev-period', email: 'd@e.com', name: null, balanceCents: 5000,
        stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      }])
      .mockResolvedValueOnce([{ periodEnd: prevPeriodEnd }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-period', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])

    const result = await processPayout({ developerId: 'dev-period', trigger: 'manual' })
    expect(result.ok).toBe(true)
    // Confirm the INSERT received periodStart equal to the previous periodEnd.
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: prevPeriodEnd }),
    )
  })

  it('periodStart falls back to developers.createdAt when no previous payout exists', async () => {
    const devCreatedAt = new Date('2026-01-15T00:00:00Z')
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'dev-first', email: 'd@e.com', name: null, balanceCents: 5000,
        stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
        createdAt: devCreatedAt,
      }])
      .mockResolvedValueOnce([]) // no previous payout
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-first', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])

    const result = await processPayout({ developerId: 'dev-first', trigger: 'manual' })
    expect(result.ok).toBe(true)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: devCreatedAt }),
    )
  })

  it('completion UPDATE retries (initial + 3 backoff retries; 4th attempt wins) → ok:true', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'dev-retry', email: 'd@e.com', name: null, balanceCents: 5000,
        stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
        createdAt: new Date('2026-01-01'),
      }])
      .mockResolvedValueOnce([])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-retry', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])

    // Each db.update() returns a chain whose terminal .where() is
    // awaited. We swap the chain per call:
    //   call 1: preflight balance debit (success)
    //   call 2: completion attempt 1 (reject)
    //   call 3: completion attempt 2 (reject)
    //   call 4: completion attempt 3 (reject)
    //   call 5: completion attempt 4 (success — wins; no fallback runs)
    const chainSuccess = () => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })
    const chainReject = (err: string) => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error(err)) }) })
    mockDb.update
      .mockReturnValueOnce(chainSuccess()) // preflight
      .mockReturnValueOnce(chainReject('blip 1'))
      .mockReturnValueOnce(chainReject('blip 2'))
      .mockReturnValueOnce(chainReject('blip 3'))
      .mockReturnValueOnce(chainSuccess()) // attempt 4 wins

    const result = await processPayout({ developerId: 'dev-retry', trigger: 'manual' })
    expect(result.ok).toBe(true)
  })

  it('completion UPDATE exhausts all 4 attempts AND fallback → PAYOUT_PARTIAL_SUCCESS (200)', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{
        id: 'dev-exhaust', email: 'd@e.com', name: null, balanceCents: 5000,
        stripeConnectId: 'acct', stripeConnectStatus: 'active', payoutMinimumCents: 100,
        createdAt: new Date('2026-01-01'),
      }])
      .mockResolvedValueOnce([])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'p-exhaust', amountCents: 5000, platformFeeCents: 0, createdAt: new Date(),
    }])

    // Preflight succeeds, ALL 4 completion attempts AND the
    // single-column fallback all reject. 6 mocks total.
    const chainSuccess = () => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })
    const chainReject = (err: string) => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error(err)) }) })
    mockDb.update
      .mockReturnValueOnce(chainSuccess()) // preflight
      .mockReturnValueOnce(chainReject('blip 1'))
      .mockReturnValueOnce(chainReject('blip 2'))
      .mockReturnValueOnce(chainReject('blip 3'))
      .mockReturnValueOnce(chainReject('blip 4'))
      .mockReturnValueOnce(chainReject('fallback fails too'))

    const result = await processPayout({ developerId: 'dev-exhaust', trigger: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('PAYOUT_PARTIAL_SUCCESS')
      expect(result.httpStatus).toBe(200)
      expect(result.errorMessage).toContain('tr_test_123')
      expect(result.errorMessage).toContain('24 hours')
    }
  })
})
