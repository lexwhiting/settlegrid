import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockStripeTransfers } = vi.hoisted(() => {
  const mockDb = {
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
  }

  const mockStripeTransfers = {
    create: vi.fn().mockResolvedValue({ id: 'tr_test_123' }),
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockStripeTransfers,
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

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
    balanceCents: 'balance_cents',
    revenueSharePct: 'revenue_share_pct',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    payoutMinimumCents: 'payout_minimum_cents',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    transfers: mockStripeTransfers,
  })),
}))

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
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

describe('Payout Safety (Transaction Wrapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockStripeTransfers.create.mockResolvedValue({ id: 'tr_test_123' })
  })

  it('creates payout with processing status then completes', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      revenueSharePct: 95,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    // First returning = payout insert (processing)
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-1',
      amountCents: 5000,
      platformFeeCents: 263,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payout.status).toBe('completed')
    expect(data.payout.stripeTransferId).toBe('tr_test_123')

    // Verify update was called (to mark completed + reset balance)
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', stripeTransferId: 'tr_test_123' })
    )
  })

  it('marks payout as failed when Stripe transfer fails', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      revenueSharePct: 95,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    // Payout insert (processing)
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-1',
      amountCents: 5000,
      platformFeeCents: 263,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }])

    // Stripe transfer fails
    mockStripeTransfers.create.mockRejectedValueOnce(new Error('Insufficient funds in Stripe account'))

    const request = makeRequest('/api/payouts/trigger')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('STRIPE_TRANSFER_FAILED')
    expect(data.error).toContain('Insufficient funds')

    // Verify payout was updated to 'failed' with error message
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Insufficient funds in Stripe account',
      })
    )
  })

  it('does not reset developer balance on Stripe failure', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      revenueSharePct: 95,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-1',
      amountCents: 5000,
      platformFeeCents: 263,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }])

    mockStripeTransfers.create.mockRejectedValueOnce(new Error('Network error'))

    const request = makeRequest('/api/payouts/trigger')
    await triggerPayout(request)

    // Balance should NOT be reset to 0 — verify that set({balanceCents: 0}) was NOT called
    const setCalls = mockDb.set.mock.calls
    const balanceResetCall = setCalls.find(
      (call) => call[0]?.balanceCents === 0
    )
    expect(balanceResetCall).toBeUndefined()
  })

  it('includes payout ID in Stripe transfer metadata', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 3000,
      revenueSharePct: 95,
      stripeConnectId: 'acct_test_456',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-99',
      amountCents: 3000,
      platformFeeCents: 157,
      status: 'processing',
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger')
    await triggerPayout(request)

    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        currency: 'usd',
        destination: 'acct_test_456',
        metadata: expect.objectContaining({ payoutId: 'payout-99' }),
      })
    )
  })
})
