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
    // FOR UPDATE row-lock support — the trigger route uses
    // .for('update') inside its preflight transaction.
    for: vi.fn().mockReturnThis(),
  }
  // The trigger route wraps preflight + rollback in db.transaction().
  // We pass the same mockDb back as `tx` so chained calls inside the
  // transaction hit the same mock state the test sets up.
  mockDb.transaction = vi.fn().mockImplementation(async (fn) => fn(mockDb))

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
    email: 'email',
    name: 'name',
    balanceCents: 'balance_cents',
    revenueSharePct: 'revenue_share_pct',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    payoutMinimumCents: 'payout_minimum_cents',
    updatedAt: 'updated_at',
  },
  // The trigger route writes audit logs via writeAuditLog → which
  // transitively imports auditLogs from this module. Leaving it
  // undefined produces stderr noise on every payouts test run.
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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

import { GET as listPayouts } from '@/app/api/payouts/route'
import { POST as triggerPayout } from '@/app/api/payouts/trigger/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('List Payouts (GET /api/payouts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
  })

  it('returns empty payouts list', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/payouts')
    const response = await listPayouts(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payouts).toHaveLength(0)
  })

  it('returns payouts for authenticated developer', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'payout-1',
        amountCents: 5000,
        platformFeeCents: 1250,
        stripeTransferId: 'tr_123',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
    ])

    const request = makeRequest('/api/payouts')
    const response = await listPayouts(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payouts).toHaveLength(1)
    expect(data.payouts[0].amountCents).toBe(5000)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/payouts')
    const response = await listPayouts(request)

    expect(response.status).toBe(401)
  })
})

