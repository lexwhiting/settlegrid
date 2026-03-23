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
  })

  it('triggers payout for developer with sufficient balance', async () => {
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
    const response = await triggerPayout(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payout).toBeDefined()
    expect(data.payout.amountCents).toBe(5000)
  })

  it('returns 400 when balance is below minimum', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 1000,
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

  it('calls Stripe transfers.create with correct params', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      balanceCents: 3000,
      stripeConnectId: 'acct_test_456',
      stripeConnectStatus: 'active',
      payoutMinimumCents: 100,
    }])

    mockDb.returning.mockResolvedValueOnce([{
      id: 'payout-new',
      amountCents: 3000,
      platformFeeCents: 750,
      stripeTransferId: 'tr_test_123',
      status: 'completed',
      createdAt: new Date().toISOString(),
    }])

    const request = makeRequest('/api/payouts/trigger', 'POST')
    await triggerPayout(request)

    expect(mockStripeTransfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        currency: 'usd',
        destination: 'acct_test_456',
      })
    )
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
