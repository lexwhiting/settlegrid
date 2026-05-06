/**
 * /api/payouts/trigger safety tests — concurrency hardening from
 * P5.PAYOUTS-1 (commit XXXX). The trigger route now serializes each
 * developer's payout via SELECT FOR UPDATE inside db.transaction(),
 * uses a Stripe idempotency key, and restores balance + marks the
 * payout failed in a single transaction when the Stripe call throws.
 *
 * These tests are the regression guard. If any of them fail, real
 * money correctness is at risk: either the developer is undercredited
 * (balance lost on Stripe failure), the same payout fires twice
 * (idempotency key gone), or two concurrent triggers both succeed
 * (mutex broken).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockStripeTransfers } = vi.hoisted(() => {
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

  return {
    mockDb,
    mockRequireDeveloper: vi
      .fn()
      .mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockStripeTransfers,
  }
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

vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))

vi.mock('stripe', () => ({
  default: vi
    .fn()
    .mockImplementation(() => ({ transfers: mockStripeTransfers })),
}))

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
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

import { POST as triggerPayout } from '@/app/api/payouts/trigger/route'

function makeRequest(url: string, method: string = 'POST', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Payout Safety (concurrency + transactional rollback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.for.mockReturnThis()
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb),
    )
    mockStripeTransfers.create.mockResolvedValue({ id: 'tr_test_123' })
  })

  it('creates payout with processing status then transitions to completed', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        balanceCents: 5000,
        stripeConnectId: 'acct_test_123',
        stripeConnectStatus: 'active',
        payoutMinimumCents: 100,
      },
    ])

    mockDb.returning.mockResolvedValueOnce([
      {
        id: 'payout-1',
        amountCents: 5000,
        platformFeeCents: 0,
        createdAt: new Date().toISOString(),
      },
    ])

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payout.status).toBe('completed')
    expect(data.payout.stripeTransferId).toBe('tr_test_123')

    // The completion update transitioned the row from 'processing' →
    // 'completed' with the Stripe transfer id stamped in.
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        stripeTransferId: 'tr_test_123',
      }),
    )
  })

  it('rolls back balance + marks payout failed when Stripe transfer throws', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        balanceCents: 5000,
        stripeConnectId: 'acct_test_123',
        stripeConnectStatus: 'active',
        payoutMinimumCents: 100,
      },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: 'payout-1',
        amountCents: 5000,
        platformFeeCents: 0,
        createdAt: new Date().toISOString(),
      },
    ])

    mockStripeTransfers.create.mockRejectedValueOnce(
      new Error('Insufficient funds in Stripe account'),
    )

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('STRIPE_TRANSFER_FAILED')
    expect(data.error).toContain('Insufficient funds')

    // The rollback update marked the payout 'failed' with the error
    // message preserved for forensic reconciliation.
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Insufficient funds in Stripe account',
      }),
    )

    // Two transactions: preflight (zero balance) + rollback (restore
    // balance + mark failed). If only one fired, balance was zeroed
    // without a Stripe transfer — money lost.
    expect(mockDb.transaction).toHaveBeenCalledTimes(2)
  })

  it('passes a deterministic idempotency key on Stripe transfers.create', async () => {
    // Idempotency key = `payout:${payoutRecord.id}`. Stripe dedupes
    // on this for 24h, so a Vercel cron retry or transient network
    // error doesn't produce a duplicate transfer.
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        balanceCents: 3000,
        stripeConnectId: 'acct_test_456',
        stripeConnectStatus: 'active',
        payoutMinimumCents: 100,
      },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: 'payout-99',
        amountCents: 3000,
        platformFeeCents: 0,
        createdAt: new Date().toISOString(),
      },
    ])

    const request = makeRequest('/api/payouts/trigger')
    await triggerPayout(request)

    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        currency: 'usd',
        destination: 'acct_test_456',
        metadata: expect.objectContaining({ payoutId: 'payout-99' }),
      }),
      expect.objectContaining({ idempotencyKey: 'payout:payout-99' }),
    )
  })

  it('marks Connect as needs_reconnect on terminal Stripe account errors', async () => {
    // account_invalid means the developer's connected account is dead.
    // We flip stripeConnectStatus so the cron stops retrying daily,
    // and surface NEEDS_RECONNECT to prompt re-onboarding.
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        balanceCents: 5000,
        stripeConnectId: 'acct_dead',
        stripeConnectStatus: 'active',
        payoutMinimumCents: 100,
      },
    ])
    mockDb.returning.mockResolvedValueOnce([
      {
        id: 'payout-deadacct',
        amountCents: 5000,
        platformFeeCents: 0,
        createdAt: new Date().toISOString(),
      },
    ])

    const stripeErr = Object.assign(new Error('No such account'), {
      code: 'account_invalid',
    })
    mockStripeTransfers.create.mockRejectedValueOnce(stripeErr)

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('NEEDS_RECONNECT')

    // The rollback transaction also flipped the connect status.
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeConnectStatus: 'needs_reconnect' }),
    )
  })

  it('returns 409 PAYOUT_IN_PROGRESS when partial unique index rejects a concurrent INSERT', async () => {
    // Migration 0009 created a partial unique index on
    // payouts(developer_id) WHERE status='processing'. A second
    // concurrent attempt for the same developer hits a 23505
    // unique_violation. The route catches that specific constraint
    // name and returns 409 — anything else propagates.
    const collision = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'payouts_one_processing_per_dev',
    })
    mockDb.transaction.mockRejectedValueOnce(collision)

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('PAYOUT_IN_PROGRESS')
  })
})
