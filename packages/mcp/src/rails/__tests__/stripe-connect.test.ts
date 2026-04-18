/**
 * P2.RAIL1 — StripeRailAdapter unit tests.
 *
 * Mocks the Stripe SDK surface via a handwritten StripeClient stub
 * so we exercise the adapter's logic (request shape, status
 * mapping, webhook normalization) without pulling the Stripe SDK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createStripeRailAdapter,
  STRIPE_CONNECT_CAPABILITIES,
  STRIPE_CONNECT_COMPLIANCE,
  STRIPE_CONNECT_PRICING,
  STRIPE_CONNECT_DISPLAY_NAME,
  type StripeClient,
  type StripeRailAdapter,
} from '../stripe-connect'

type MockFn = ReturnType<typeof vi.fn>

interface Mocks {
  accountsCreate: MockFn
  accountsRetrieve: MockFn
  accountLinksCreate: MockFn
  sessionsCreate: MockFn
  webhooksConstructEvent: MockFn
}

function buildMockStripe(): { stripe: StripeClient; mocks: Mocks } {
  const mocks: Mocks = {
    accountsCreate: vi.fn(),
    accountsRetrieve: vi.fn(),
    accountLinksCreate: vi.fn(),
    sessionsCreate: vi.fn(),
    webhooksConstructEvent: vi.fn(),
  }
  const stripe = {
    accounts: {
      create: mocks.accountsCreate,
      retrieve: mocks.accountsRetrieve,
    },
    accountLinks: {
      create: mocks.accountLinksCreate,
    },
    checkout: {
      sessions: {
        create: mocks.sessionsCreate,
      },
    },
    webhooks: {
      constructEvent: mocks.webhooksConstructEvent,
    },
  } as unknown as StripeClient
  return { stripe, mocks }
}

describe('createStripeRailAdapter — construction validation', () => {
  it('throws TypeError when opts is missing', () => {
    expect(() =>
      createStripeRailAdapter(undefined as unknown as Parameters<typeof createStripeRailAdapter>[0]),
    ).toThrowError(/opts/)
  })

  it('throws TypeError when stripe client is missing', () => {
    expect(() =>
      createStripeRailAdapter({ stripe: undefined as unknown as StripeClient, appUrl: 'https://example.com' }),
    ).toThrowError(/stripe/)
  })

  it('throws TypeError when appUrl is missing', () => {
    const { stripe } = buildMockStripe()
    expect(() =>
      createStripeRailAdapter({ stripe, appUrl: '' }),
    ).toThrowError(/appUrl/)
  })

  it('throws TypeError when appUrl is whitespace-only', () => {
    const { stripe } = buildMockStripe()
    expect(() =>
      createStripeRailAdapter({ stripe, appUrl: '   ' }),
    ).toThrowError(/appUrl/)
  })

  it('strips trailing slashes from appUrl', async () => {
    const { stripe, mocks } = buildMockStripe()
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_1' })
    mocks.accountLinksCreate.mockResolvedValue({ url: 'https://stripe.com/onboard' })
    const adapter = createStripeRailAdapter({
      stripe,
      appUrl: 'https://settlegrid.ai/',
    })
    await adapter.startOnboarding({ developerId: 'd1', email: 'a@b.com' })
    const call = mocks.accountLinksCreate.mock.calls[0][0]
    expect(call.refresh_url).toBe('https://settlegrid.ai/dashboard/settings?stripe=refresh')
  })
})

describe('StripeRailAdapter — exports', () => {
  it('createStripeRailAdapter is the Stripe rail factory', () => {
    expect(typeof createStripeRailAdapter).toBe('function')
  })

  it('StripeRailAdapter type is structurally assignable from the factory return value', () => {
    // Compile-time check: if this file compiles, the type is wired.
    const { stripe } = buildMockStripe()
    const adapter: StripeRailAdapter = createStripeRailAdapter({
      stripe,
      appUrl: 'https://x',
    })
    expect(typeof adapter.ensureAccount).toBe('function')
    expect(typeof adapter.createOnboardingLink).toBe('function')
  })

  it('exposes static metadata (capabilities, compliance, pricing, display name)', () => {
    expect(STRIPE_CONNECT_CAPABILITIES.individualCountries).toContain('US')
    expect(STRIPE_CONNECT_CAPABILITIES.payoutCurrencies).toContain('USD')
    expect(STRIPE_CONNECT_COMPLIANCE.chargebacks).toBe('settlegrid')
    expect(STRIPE_CONNECT_PRICING.percentBps).toBe(30)
    expect(STRIPE_CONNECT_DISPLAY_NAME).toBe('Stripe Connect')
  })
})

describe('RailAdapter — static metadata on the instance', () => {
  it('exposes id, displayName, legalStructure, capabilities, compliance, pricing', () => {
    const { stripe } = buildMockStripe()
    const adapter = createStripeRailAdapter({ stripe, appUrl: 'https://x' })
    expect(adapter.id).toBe('stripe-connect')
    expect(adapter.displayName).toBe('Stripe Connect')
    expect(adapter.legalStructure).toBe('platform')
    expect(adapter.capabilities).toBe(STRIPE_CONNECT_CAPABILITIES)
    expect(adapter.compliance).toBe(STRIPE_CONNECT_COMPLIANCE)
    expect(adapter.pricing).toBe(STRIPE_CONNECT_PRICING)
  })
})

describe('startOnboarding', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: ReturnType<typeof createStripeRailAdapter>

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({ stripe, appUrl: 'https://settlegrid.ai' })
    mocks.accountLinksCreate.mockResolvedValue({ url: 'https://stripe.com/onboard' })
  })

  it('creates a new Stripe account when no existing ID is provided', async () => {
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_NEW' })
    const result = await adapter.startOnboarding({
      developerId: 'dev_1',
      email: 'a@b.com',
    })
    expect(mocks.accountsCreate).toHaveBeenCalledWith({
      type: 'express',
      email: 'a@b.com',
      metadata: { developerId: 'dev_1' },
      capabilities: { transfers: { requested: true } },
    })
    expect(result.externalId).toBe('acct_NEW')
    expect(result.url).toBe('https://stripe.com/onboard')
  })

  it('reuses an existing account ID when provided', async () => {
    const result = await adapter.startOnboarding({
      developerId: 'dev_1',
      email: 'a@b.com',
      existingExternalId: 'acct_EXISTING',
    })
    expect(mocks.accountsCreate).not.toHaveBeenCalled()
    expect(result.externalId).toBe('acct_EXISTING')
  })

  it('honors accountType override', async () => {
    const customAdapter = createStripeRailAdapter({
      stripe,
      appUrl: 'https://settlegrid.ai',
      accountType: 'standard',
    })
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_S' })
    await customAdapter.startOnboarding({ developerId: 'd', email: 'e@f.g' })
    expect(mocks.accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'standard' }),
    )
  })

  it('embeds the externalId in the callback return URL', async () => {
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_Z' })
    await adapter.startOnboarding({ developerId: 'd', email: 'e@f.g' })
    const call = mocks.accountLinksCreate.mock.calls[0][0]
    expect(call.return_url).toBe(
      'https://settlegrid.ai/api/stripe/connect/callback?account_id=acct_Z',
    )
    expect(call.type).toBe('account_onboarding')
  })

  it('rejects missing dev argument entirely', async () => {
    await expect(
      adapter.startOnboarding(
        undefined as unknown as Parameters<typeof adapter.startOnboarding>[0],
      ),
    ).rejects.toThrowError(/dev/)
  })

  it('rejects missing developerId', async () => {
    await expect(
      adapter.startOnboarding({ developerId: '', email: 'x@y.z' }),
    ).rejects.toThrowError(/developerId/)
  })

  it('rejects missing email', async () => {
    await expect(
      adapter.startOnboarding({ developerId: 'd', email: '' }),
    ).rejects.toThrowError(/email/)
  })
})

describe('ensureAccount / createOnboardingLink — resumability primitives (hostile-review I)', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: StripeRailAdapter

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({
      stripe,
      appUrl: 'https://settlegrid.ai',
    })
  })

  it('ensureAccount returns created:true when creating a new account', async () => {
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_NEW' })
    const result = await adapter.ensureAccount({
      developerId: 'd1',
      email: 'a@b.com',
    })
    expect(result.created).toBe(true)
    expect(result.externalId).toBe('acct_NEW')
    expect(mocks.accountsCreate).toHaveBeenCalledTimes(1)
  })

  it('ensureAccount returns created:false when existingExternalId is provided', async () => {
    const result = await adapter.ensureAccount({
      developerId: 'd1',
      email: 'a@b.com',
      existingExternalId: 'acct_EXISTING',
    })
    expect(result.created).toBe(false)
    expect(result.externalId).toBe('acct_EXISTING')
    expect(mocks.accountsCreate).not.toHaveBeenCalled()
  })

  it('createOnboardingLink does not touch accounts.create', async () => {
    mocks.accountLinksCreate.mockResolvedValue({ url: 'https://stripe.com/x' })
    await adapter.createOnboardingLink('acct_ANY')
    expect(mocks.accountsCreate).not.toHaveBeenCalled()
    expect(mocks.accountLinksCreate).toHaveBeenCalledTimes(1)
  })

  it('createOnboardingLink rejects missing externalId', async () => {
    await expect(adapter.createOnboardingLink('')).rejects.toThrowError(
      /externalId/,
    )
  })

  it('resumability: if createOnboardingLink fails, ensureAccount retry with the already-created ID skips account creation', async () => {
    // First call creates an account.
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_ORPHAN' })
    const first = await adapter.ensureAccount({ developerId: 'd', email: 'e@f.g' })
    expect(first.externalId).toBe('acct_ORPHAN')
    expect(first.created).toBe(true)

    // Caller persists externalId to DB. Then link creation fails.
    mocks.accountLinksCreate.mockRejectedValue(new Error('stripe 500'))
    await expect(adapter.createOnboardingLink(first.externalId)).rejects.toThrow()

    // On retry the caller passes existingExternalId = 'acct_ORPHAN'
    // and ensureAccount reuses rather than creating a duplicate.
    mocks.accountsCreate.mockClear()
    const second = await adapter.ensureAccount({
      developerId: 'd',
      email: 'e@f.g',
      existingExternalId: 'acct_ORPHAN',
    })
    expect(mocks.accountsCreate).not.toHaveBeenCalled()
    expect(second.externalId).toBe('acct_ORPHAN')
    expect(second.created).toBe(false)
  })

  it('startOnboarding (convenience wrapper) chains ensureAccount + createOnboardingLink', async () => {
    mocks.accountsCreate.mockResolvedValue({ id: 'acct_W' })
    mocks.accountLinksCreate.mockResolvedValue({ url: 'https://stripe.com/link' })
    const result = await adapter.startOnboarding({
      developerId: 'd',
      email: 'e@f.g',
    })
    expect(mocks.accountsCreate).toHaveBeenCalledTimes(1)
    expect(mocks.accountLinksCreate).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ externalId: 'acct_W', url: 'https://stripe.com/link' })
  })
})

describe('createTopupSession — metadata-override defense (hostile-review I)', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: StripeRailAdapter

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({ stripe, appUrl: 'https://x' })
    mocks.sessionsCreate.mockResolvedValue({ id: 'cs', url: 'https://x' })
  })

  it('does NOT allow caller metadata to override developerId', async () => {
    // A malicious caller could try to forge the developer identity on
    // the top-up session by injecting their own developerId via the
    // metadata map. The adapter must put its own developerId AFTER
    // the spread so it always wins.
    await adapter.createTopupSession({
      developerId: 'real_dev',
      amountMinorUnits: 100,
      currency: 'USD',
      successUrl: 's',
      cancelUrl: 'c',
      metadata: { developerId: 'ATTACKER' },
    })
    const call = mocks.sessionsCreate.mock.calls[0][0]
    expect(call.metadata.developerId).toBe('real_dev')
  })

  it('preserves other caller metadata alongside the canonical developerId', async () => {
    await adapter.createTopupSession({
      developerId: 'real_dev',
      amountMinorUnits: 100,
      currency: 'USD',
      successUrl: 's',
      cancelUrl: 'c',
      metadata: { campaign: 'launch', source: 'website' },
    })
    const call = mocks.sessionsCreate.mock.calls[0][0]
    expect(call.metadata).toEqual({
      campaign: 'launch',
      source: 'website',
      developerId: 'real_dev',
    })
  })
})

describe('syncOnboardingStatus', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: ReturnType<typeof createStripeRailAdapter>

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({ stripe, appUrl: 'https://x' })
  })

  it('maps charges_enabled + payouts_enabled → "active"', async () => {
    mocks.accountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    })
    const status = await adapter.syncOnboardingStatus('acct_1')
    expect(status.code).toBe('active')
    expect(status.chargesEnabled).toBe(true)
    expect(status.payoutsEnabled).toBe(true)
  })

  it('maps details_submitted without enablement → "pending"', async () => {
    mocks.accountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
    })
    const status = await adapter.syncOnboardingStatus('acct_1')
    expect(status.code).toBe('pending')
  })

  it('maps no submission → "incomplete"', async () => {
    mocks.accountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    })
    const status = await adapter.syncOnboardingStatus('acct_1')
    expect(status.code).toBe('incomplete')
  })

  it('handles partial enablement (charges but no payouts) as pending', async () => {
    mocks.accountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    })
    const status = await adapter.syncOnboardingStatus('acct_1')
    expect(status.code).toBe('pending')
  })

  it('coerces undefined booleans to false', async () => {
    mocks.accountsRetrieve.mockResolvedValue({})
    const status = await adapter.syncOnboardingStatus('acct_1')
    expect(status.chargesEnabled).toBe(false)
    expect(status.payoutsEnabled).toBe(false)
    expect(status.detailsSubmitted).toBe(false)
    expect(status.code).toBe('incomplete')
  })

  it('throws TypeError when externalId is missing', async () => {
    await expect(adapter.syncOnboardingStatus('')).rejects.toThrowError(/externalId/)
  })
})

describe('createTopupSession', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: ReturnType<typeof createStripeRailAdapter>

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({ stripe, appUrl: 'https://x' })
    mocks.sessionsCreate.mockResolvedValue({
      id: 'cs_1',
      url: 'https://stripe.com/checkout',
    })
  })

  it('builds a checkout session with the right line-item shape', async () => {
    await adapter.createTopupSession({
      developerId: 'd1',
      amountMinorUnits: 5000,
      currency: 'USD',
      successUrl: 'https://x/success',
      cancelUrl: 'https://x/cancel',
      customerEmail: 'a@b.com',
    })
    const call = mocks.sessionsCreate.mock.calls[0][0]
    expect(call.mode).toBe('payment')
    expect(call.line_items[0].price_data.currency).toBe('usd')
    expect(call.line_items[0].price_data.unit_amount).toBe(5000)
    expect(call.customer_email).toBe('a@b.com')
    expect(call.metadata.developerId).toBe('d1')
  })

  it('merges caller-supplied metadata with developerId', async () => {
    await adapter.createTopupSession({
      developerId: 'd1',
      amountMinorUnits: 100,
      currency: 'USD',
      successUrl: 's',
      cancelUrl: 'c',
      metadata: { campaign: 'launch' },
    })
    const call = mocks.sessionsCreate.mock.calls[0][0]
    expect(call.metadata).toEqual({ developerId: 'd1', campaign: 'launch' })
  })

  it('returns the checkout URL and session id', async () => {
    const result = await adapter.createTopupSession({
      developerId: 'd',
      amountMinorUnits: 100,
      currency: 'USD',
      successUrl: 's',
      cancelUrl: 'c',
    })
    expect(result.checkoutUrl).toBe('https://stripe.com/checkout')
    expect(result.sessionId).toBe('cs_1')
  })

  it('rejects non-positive amounts', async () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      await expect(
        adapter.createTopupSession({
          developerId: 'd',
          amountMinorUnits: bad,
          currency: 'USD',
          successUrl: 's',
          cancelUrl: 'c',
        }),
      ).rejects.toThrowError(/amountMinorUnits/)
    }
  })

  it('rejects missing currency', async () => {
    await expect(
      adapter.createTopupSession({
        developerId: 'd',
        amountMinorUnits: 100,
        currency: '',
        successUrl: 's',
        cancelUrl: 'c',
      }),
    ).rejects.toThrowError(/currency/)
  })

  it('throws when Stripe returns a session without id', async () => {
    mocks.sessionsCreate.mockResolvedValue({ url: 'https://x' })
    await expect(
      adapter.createTopupSession({
        developerId: 'd',
        amountMinorUnits: 100,
        currency: 'USD',
        successUrl: 's',
        cancelUrl: 'c',
      }),
    ).rejects.toThrowError(/id/)
  })

  it('throws when Stripe returns a session without url', async () => {
    mocks.sessionsCreate.mockResolvedValue({ id: 'cs_1', url: null })
    await expect(
      adapter.createTopupSession({
        developerId: 'd',
        amountMinorUnits: 100,
        currency: 'USD',
        successUrl: 's',
        cancelUrl: 'c',
      }),
    ).rejects.toThrowError(/checkout url/)
  })
})

describe('handleWebhook', () => {
  let stripe: StripeClient
  let mocks: Mocks
  let adapter: ReturnType<typeof createStripeRailAdapter>

  beforeEach(() => {
    ;({ stripe, mocks } = buildMockStripe())
    adapter = createStripeRailAdapter({
      stripe,
      appUrl: 'https://x',
      webhookSecret: 'whsec_test',
    })
  })

  it('returns null for invalid event shapes', async () => {
    expect(await adapter.handleWebhook(null)).toBeNull()
    expect(await adapter.handleWebhook(undefined)).toBeNull()
    expect(await adapter.handleWebhook('not-an-object')).toBeNull()
    expect(await adapter.handleWebhook({})).toBeNull()
  })

  it('accepts pre-verified Stripe.Event objects', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_1',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_1',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    })
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('onboarding.status_changed')
    expect(result?.externalAccountId).toBe('acct_1')
    expect(result?.railId).toBe('stripe-connect')
  })

  it('verifies raw webhook envelopes via stripe.webhooks.constructEvent', async () => {
    mocks.webhooksConstructEvent.mockReturnValue({
      id: 'evt_9',
      type: 'account.updated',
      data: {
        object: { id: 'acct_9', charges_enabled: false, payouts_enabled: false, details_submitted: true },
      },
    })
    const result = await adapter.handleWebhook({
      rawBody: '{}',
      signature: 't=1,v1=x',
    })
    expect(mocks.webhooksConstructEvent).toHaveBeenCalledWith('{}', 't=1,v1=x', 'whsec_test')
    expect(result?.kind).toBe('onboarding.status_changed')
  })

  it('throws when a raw envelope arrives but no webhookSecret is configured', async () => {
    const noSecret = createStripeRailAdapter({ stripe, appUrl: 'https://x' })
    await expect(
      noSecret.handleWebhook({ rawBody: '{}', signature: 'x' }),
    ).rejects.toThrowError(/webhookSecret/)
  })

  it('normalizes checkout.session.completed → topup.succeeded', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          amount_total: 500,
          currency: 'usd',
          metadata: { developerId: 'd1' },
        },
      },
    })
    expect(result?.kind).toBe('topup.succeeded')
    expect(result?.data.sessionId).toBe('cs_1')
    expect(result?.data.amountTotal).toBe(500)
    expect(result?.data.developerId).toBe('d1')
  })

  it('normalizes charge.dispute.created → chargeback.opened', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_3',
      type: 'charge.dispute.created',
      data: {
        object: { id: 'dp_1', charge: 'ch_1', amount: 100, currency: 'usd' },
      },
    })
    expect(result?.kind).toBe('chargeback.opened')
    expect(result?.data.disputeId).toBe('dp_1')
  })

  it('normalizes charge.dispute.closed → chargeback.resolved', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_4',
      type: 'charge.dispute.closed',
      data: {
        object: { id: 'dp_2', status: 'won' },
      },
    })
    expect(result?.kind).toBe('chargeback.resolved')
    expect(result?.data.status).toBe('won')
  })

  it('returns null for unrecognized event types', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_5',
      type: 'balance.available',
      data: { object: {} },
    })
    expect(result).toBeNull()
  })

  it('passes the externalEventId through (for idempotency)', async () => {
    const result = await adapter.handleWebhook({
      id: 'evt_unique_12345',
      type: 'account.updated',
      data: { object: { id: 'acct' } },
    })
    expect(result?.externalEventId).toBe('evt_unique_12345')
  })
})