describe('Trigger Payout (POST /api/payouts/trigger)', () => {
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
    // Re-bind the transaction implementation; vi.clearAllMocks wipes it.
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb),
    )
  })

  it('triggers payout for developer with sufficient balance (under $1K bracket = 0% take)', async () => {
    // $50 balance is under the first progressive bracket ($1K) — take = 0,
    // payout = full balance. Verifies the canonical happy path for >99%
    // of MVP-stage developers.
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents: 5000,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-new',
      amountCents: 5000,
      platformFeeCents: 0,
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payout).toBeDefined()
    expect(data.payout.amountCents).toBe(5000)
    expect(data.payout.platformFeeCents).toBe(0)
  })

  it('returns 400 when balance is below minimum', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 50,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('BELOW_MINIMUM')
  })

  it('returns 400 when Stripe Connect is not active', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'pending',
      payoutMinimumCents: 100,
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('STRIPE_NOT_ACTIVE')
  })

  it('returns 400 when no Stripe Connect account exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      stripeConnectId: null,
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('NO_STRIPE_ACCOUNT')
  })

  it('returns 404 when developer not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)

    expect(response.status).toBe(401)
  })

  it('calls Stripe transfers.create with correct params and an idempotency key', async () => {
    // $30 balance is under the first progressive bracket ($1K) — take = 0,
    // transfer amount = balance. The idempotency key on the second
    // argument prevents Vercel cron retries / network blips from
    // creating duplicate Stripe transfers.
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents: 3000,
      stripeConnectId: 'acct_test_456',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-new',
      amountCents: 3000,
      platformFeeCents: 0,
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    await triggerPayout(request)

    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        currency: 'usd',
        destination: 'acct_test_456',
      }),
      expect.objectContaining({ idempotencyKey: 'payout:payout-new' }),
    )
  })

  it('applies progressive take rate above the $1K bracket', async () => {
    // $2000 balance — first $1000 at 0%, next $1000 at 2% = $20 fee.
    // This is the lexwhiting@gmail.com-shaped test (founder's $2473.50
    // balance gets a similar but different number, pinned in a
    // separate test below).
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents: 200000,
      stripeConnectId: 'acct_test_456',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-new',
      amountCents: 198000,
      platformFeeCents: 2000,
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    await triggerPayout(request)

    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 198000 }),
      expect.objectContaining({ idempotencyKey: 'payout:payout-new' }),
    )
  })

  // Progressive bracket boundary cases — pin the math at every break.
  // Brackets (from lib/pricing.ts):
  //   $0–$1,000     → 0%
  //   $1,001–$10,000  → 2%
  //   $10,001–$50,000 → 2.5%
  //   $50,001+       → 5%
  describe.each([
    // [balanceCents, expectedFee, expectedPayout, label]
    [50_000, 0, 50_000, '$500 (mid first bracket → 0% take)'],
    [100_000, 0, 100_000, '$1,000 exact (top of first bracket → still 0%)'],
    [100_001, 0, 100_001, '$1,000.01 (1¢ into 2% bracket — 0.02 floors to 0)'],
    [100_100, 2, 100_098, '$1,001 (100¢ into 2% bracket → 2¢ take)'],
  ])('progressive bracket boundary: balance=%i', (balance, expectedFee, expectedPayout) => {
    it(`fee=${expectedFee}, payout=${expectedPayout}`, async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 'dev-bracket',
        email: 'dev@example.com',
        name: 'Test Dev',
        balanceCents: balance,
        stripeConnectId: 'acct_test',
        stripeConnectStatus: 'active',
        payoutMinimumCents: 100,
      }])
      mockDb.returning.mockResolvedValueOnce([{
        id: 'payout-bracket',
        amountCents: expectedPayout,
        platformFeeCents: expectedFee,
        createdAt: new Date().toISOString(),
      }])

      const request = makeRequest('/api/payouts/trigger', 'POST')
      const response = await triggerPayout(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.payout.amountCents).toBe(expectedPayout)
      expect(data.payout.platformFeeCents).toBe(expectedFee)
      // Stripe is debited the NET (post-take) amount, not the gross.
      expect(mockStripeTransfers.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: expectedPayout }),
        expect.anything(),
      )
    })
  })

  it('applies progressive take to the $2473.50 reference balance', async () => {
    // The founder's historical balance — exact numbers from the
    // launch-day plan. balance=247350 → take = (247350-100000) * 0.02
    // = floor(2947) = 2947. Payout = 244403.
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-lexwhiting',
      email: 'lexwhiting@gmail.com',
      name: null,
      balanceCents: 247350,
      stripeConnectId: 'acct_lexwhiting',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-lex',
      amountCents: 244403,
      platformFeeCents: 2947,
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payout.amountCents).toBe(244403)
    expect(data.payout.platformFeeCents).toBe(2947)
  })

  it('returns 409 PAYOUT_IN_PROGRESS on partial-unique-index collision', async () => {
    // The migration-0009 partial unique index rejects a second
    // concurrent INSERT for the same developer with status='processing'.
    // The Postgres driver throws SQLSTATE 23505 with the constraint
    // name; we surface this as 409 to the caller.
    const collision = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'payouts_one_processing_per_dev',
    })
    mockDb.transaction.mockRejectedValueOnce(collision)

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('PAYOUT_IN_PROGRESS')
  })

  it('restores balance + marks payout failed when Stripe transfer throws', async () => {
    // The route zeros balance INSIDE the preflight transaction (Phase 1).
    // If the subsequent stripe.transfers.create throws, the developer's
    // accumulated revenue would otherwise be lost. The rollback
    // transaction must restore balance + mark the payout failed.
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents: 5000,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-failed',
      amountCents: 5000,
      platformFeeCents: 0,
      createdAt: new Date().toISOString(),
    }])

    mockStripeTransfers.create.mockRejectedValueOnce(
      new Error('Stripe API exploded'),
    )

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('STRIPE_TRANSFER_FAILED')
    // The rollback transaction should have been invoked.
    // (At least 2 db.transaction calls: preflight + rollback.)
    expect(mockDb.transaction).toHaveBeenCalledTimes(2)
  })

  it('marks Connect as needs_reconnect on terminal Stripe account errors', async () => {
    // account_invalid / insufficient_capabilities mean the connected
    // account is dead. Without flipping stripeConnectStatus, the cron
    // would re-try every day forever. Surface as NEEDS_RECONNECT so
    // the dashboard can prompt the developer to redo onboarding.
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents: 5000,
      stripeConnectId: 'acct_dead',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-deadacct',
      amountCents: 5000,
      platformFeeCents: 0,
      createdAt: new Date().toISOString(),
    }])

    const stripeErr = Object.assign(new Error('No such account'), {
      code: 'account_invalid',
    })
    mockStripeTransfers.create.mockRejectedValueOnce(stripeErr)

    const request = makeRequest('/api/payouts/trigger', 'POST')
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.code).toBe('NEEDS_RECONNECT')
  })

  it('resets developer balance to 0 after payout', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 5000,
      stripeConnectId: 'acct_test_123',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-new',
      amountCents: 5000,
      platformFeeCents: 1250,
      stripeTransferId: 'tr_test_123',
      status: 'completed',
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    await triggerPayout(request)

    // Verify db.update was called (set balance to 0)
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ balanceCents: 0 })
    )
  })
})
