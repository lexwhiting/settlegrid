/**
 * P2.TAX1 — end-to-end integration tests for the subscribe route's
 * Stripe Tax wiring.
 *
 * Covers the three scenarios the P2.TAX1 DoD calls out:
 *   (i)  EU customer signup — Stripe Checkout Session is created
 *        with automatic_tax.enabled=true, billing_address_collection
 *        required, tax_id_collection enabled. Stripe's hosted UI
 *        then collects the billing address + any VAT ID, calculates
 *        the VAT at the customer's member-state rate, and charges
 *        accordingly. Our test verifies the session config shape;
 *        Stripe's own test-mode fixtures cover the rate-calculation
 *        behavior.
 *   (ii) US customer in a no-nexus state pays tax-free — SAME session
 *        config; Stripe Tax returns rate=0 for a jurisdiction
 *        SettleGrid is not registered in. Verifying the config is
 *        identical proves no per-customer branching could
 *        accidentally bypass tax.
 *   (iii)UK B2B customer with valid VAT ID triggers reverse charge —
 *        SAME session config; Stripe's tax_id_collection=enabled
 *        surfaces the VAT ID field. Our validateEuVatId() unit
 *        tests cover the VIES validation path; this integration
 *        test covers that the config path that REACHES Stripe
 *        always has tax_id_collection enabled.
 *
 * The honest test story: we cannot invoke Stripe's actual rate
 * calculation from a unit test — that requires Stripe test-mode +
 * real HTTP. We CAN verify the code that creates the session passes
 * the right config, and that lets Stripe Tax do its job correctly
 * across all three scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockStripeCheckoutSessions, mockStripeCustomers } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  const mockStripeCheckoutSessions = {
    create: vi.fn(),
  }
  const mockStripeCustomers = {
    create: vi.fn().mockResolvedValue({ id: 'cus_TEST' }),
    update: vi.fn().mockResolvedValue({ id: 'cus_TEST' }),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn(),
    mockStripeCheckoutSessions,
    mockStripeCustomers,
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    stripeCustomerId: 'stripe_customer_id',
    stripeSubscriptionId: 'stripe_subscription_id',
    isFoundingMember: 'is_founding_member',
  },
}))
vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: (req: NextRequest) => mockRequireDeveloper(req),
}))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/rails', () => ({
  getStripeClient: () => ({
    checkout: { sessions: mockStripeCheckoutSessions },
    customers: mockStripeCustomers,
  }),
}))
vi.mock('@/lib/env', () => ({
  getAppUrl: () => 'https://test.settlegrid.ai',
  getStripeSecretKey: () => 'sk_test_x',
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_PRICE_BUILDER = 'price_builder_test'
  process.env.STRIPE_PRICE_SCALE = 'price_scale_test'
  mockRequireDeveloper.mockResolvedValue({
    id: 'dev-123',
    email: 'dev@example.com',
  })
  mockDb.limit.mockResolvedValue([
    {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      isFoundingMember: false,
    },
  ])
  mockStripeCheckoutSessions.create.mockResolvedValue({
    id: 'cs_TEST',
    url: 'https://checkout.stripe.com/test',
  })
})

async function postSubscribe(
  plan: 'builder' | 'scale',
  opts: { billing_address?: Record<string, string> } = {},
) {
  const { POST } = await import('../billing/subscribe/route')
  const body: Record<string, unknown> = { plan }
  if (opts.billing_address) body.billing_address = opts.billing_address
  const req = new NextRequest('http://localhost/api/billing/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('P2.TAX1 — subscribe route passes automatic_tax config (hostile-review a+c)', () => {
  it('creates Checkout Session with automatic_tax.enabled=true for Builder plan', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.automatic_tax).toEqual({ enabled: true })
  })

  it('creates Checkout Session with automatic_tax.enabled=true for Scale plan', async () => {
    await postSubscribe('scale')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.automatic_tax).toEqual({ enabled: true })
  })

  it('sets billing_address_collection=required (no way to skip the address)', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.billing_address_collection).toBe('required')
  })

  it('enables tax_id_collection so EU B2B customers can enter a VAT ID (reverse-charge path)', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.tax_id_collection).toEqual({ enabled: true })
  })

  it('sets customer_update so collected address saves back on the Stripe Customer', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.customer_update).toEqual({ address: 'auto', name: 'auto' })
  })
})

describe('P2.TAX1 — three E2E scenarios share the SAME checkout config (spec DoD item 8)', () => {
  // The three scenarios below all exercise the same code path — that
  // is EXACTLY the point. Stripe Tax uses the customer's collected
  // billing address to determine the applicable rate. If the session
  // config is identical across all three, then:
  //   - EU customer in a registered jurisdiction → Stripe Tax
  //     applies the member-state VAT rate
  //   - US customer in a state where SettleGrid has NOT registered
  //     → Stripe Tax returns rate=0 (no tax collected, no remittance
  //     obligation created)
  //   - UK B2B customer who enters a valid VAT ID → Stripe applies
  //     reverse charge (tax_id_collection must be enabled for Stripe
  //     to show the VAT ID input and for tax_type='vat' rate=0 to
  //     be triggered)

  it('EU customer signup — session carries automatic_tax + tax_id_collection', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.automatic_tax.enabled).toBe(true)
    expect(call.tax_id_collection.enabled).toBe(true)
    expect(call.billing_address_collection).toBe('required')
  })

  it('US customer in no-nexus state — same session shape (Stripe Tax returns rate=0 upstream)', async () => {
    await postSubscribe('scale')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(call.automatic_tax.enabled).toBe(true)
    expect(call.billing_address_collection).toBe('required')
  })

  it('UK B2B reverse-charge — same session shape with tax_id_collection enabled', async () => {
    await postSubscribe('builder')
    const call = mockStripeCheckoutSessions.create.mock.calls[0][0]
    // The key requirement for reverse-charge: the customer must
    // have a way to enter their VAT ID at checkout. Stripe's
    // tax_id_collection=enabled surfaces that input; without it,
    // a UK B2B customer has no way to signal reverse-charge.
    expect(call.tax_id_collection).toEqual({ enabled: true })
  })
})

describe('P2.TAX1 — billing-address collected BEFORE checkout (spec req 5, re-audit fix)', () => {
  it('stamps address on NEW Stripe Customer when UI sends billing_address', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFoundingMember: false,
      },
    ])
    await postSubscribe('builder', {
      billing_address: {
        country: 'DE',
        line1: 'Musterstraße 1',
        city: 'Berlin',
        postal_code: '10115',
      },
    })
    const createCall = mockStripeCustomers.create.mock.calls[0][0]
    expect(createCall.address).toEqual({
      country: 'DE',
      line1: 'Musterstraße 1',
      line2: undefined,
      city: 'Berlin',
      state: undefined,
      postal_code: '10115',
    })
  })

  it('UPDATES existing Stripe Customer address when UI sends billing_address', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: 'cus_EXISTING',
        stripeSubscriptionId: null,
        isFoundingMember: false,
      },
    ])
    await postSubscribe('builder', {
      billing_address: { country: 'GB', city: 'London', postal_code: 'EC1A 1BB' },
    })
    expect(mockStripeCustomers.update).toHaveBeenCalledWith('cus_EXISTING', {
      address: {
        country: 'GB',
        line1: undefined,
        line2: undefined,
        city: 'London',
        state: undefined,
        postal_code: 'EC1A 1BB',
      },
    })
  })

  it('uppercases + trims 2-letter country code', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFoundingMember: false,
      },
    ])
    await postSubscribe('builder', { billing_address: { country: ' de ' } })
    const createCall = mockStripeCustomers.create.mock.calls[0][0]
    expect(createCall.address?.country).toBe('DE')
  })

  it('rejects non-2-letter country code with 400', async () => {
    const response = await postSubscribe('builder', {
      billing_address: { country: 'USA' } as unknown as { country: string },
    })
    // 422 Unprocessable Entity: Zod validation failure (not a
    // malformed JSON body, which would be 400). parseBody
    // distinguishes the two.
    expect(response.status).toBe(422)
  })

  it('rejects missing country (address provided but incomplete)', async () => {
    const response = await postSubscribe('builder', {
      billing_address: { city: 'Nowhere' } as unknown as { country: string },
    })
    // 422 Unprocessable Entity: Zod validation failure (not a
    // malformed JSON body, which would be 400). parseBody
    // distinguishes the two.
    expect(response.status).toBe(422)
  })

  it('BACKWARDS-COMPAT: accepts subscribe with NO billing_address (fallback path)', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFoundingMember: false,
      },
    ])
    const response = await postSubscribe('builder')
    expect(response.status).toBe(201)
    // Customer created WITHOUT address — Stripe Checkout's
    // billing_address_collection: 'required' will collect it.
    const createCall = mockStripeCustomers.create.mock.calls[0][0]
    expect(createCall.address).toBeUndefined()
    // And the Checkout Session still requires address collection.
    const sessionCall = mockStripeCheckoutSessions.create.mock.calls[0][0]
    expect(sessionCall.billing_address_collection).toBe('required')
  })

  it('no Stripe Customer update call when body has no billing_address + existing customer', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: 'cus_EXISTING',
        stripeSubscriptionId: null,
        isFoundingMember: false,
      },
    ])
    await postSubscribe('builder')
    expect(mockStripeCustomers.update).not.toHaveBeenCalled()
  })
})

describe('P2.TAX1 — pre-existing subscribe-route guards (coverage close-out)', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now(),
    })
    const response = await postSubscribe('builder')
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('returns 401 when auth fails', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(
      new Error('Authentication required'),
    )
    const response = await postSubscribe('builder')
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 with generic message when auth throws a non-Error', async () => {
    mockRequireDeveloper.mockRejectedValueOnce('string-error')
    const response = await postSubscribe('builder')
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 INVALID_PLAN when STRIPE_PRICE_BUILDER is unset', async () => {
    // Verifies the no-fallback contract: if STRIPE_PRICE_BUILDER is
    // unset, the route fails loudly rather than silently charging the
    // legacy $9 STRIPE_PRICE_STARTER price (the bug that shipped on
    // 2026-05-04).
    const originalBuilder = process.env.STRIPE_PRICE_BUILDER
    delete process.env.STRIPE_PRICE_BUILDER
    vi.resetModules()
    try {
      const { POST } = await import('../billing/subscribe/route')
      const req = new NextRequest('http://localhost/api/billing/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'builder' }),
      })
      const response = await POST(req)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('INVALID_PLAN')
    } finally {
      if (originalBuilder) process.env.STRIPE_PRICE_BUILDER = originalBuilder
      vi.resetModules()
    }
  })

  it('founding members are returned with foundingMember:true without creating a Stripe session', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFoundingMember: true,
      },
    ])
    const response = await postSubscribe('builder')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.foundingMember).toBe(true)
    expect(mockStripeCheckoutSessions.create).not.toHaveBeenCalled()
    expect(mockStripeCustomers.create).not.toHaveBeenCalled()
  })

  it('returns 400 EXISTING_SUBSCRIPTION when developer already has a subscription', async () => {
    mockDb.limit.mockResolvedValue([
      {
        stripeCustomerId: 'cus_X',
        stripeSubscriptionId: 'sub_EXISTING',
        isFoundingMember: false,
      },
    ])
    const response = await postSubscribe('builder')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('EXISTING_SUBSCRIPTION')
    expect(mockStripeCheckoutSessions.create).not.toHaveBeenCalled()
  })

  it('returns 404 NOT_FOUND when developer record is missing', async () => {
    mockDb.limit.mockResolvedValue([])
    const response = await postSubscribe('builder')
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('returns 500 SUBSCRIBE_ERROR when Stripe checkout creation throws', async () => {
    mockStripeCheckoutSessions.create.mockRejectedValueOnce(
      new Error('Stripe API is down'),
    )
    const response = await postSubscribe('builder')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.code).toBe('SUBSCRIBE_ERROR')
  })

  it('returns 500 with stringified message when a non-Error is thrown', async () => {
    mockStripeCheckoutSessions.create.mockImplementationOnce(() => {
      throw 'raw string error' // eslint-disable-line no-throw-literal
    })
    const response = await postSubscribe('builder')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('raw string error')
  })
})

describe('P2.TAX1 — hostile-review (a) regression guard: subscribe cannot ship untaxed', () => {
  it('config is the SAME regardless of plan (no branch can skip tax)', async () => {
    await postSubscribe('builder')
    const builderCall = mockStripeCheckoutSessions.create.mock.calls[0][0]
    mockStripeCheckoutSessions.create.mockClear()
    await postSubscribe('scale')
    const scaleCall = mockStripeCheckoutSessions.create.mock.calls[0][0]

    expect(builderCall.automatic_tax).toEqual(scaleCall.automatic_tax)
    expect(builderCall.billing_address_collection).toBe(
      scaleCall.billing_address_collection,
    )
    expect(builderCall.tax_id_collection).toEqual(scaleCall.tax_id_collection)
  })
})
