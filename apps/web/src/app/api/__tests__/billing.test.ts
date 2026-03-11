import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireConsumer, mockStripeCheckoutSessions, mockStripeCustomers, mockStripeWebhooks } = vi.hoisted(() => {
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
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  }

  const mockStripeCheckoutSessions = {
    create: vi.fn().mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
    }),
  }

  const mockStripeCustomers = {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test_123',
    }),
  }

  const mockStripeWebhooks = {
    constructEvent: vi.fn(),
  }

  return {
    mockDb,
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'con-123', email: 'consumer@example.com' }),
    mockStripeCheckoutSessions,
    mockStripeCustomers,
    mockStripeWebhooks,
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  purchases: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    amountCents: 'amount_cents',
    stripeSessionId: 'stripe_session_id',
    stripePaymentIntentId: 'stripe_payment_intent_id',
    status: 'status',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    status: 'status',
  },
  consumers: {
    id: 'id',
    email: 'email',
    stripeCustomerId: 'stripe_customer_id',
  },
  consumerToolBalances: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: mockRequireConsumer,
}))

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: mockStripeCheckoutSessions },
      customers: mockStripeCustomers,
      webhooks: mockStripeWebhooks,
    })),
  }
})

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
  getStripeWebhookSecret: vi.fn().mockReturnValue('whsec_fake'),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3005'),
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
    { raw: vi.fn() }
  ),
}))

import { POST as checkout } from '@/app/api/billing/checkout/route'
import { POST as webhook } from '@/app/api/billing/webhook/route'
import { GET as purchaseHistory } from '@/app/api/billing/purchases/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown, headers?: Record<string, string>): NextRequest {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return new NextRequest(`http://localhost:3005${url}`, options)
}

describe('Checkout (POST /api/billing/checkout)', () => {
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

  it('creates a checkout session for preset amount', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', name: 'Test Tool', status: 'active' }])
      .mockResolvedValueOnce([{ stripeCustomerId: 'cus_existing' }])

    mockDb.returning.mockResolvedValueOnce([{ id: 'purchase-1' }])

    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 2000,
    })

    const response = await checkout(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.checkoutUrl).toBe('https://checkout.stripe.com/test')
  })

  it('creates Stripe customer if not exists', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'tool-1', name: 'Test Tool', status: 'active' }])
      .mockResolvedValueOnce([{ stripeCustomerId: null }])

    mockDb.returning.mockResolvedValueOnce([{ id: 'purchase-2' }])

    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 500,
    })

    const response = await checkout(request)
    expect(response.status).toBe(201)
    expect(mockStripeCustomers.create).toHaveBeenCalled()
  })

  it('returns 404 for non-existent tool', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 2000,
    })

    const response = await checkout(request)
    expect(response.status).toBe(404)
  })

  it('returns 400 for inactive tool', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'tool-1', name: 'Draft Tool', status: 'draft' }])

    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 2000,
    })

    const response = await checkout(request)
    expect(response.status).toBe(400)
  })

  it('returns 422 for amount below minimum', async () => {
    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 50,
    })

    const response = await checkout(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 for amount above maximum', async () => {
    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 200000,
    })

    const response = await checkout(request)
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireConsumer.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/billing/checkout', 'POST', {
      toolId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: 2000,
    })

    const response = await checkout(request)
    expect(response.status).toBe(401)
  })
})

describe('Webhook (POST /api/billing/webhook)', () => {
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

  it('handles checkout.session.completed event', async () => {
    mockStripeWebhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          metadata: {
            purchaseId: 'purchase-1',
            consumerId: 'con-123',
            toolId: 'tool-1',
            amountCents: '2000',
          },
        },
      },
    })

    mockDb.limit.mockResolvedValueOnce([{ id: 'bal-1' }])

    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig_test_123',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    })

    const response = await webhook(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('creates new balance record when none exists', async () => {
    mockStripeWebhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_456',
          payment_intent: 'pi_test_456',
          metadata: {
            purchaseId: 'purchase-2',
            consumerId: 'con-456',
            toolId: 'tool-2',
            amountCents: '5000',
          },
        },
      },
    })

    mockDb.limit.mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig_test_456',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    })

    const response = await webhook(request)
    expect(response.status).toBe(200)
  })

  it('returns 400 for missing stripe signature', async () => {
    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    })

    const response = await webhook(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid signature', async () => {
    mockStripeWebhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature')
    })

    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid_sig',
      },
      body: JSON.stringify({ type: 'test' }),
    })

    const response = await webhook(request)
    expect(response.status).toBe(400)
  })

  it('handles payment_intent.payment_failed event', async () => {
    mockStripeWebhooks.constructEvent.mockReturnValueOnce({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_failed',
        },
      },
    })

    mockDb.limit.mockResolvedValueOnce([{ id: 'purchase-failed' }])

    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig_test_failed',
      },
      body: JSON.stringify({ type: 'payment_intent.payment_failed' }),
    })

    const response = await webhook(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('handles unrecognized event types gracefully', async () => {
    mockStripeWebhooks.constructEvent.mockReturnValueOnce({
      type: 'some.unknown.event',
      data: { object: {} },
    })

    const request = new NextRequest('http://localhost:3005/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig_test_unknown',
      },
      body: JSON.stringify({ type: 'some.unknown.event' }),
    })

    const response = await webhook(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })
})

describe('Purchase History (GET /api/billing/purchases)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.innerJoin.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.orderBy.mockReturnThis()
  })

  it('returns purchase history', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'purchase-1',
        toolId: 'tool-1',
        toolName: 'Test Tool',
        toolSlug: 'test-tool',
        amountCents: 2000,
        stripeSessionId: 'cs_test',
        status: 'completed',
        createdAt: new Date(),
      },
    ])

    const request = makeRequest('/api/billing/purchases')
    const response = await purchaseHistory(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.purchases).toHaveLength(1)
    expect(data.purchases[0].amountCents).toBe(2000)
  })

  it('returns empty list when no purchases', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/billing/purchases')
    const response = await purchaseHistory(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.purchases).toHaveLength(0)
  })
})
