/**
 * POST /api/consumer/credit-packs — the Stripe line item description names
 * a discount only for packs that have one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockSessionsCreate } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  mockSessionsCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  consumers: { id: 'id', email: 'email', stripeCustomerId: 'stripe_customer_id' },
}))
vi.mock('@/lib/middleware/auth', () => ({
  requireConsumer: vi.fn().mockResolvedValue({ id: 'con-1' }),
}))
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionsCreate } },
    customers: { create: vi.fn() },
  })),
}))
vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3005'),
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { POST } from '../route'

function buy(packId: string): Promise<Response> {
  return POST(
    new NextRequest('http://localhost:3005/api/consumer/credit-packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    }),
  )
}

function lineItemDescription(): string {
  return mockSessionsCreate.mock.calls[0][0].line_items[0].price_data.product_data.description
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.limit.mockResolvedValue([{ stripeCustomerId: 'cus_1', email: 'buyer@example.com' }])
  mockSessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' })
})

describe('credit pack checkout line item', () => {
  it('omits the discount for the no-discount pack', async () => {
    const res = await buy('pack_20')
    expect(res.status).toBe(200)
    expect(lineItemDescription()).toBe('$20.00 in SettleGrid credits')
  })

  it('names the discount for a discounted pack', async () => {
    const res = await buy('pack_100')
    expect(res.status).toBe(200)
    expect(lineItemDescription()).toBe('$100.00 in SettleGrid credits (5% discount)')
  })
})
