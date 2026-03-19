import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────

const { mockCheckRateLimit, mockGetCronSecret, mockGetStripeSecretKey, mockGetAppUrl } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
  mockGetCronSecret: vi.fn(),
  mockGetStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
  mockGetAppUrl: vi.fn().mockReturnValue('https://settlegrid.ai'),
}))

const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const mockAbandonedCheckoutEmail = vi.hoisted(() => vi.fn().mockReturnValue({
  subject: 'Test Subject',
  html: '<p>Test</p>',
}))

const mockStripeSessionCreate = vi.hoisted(() => vi.fn().mockResolvedValue({
  id: 'cs_test_session',
  url: 'https://checkout.stripe.com/test_session',
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: mockGetCronSecret,
  getStripeSecretKey: mockGetStripeSecretKey,
  getAppUrl: mockGetAppUrl,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
  abandonedCheckoutEmail: mockAbandonedCheckoutEmail,
}))

// Chainable mock DB
const mockDbLimit = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockDbWhere = vi.hoisted(() => vi.fn().mockReturnValue({ limit: mockDbLimit }))
const mockDbInnerJoin2 = vi.hoisted(() => vi.fn().mockReturnValue({ where: mockDbWhere }))
const mockDbInnerJoin1 = vi.hoisted(() => vi.fn().mockReturnValue({ innerJoin: mockDbInnerJoin2 }))
const mockDbFrom = vi.hoisted(() => vi.fn().mockReturnValue({ innerJoin: mockDbInnerJoin1 }))
const mockDbSelect = vi.hoisted(() => vi.fn().mockReturnValue({ from: mockDbFrom }))
const mockDbSet = vi.hoisted(() => vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
}))
const mockDbUpdate = vi.hoisted(() => vi.fn().mockReturnValue({ set: mockDbSet }))

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  purchases: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    amountCents: 'amount_cents',
    status: 'status',
    reminderSentAt: 'reminder_sent_at',
    createdAt: 'created_at',
    stripeSessionId: 'stripe_session_id',
  },
  consumers: { id: 'id', email: 'email', stripeCustomerId: 'stripe_customer_id' },
  tools: { id: 'id', name: 'name', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(vi.fn().mockReturnValue('sql'), { join: vi.fn(), raw: vi.fn() }),
  isNull: vi.fn().mockImplementation((a: unknown) => ({ isNull: a })),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeSessionCreate,
      },
    },
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  return new NextRequest('http://localhost:3005/api/cron/abandoned-checkout', { method: 'GET', headers })
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('abandoned-checkout cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockGetCronSecret.mockReturnValue('test-secret')
  })

  it('returns 500 when CRON_SECRET is not configured (fail-closed)', async () => {
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 401 with wrong authorization', async () => {
    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer wrong-secret'))

    expect(response.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 100, remaining: 0, reset: 0 })

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(429)
  })

  it('returns reminded: 0 when no abandoned purchases found', async () => {
    mockDbLimit.mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.reminded).toBe(0)
  })

  it('sends reminder for abandoned pending purchase', async () => {
    const abandonedPurchase = {
      id: 'purchase-1',
      consumerId: 'consumer-1',
      toolId: 'tool-1',
      amountCents: 2000,
      consumerEmail: 'user@example.com',
      consumerStripeCustomerId: 'cus_123',
      toolName: 'AnalyzeTool',
      toolStatus: 'active',
    }
    mockDbLimit.mockResolvedValueOnce([abandonedPurchase])

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.reminded).toBe(1)

    // Should have created a new Stripe session
    expect(mockStripeSessionCreate).toHaveBeenCalledOnce()
    const sessionArgs = mockStripeSessionCreate.mock.calls[0][0]
    expect(sessionArgs.customer).toBe('cus_123')
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(2000)
    expect(sessionArgs.metadata.purchaseId).toBe('purchase-1')
    expect(sessionArgs.metadata.toolId).toBe('tool-1')

    // Should have sent the email
    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
    }))

    // Should have updated the purchase with reminderSentAt
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it('skips purchases for inactive tools', async () => {
    const abandonedPurchase = {
      id: 'purchase-1',
      consumerId: 'consumer-1',
      toolId: 'tool-1',
      amountCents: 2000,
      consumerEmail: 'user@example.com',
      consumerStripeCustomerId: 'cus_123',
      toolName: 'InactiveTool',
      toolStatus: 'draft',
    }
    mockDbLimit.mockResolvedValueOnce([abandonedPurchase])

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.reminded).toBe(0)
    expect(mockStripeSessionCreate).not.toHaveBeenCalled()
  })

  it('creates session without customer when stripeCustomerId is null', async () => {
    const abandonedPurchase = {
      id: 'purchase-2',
      consumerId: 'consumer-2',
      toolId: 'tool-2',
      amountCents: 500,
      consumerEmail: 'nocustomer@example.com',
      consumerStripeCustomerId: null,
      toolName: 'BasicTool',
      toolStatus: 'active',
    }
    mockDbLimit.mockResolvedValueOnce([abandonedPurchase])

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    const sessionArgs = mockStripeSessionCreate.mock.calls[0][0]
    expect(sessionArgs.customer).toBeUndefined()
  })

  it('continues processing remaining purchases when one fails', async () => {
    const purchases = [
      {
        id: 'purchase-fail',
        consumerId: 'consumer-1',
        toolId: 'tool-1',
        amountCents: 1000,
        consumerEmail: 'fail@example.com',
        consumerStripeCustomerId: 'cus_fail',
        toolName: 'Tool1',
        toolStatus: 'active',
      },
      {
        id: 'purchase-ok',
        consumerId: 'consumer-2',
        toolId: 'tool-2',
        amountCents: 2000,
        consumerEmail: 'ok@example.com',
        consumerStripeCustomerId: 'cus_ok',
        toolName: 'Tool2',
        toolStatus: 'active',
      },
    ]
    mockDbLimit.mockResolvedValueOnce(purchases)
    // First Stripe call fails, second succeeds
    mockStripeSessionCreate
      .mockRejectedValueOnce(new Error('Stripe error'))
      .mockResolvedValueOnce({
        id: 'cs_test_ok',
        url: 'https://checkout.stripe.com/ok',
      })

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.reminded).toBe(1) // Only the second one succeeded
    expect(mockStripeSessionCreate).toHaveBeenCalledTimes(2)
  })

  it('uses correct metadata on new Stripe session', async () => {
    const abandonedPurchase = {
      id: 'purchase-meta',
      consumerId: 'consumer-meta',
      toolId: 'tool-meta',
      amountCents: 5000,
      consumerEmail: 'meta@example.com',
      consumerStripeCustomerId: 'cus_meta',
      toolName: 'MetaTool',
      toolStatus: 'active',
    }
    mockDbLimit.mockResolvedValueOnce([abandonedPurchase])

    const { GET } = await import('@/app/api/cron/abandoned-checkout/route')
    await GET(makeRequest('Bearer test-secret'))

    const sessionArgs = mockStripeSessionCreate.mock.calls[0][0]
    expect(sessionArgs.metadata).toEqual({
      purchaseId: 'purchase-meta',
      consumerId: 'consumer-meta',
      toolId: 'tool-meta',
      amountCents: '5000',
    })
    expect(sessionArgs.mode).toBe('payment')
    expect(sessionArgs.line_items[0].price_data.currency).toBe('usd')
  })
})
