import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  desc: vi.fn().mockImplementation((col: unknown) => ({ desc: col })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  inArray: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ inArray: [a, b] })),
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
import { checkRateLimit } from '@/lib/rate-limit'
import { gte, inArray } from 'drizzle-orm'
import { calculateTakeCents } from '@/lib/pricing'

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

  it('returns 429 when the per-user (uid) rate limit trips', async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({ success: true, limit: 100, remaining: 99, reset: 0 })
      .mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })

    const request = makeRequest('/api/payouts')
    const response = await listPayouts(request)

    expect(response.status).toBe(429)
    expect(vi.mocked(checkRateLimit)).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'payouts-list:uid:dev-123'
    )
  })

  it('never reaches the uid rate-limit layer when auth fails', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/payouts')
    const response = await listPayouts(request)

    expect(response.status).toBe(401)
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalledTimes(1)
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

// The progressive take applies to each developer's earnings per UTC
// calendar month. processPayout reads the month-to-date gross of the
// developer's earlier payouts (third .limit() in the preflight, after
// the developer row and the previous-payout lookup) and charges the
// marginal take on top of it. These tests evaluate that query's filter
// against fixture payout rows, so status and date filtering are
// exercised rather than stubbed.
describe('Trigger Payout — progressive take per calendar month', () => {
  interface PayoutFixture {
    developerId: string
    status: string
    amountCents: number
    platformFeeCents: number
    createdAt: Date
  }

  type Condition =
    | { field: unknown; value: unknown }
    | { inArray: [unknown, unknown[]] }
    | { gte: [unknown, Date] }

  /** Answer the month-to-date aggregate from fixture rows. */
  function monthToDateFrom(rows: PayoutFixture[]) {
    return async () => {
      const where = mockDb.where.mock.calls.at(-1)?.[0] as { and: Condition[] }
      let developerId: unknown
      let statuses: unknown[] | undefined
      let since: Date | undefined
      for (const c of where.and) {
        if ('field' in c && c.field === 'developer_id') developerId = c.value
        if ('inArray' in c && c.inArray[0] === 'status') statuses = c.inArray[1]
        if ('gte' in c && c.gte[0] === 'created_at') since = c.gte[1]
      }
      expect(developerId).toBeDefined()
      expect(statuses).toBeDefined()
      expect(since).toBeInstanceOf(Date)
      const total = rows
        .filter(
          (r) =>
            r.developerId === developerId &&
            statuses!.includes(r.status) &&
            r.createdAt.getTime() >= since!.getTime(),
        )
        .reduce((sum, r) => sum + r.amountCents + r.platformFeeCents, 0)
      // postgres-js returns bigint aggregates as strings.
      return [{ grossCents: String(total) }]
    }
  }

  function devRow(balanceCents: number) {
    return {
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Test Dev',
      balanceCents,
      stripeConnectId: 'acct_test_month',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }
  }

  function paidRow(grossCents: number, feeCents: number, createdAt: string, status = 'completed'): PayoutFixture {
    return {
      developerId: 'dev-123',
      status,
      amountCents: grossCents - feeCents,
      platformFeeCents: feeCents,
      createdAt: new Date(createdAt),
    }
  }

  /** Trigger one payout for `balanceCents` against the given prior rows. */
  async function runPayout(balanceCents: number, rows: PayoutFixture[]) {
    mockDb.limit
      .mockResolvedValueOnce([devRow(balanceCents)])
      .mockResolvedValueOnce([]) // previous completed payout (periodStart)
      .mockImplementationOnce(monthToDateFrom(rows))
    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-month',
      amountCents: 0,
      platformFeeCents: 0,
      createdAt: new Date(),
    }])
    const response = await triggerPayout(makeRequest('/api/payouts/trigger', 'POST'))
    return { status: response.status, data: await response.json() }
  }

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
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('first payout of the month starts at the 0% bracket', async () => {
    const { status, data } = await runPayout(50_000, [])

    expect(status).toBe(200)
    expect(data.payout.platformFeeCents).toBe(0)
    expect(data.payout.amountCents).toBe(50_000)
    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50_000 }),
      expect.anything(),
    )
  })

  it('a later payout continues from month-to-date: $900 paid + $300 → $4 fee', async () => {
    const rows = [paidRow(90_000, 0, '2026-10-05T12:00:00Z')]
    const { status, data } = await runPayout(30_000, rows)

    expect(status).toBe(200)
    // First $100 of this payout fills the 0% bracket; $200 at 2% = $4.
    expect(data.payout.platformFeeCents).toBe(400)
    expect(data.payout.amountCents).toBe(29_600)
    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 29_600 }),
      expect.objectContaining({ idempotencyKey: 'payout:payout-month' }),
    )
  })

  it('a payout crossing two brackets is split across both rates', async () => {
    // $900 paid; $10,000 payout = $100 at 0% + $9,000 at 2% + $900 at 2.5%.
    const rows = [paidRow(90_000, 0, '2026-10-02T12:00:00Z')]
    const { status, data } = await runPayout(1_000_000, rows)

    expect(status).toBe(200)
    expect(data.payout.platformFeeCents).toBe(18_000 + 2_250)
    expect(data.payout.amountCents).toBe(1_000_000 - 20_250)
  })

  it('failed payouts do not count toward month-to-date', async () => {
    // A failed payout's gross was restored to the balance; only the
    // completed $500 counts, so $600 more stays within the first $1,000.
    const rows = [
      paidRow(50_000, 0, '2026-10-03T12:00:00Z', 'completed'),
      paidRow(60_000, 0, '2026-10-10T12:00:00Z', 'failed'),
    ]
    const { status, data } = await runPayout(50_000, rows)

    expect(status).toBe(200)
    expect(data.payout.platformFeeCents).toBe(0)
    expect(vi.mocked(inArray)).toHaveBeenCalledWith(
      'status',
      expect.not.arrayContaining(['failed']),
    )
  })

  it('in-flight, unknown and reconciled payouts count toward month-to-date', async () => {
    const rows = [
      paidRow(30_000, 0, '2026-10-01T12:00:00Z', 'completed'),
      paidRow(30_000, 0, '2026-10-02T12:00:00Z', 'unknown'),
      paidRow(30_000, 0, '2026-10-03T12:00:00Z', 'reconciled'),
      paidRow(10_000, 0, '2026-10-04T12:00:00Z', 'processing'),
    ]
    // $1,000 already paid → all of this $1,000 payout is at 2%.
    const { status, data } = await runPayout(100_000, rows)

    expect(status).toBe(200)
    expect(data.payout.platformFeeCents).toBe(2_000)
  })

  it('a new UTC month resets month-to-date', async () => {
    vi.setSystemTime(new Date('2026-11-01T00:05:00Z'))
    const rows = [
      paidRow(500_000, 8_000, '2026-10-15T12:00:00Z'),
      paidRow(100_000, 2_000, '2026-10-31T23:59:59Z'),
    ]
    // $2,000 is the first payout of November: $1,000 at 0% + $1,000 at 2%.
    const { status, data } = await runPayout(200_000, rows)

    expect(status).toBe(200)
    expect(data.payout.platformFeeCents).toBe(2_000)
    expect(vi.mocked(gte)).toHaveBeenCalledWith('created_at', new Date('2026-11-01T00:00:00.000Z'))
  })

  it('stores the computed fee, net amount and payout date on the payout row', async () => {
    const rows = [paidRow(90_000, 0, '2026-10-05T12:00:00Z')]
    await runPayout(30_000, rows)

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-123',
        amountCents: 29_600,
        platformFeeCents: 400,
        status: 'processing',
        createdAt: new Date('2026-10-24T12:00:00Z'),
      }),
    )
  })

  it('reads month-to-date after locking the developer row, inside the preflight transaction', async () => {
    await runPayout(30_000, [])

    const mtdWhereIndex = mockDb.where.mock.calls.findIndex((call) =>
      (call[0] as { and?: Condition[] })?.and?.some((c) => 'inArray' in c),
    )
    expect(mtdWhereIndex).toBeGreaterThanOrEqual(0)
    expect(mockDb.for).toHaveBeenCalledWith('update')
    expect(mockDb.where.mock.invocationCallOrder[mtdWhereIndex]).toBeGreaterThan(
      mockDb.for.mock.invocationCallOrder[0],
    )
    expect(mockDb.where.mock.invocationCallOrder[mtdWhereIndex]).toBeLessThan(
      mockDb.insert.mock.invocationCallOrder[0],
    )
    expect(mockDb.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockDb.for.mock.invocationCallOrder[0],
    )
  })

  it('daily payouts across a month add up to the take on the month total', async () => {
    const rows: PayoutFixture[] = []
    const daily = [40_000, 40_000, 40_000, 400_000, 600_000, 4_000_000, 100_000]
    let totalFee = 0
    for (const [i, gross] of daily.entries()) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 1 + i, 12)))
      const { status, data } = await runPayout(gross, rows)
      expect(status).toBe(200)
      totalFee += data.payout.platformFeeCents
      rows.push(paidRow(gross, data.payout.platformFeeCents, new Date(Date.UTC(2026, 9, 1 + i, 12)).toISOString()))
    }
    const monthTotal = daily.reduce((a, b) => a + b, 0)
    expect(totalFee).toBe(calculateTakeCents(monthTotal))
  })

  it('aborts without a transfer when the month-to-date total is not a valid amount', async () => {
    mockDb.limit
      .mockResolvedValueOnce([devRow(30_000)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ grossCents: 'not-a-number' }])

    const response = await triggerPayout(makeRequest('/api/payouts/trigger', 'POST'))

    expect(response.status).toBe(500)
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockStripeTransfers.create).not.toHaveBeenCalled()
  })
})
