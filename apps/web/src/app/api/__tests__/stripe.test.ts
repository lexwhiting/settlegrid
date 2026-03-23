import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockStripeAccounts, mockStripeAccountLinks } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }

  const mockStripeAccounts = {
    create: vi.fn().mockResolvedValue({ id: 'acct_new_123' }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'acct_test_123',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    }),
  }

  const mockStripeAccountLinks = {
    create: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/e/test' }),
  }

  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
    mockStripeAccounts,
    mockStripeAccountLinks,
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    accounts: mockStripeAccounts,
    accountLinks: mockStripeAccountLinks,
  })),
}))

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: vi.fn().mockReturnValue('sk_test_fake'),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3005'),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

import { POST as connectHandler } from '@/app/api/stripe/connect/route'
import { GET as callbackHandler } from '@/app/api/stripe/connect/callback/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

describe('Stripe Connect (POST /api/stripe/connect)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
  })

  it('returns onboarding URL for developer with existing Stripe account', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      stripeConnectId: 'acct_existing_123',
      stripeConnectStatus: 'pending',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST')
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://connect.stripe.com/setup/e/test')
  })

  it('creates new Stripe account when none exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST')
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBeDefined()
    expect(mockStripeAccounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        email: 'dev@example.com',
      })
    )
  })

  it('returns 404 when developer not found in db', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/stripe/connect', 'POST')
    const response = await connectHandler(request)

    expect(response.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/stripe/connect', 'POST')
    const response = await connectHandler(request)

    expect(response.status).toBe(401)
  })
})

describe('Stripe Connect Callback (GET /api/stripe/connect/callback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('redirects to settings with active status for fully enabled account', async () => {
    mockStripeAccounts.retrieve.mockResolvedValueOnce({
      id: 'acct_test_123',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    })

    const request = makeRequest('/api/stripe/connect/callback?account_id=acct_test_123')
    const response = await callbackHandler(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/dashboard/settings')
    expect(location).toContain('stripe=active')
  })

  it('sets pending status when details submitted but not yet enabled', async () => {
    mockStripeAccounts.retrieve.mockResolvedValueOnce({
      id: 'acct_test_456',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
    })

    const request = makeRequest('/api/stripe/connect/callback?account_id=acct_test_456')
    const response = await callbackHandler(request)

    const location = response.headers.get('location')
    expect(location).toContain('stripe=pending')
  })

  it('sets incomplete status when details not submitted', async () => {
    mockStripeAccounts.retrieve.mockResolvedValueOnce({
      id: 'acct_test_789',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    })

    const request = makeRequest('/api/stripe/connect/callback?account_id=acct_test_789')
    const response = await callbackHandler(request)

    const location = response.headers.get('location')
    expect(location).toContain('stripe=incomplete')
  })

  it('redirects to error when account_id is missing', async () => {
    const request = makeRequest('/api/stripe/connect/callback')
    const response = await callbackHandler(request)

    const location = response.headers.get('location')
    expect(location).toContain('stripe=error')
    expect(location).toContain('missing_account')
  })

  it('redirects to error on Stripe API failure', async () => {
    mockStripeAccounts.retrieve.mockRejectedValueOnce(new Error('Stripe API error'))

    const request = makeRequest('/api/stripe/connect/callback?account_id=acct_bad')
    const response = await callbackHandler(request)

    const location = response.headers.get('location')
    expect(location).toContain('stripe=error')
  })

  it('updates developer record in database', async () => {
    mockStripeAccounts.retrieve.mockResolvedValueOnce({
      id: 'acct_test_update',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    })

    const request = makeRequest('/api/stripe/connect/callback?account_id=acct_test_update')
    await callbackHandler(request)

    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeConnectStatus: 'active' })
    )
  })
})
