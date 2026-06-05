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
    tier: 'tier',
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

const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  }),
)

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
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

  // Default valid body: US individual + USD. P3.RAIL1 added the
  // eligibility gate, so every successful call now requires this
  // body. Tests that exercise the negative paths (404, 401, 403,
  // 400) supply their own variants.
  const validBody = {
    countryIso: 'US',
    entityType: 'individual',
    preferredCurrency: 'USD',
  }

  it('returns onboarding URL for developer with existing Stripe account', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: 'acct_existing_123',
      stripeConnectStatus: 'pending',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBe('https://connect.stripe.com/setup/e/test')
  })

  it('creates new Stripe account when none exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toBeDefined()
    expect(data.accountType).toBe('express')
    expect(mockStripeAccounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        email: 'dev@example.com',
      })
    )
  })

  it('returns 404 when developer not found in db', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)

    expect(response.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))

    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)

    expect(response.status).toBe(401)
  })

  it('returns 429 when rate-limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
    // Stripe SDK must NOT have been touched — gate fired before.
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
  })

  // ─── P3.RAIL1 hostile-bypass tests ─────────────────────────────
  // These prove the eligibility gate is non-skippable: a hostile
  // client cannot bypass /api/eligibility by POSTing directly here
  // with an unsupported country/entity combination — the same
  // routeDeveloper() check fires server-side, so Stripe never sees
  // the request at all.

  it('returns 403 INELIGIBLE for direct bypass with Sandeep case (IN individual)', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'IN',
      entityType: 'individual',
      preferredCurrency: 'INR',
    })
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INELIGIBLE')
    expect(data.waitlistUrl).toContain('/onboarding/waitlist')
    expect(data.waitlistUrl).toContain('country=IN')
    expect(data.waitlistUrl).toContain('entity=individual')
    expect(data.waitlistReason).toBe('country_not_supported_for_entity_type')
    // No Stripe call was made — the gate fired before the SDK.
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
  })

  it('returns 422 for missing countryIso (Zod validation; gate fail-closed)', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      entityType: 'individual',
      preferredCurrency: 'USD',
    })
    const response = await connectHandler(request)

    expect(response.status).toBe(422)
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_INPUT for malformed countryIso (3 letters)', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'USA',
      entityType: 'individual',
      preferredCurrency: 'USD',
    })
    const response = await connectHandler(request)

    expect(response.status).toBe(400)
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
  })

  it('passes router-decided account type to the Stripe adapter (no hardcoded default)', async () => {
    // Scale-tier dev with self-managed flag in IN individual →
    // router returns 'standard'. This test demonstrates account-type
    // logic lives only in router.ts (D15 / hostile (d)) and the
    // adapter respects the router's choice.
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'scale',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'IN',
      entityType: 'individual',
      preferredCurrency: 'INR',
      requestsSelfManaged: true,
    })
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.accountType).toBe('standard')
    // Stripe.accounts.create called with type='standard', not the
    // adapter's old default of 'express'.
    expect(mockStripeAccounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'standard' }),
    )
  })

  it('mapTier coerces legacy "starter" to builder (not scale)', async () => {
    // Coverage for the legacy-tier alias branch in mapTier. A
    // 'starter' tier dev requesting self-managed Standard in IN
    // would get Standard ONLY if mapTier promoted them to scale.
    // It must NOT — the alias is for builder, not scale, so the
    // priority-2 escalation should NOT fire.
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'starter', // legacy name
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'IN',
      entityType: 'individual',
      preferredCurrency: 'INR',
      requestsSelfManaged: true,
    })
    const response = await connectHandler(request)

    // Sandeep-tier (builder via 'starter' legacy alias) does NOT
    // get Standard — they hit the waitlist.
    expect(response.status).toBe(403)
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
  })

  it('mapTier coerces legacy "growth" to builder', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'growth',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'US',
      entityType: 'individual',
      preferredCurrency: 'USD',
    })
    const response = await connectHandler(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.accountType).toBe('express')
  })

  it('mapTier returns "free" for null/missing tier (fail-closed)', async () => {
    // Privilege-escalation guard: a missing tier must NOT silently
    // promote to scale. mapTier handles null/undefined → 'free'.
    mockDb.limit.mockResolvedValueOnce([{
      tier: null,
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'IN',
      entityType: 'individual',
      preferredCurrency: 'INR',
      requestsSelfManaged: true,
    })
    const response = await connectHandler(request)
    expect(response.status).toBe(403)
  })

  it('returns 500 when downstream Stripe call throws unexpectedly', async () => {
    // Coverage for the outer catch → internalErrorResponse fall-through.
    // Adapter creation succeeds; ensureAccount throws an
    // unexpected error class.
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])
    mockStripeAccounts.create.mockRejectedValueOnce(
      new Error('Stripe API down'),
    )

    const request = makeRequest('/api/stripe/connect', 'POST', validBody)
    const response = await connectHandler(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('INTERNAL_ERROR')
    // Stripe error message must not leak through.
    expect(JSON.stringify(data)).not.toContain('Stripe API down')
  })

  it('returns 403 with currency reason when payout currency unsupported', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      tier: 'free',
      stripeConnectId: null,
      stripeConnectStatus: 'not_started',
    }])

    const request = makeRequest('/api/stripe/connect', 'POST', {
      countryIso: 'US',
      entityType: 'individual',
      preferredCurrency: 'CNY',
    })
    const response = await connectHandler(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.waitlistReason).toBe('preferred_currency_not_supported')
    expect(mockStripeAccounts.create).not.toHaveBeenCalled()
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
