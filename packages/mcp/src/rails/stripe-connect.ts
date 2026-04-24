/**
 * P2.RAIL1 — StripeRailAdapter.
 *
 * Wraps the Stripe Connect Express integration behind the shared
 * `RailAdapter` interface. Pure refactor — every method maps 1:1 to
 * what the original inline Stripe SDK calls did in
 * apps/web/src/app/api/stripe/connect/*.ts. No behavior change.
 *
 * The adapter takes the Stripe client + appUrl at construction time,
 * so tests can inject a mock client and `packages/mcp` doesn't pull
 * the Stripe SDK as a hard dependency. `stripe` is declared as an
 * optional peerDep — consumers who use this adapter already have it.
 */

import type Stripe from 'stripe'
import type {
  RailAdapter,
  DeveloperProfile,
  OnboardingStatus,
  OnboardingStatusCode,
  TopupParams,
  SettleGridInternalEvent,
} from './types'

/**
 * Minimal Stripe surface the adapter uses. Pulling this out as a type
 * alias lets tests mock without instantiating the real Stripe SDK,
 * and documents exactly which Stripe calls this adapter is allowed
 * to make (anything outside this surface is a regression).
 */
export interface StripeClient {
  accounts: {
    create: Stripe['accounts']['create']
    retrieve: Stripe['accounts']['retrieve']
  }
  accountLinks: {
    create: Stripe['accountLinks']['create']
  }
  checkout: {
    sessions: {
      create: Stripe['checkout']['sessions']['create']
    }
  }
  webhooks: {
    constructEvent: Stripe['webhooks']['constructEvent']
  }
}

export interface StripeRailAdapterOptions {
  /** Already-constructed Stripe client. */
  stripe: StripeClient
  /** Absolute base URL (no trailing slash) used to build return URLs. */
  appUrl: string
  /**
   * Optional Stripe account-type selector. Defaults to 'express' per
   * Pattern A+. Callers can override for 'standard' / 'custom' if a
   * future routing decision demands it.
   */
  accountType?: 'express' | 'standard' | 'custom'
  /**
   * Optional webhook signing secret. Only used by `handleWebhook` —
   * omit if the caller verifies signatures itself before calling
   * `handleWebhook(event)` with a pre-verified Stripe.Event.
   */
  webhookSecret?: string
}

/**
 * Stripe-specific extensions to the RailAdapter interface. Exposes
 * two-step onboarding primitives (`ensureAccount` +
 * `createOnboardingLink`) that callers use when they need to persist
 * the externalId to their DB BETWEEN the two Stripe API calls.
 * Consumers that don't need resumability use the plain
 * `startOnboarding` method defined on `RailAdapter`.
 */
export interface StripeRailAdapter extends RailAdapter {
  ensureAccount(
    dev: DeveloperProfile,
  ): Promise<{ externalId: string; created: boolean }>
  createOnboardingLink(externalId: string): Promise<{ url: string }>
}

/**
 * Factory for the Stripe Connect rail adapter. Returns a
 * StripeRailAdapter (which satisfies the base RailAdapter interface
 * plus the Stripe-specific two-step onboarding primitives).
 */
export function createStripeRailAdapter(
  opts: StripeRailAdapterOptions,
): StripeRailAdapter {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError(
      'createStripeRailAdapter: `opts` is required and must be an object.',
    )
  }
  if (!opts.stripe || typeof opts.stripe !== 'object') {
    throw new TypeError(
      'createStripeRailAdapter: `opts.stripe` must be a Stripe client instance.',
    )
  }
  if (!opts.appUrl || typeof opts.appUrl !== 'string' || opts.appUrl.trim().length === 0) {
    throw new TypeError(
      'createStripeRailAdapter: `opts.appUrl` must be a non-empty string.',
    )
  }
  const appUrl = opts.appUrl.replace(/\/+$/, '')
  const stripe = opts.stripe
  const accountType = opts.accountType ?? 'express'
  const webhookSecret = opts.webhookSecret

  /**
   * Ensure a Stripe Connect account exists for the developer.
   * Returns the existing externalId when one is provided OR creates a
   * new Connect account. Split out from `startOnboarding` so callers
   * can persist the new externalId to their DB BETWEEN account
   * creation and onboarding-link creation — critical for resumability
   * when accountLinks.create fails (otherwise the next retry creates
   * an orphan duplicate account).
   */
  async function ensureAccount(
    dev: DeveloperProfile,
  ): Promise<{ externalId: string; created: boolean }> {
    if (!dev || typeof dev !== 'object') {
      throw new TypeError('ensureAccount: `dev` is required.')
    }
    if (!dev.developerId) {
      throw new TypeError('ensureAccount: `dev.developerId` is required.')
    }
    if (!dev.email) {
      throw new TypeError('ensureAccount: `dev.email` is required.')
    }
    if (dev.existingExternalId) {
      return { externalId: dev.existingExternalId, created: false }
    }
    const account = await stripe.accounts.create({
      type: accountType,
      email: dev.email,
      metadata: { developerId: dev.developerId },
      capabilities: { transfers: { requested: true } },
    })
    // Defensive: Stripe's typings say id is always a string on
    // create, but a malformed response (proxy stripped fields, etc.)
    // would let an undefined slip into the caller's DB persist. Fail
    // fast here instead.
    if (typeof account.id !== 'string' || account.id.length === 0) {
      throw new Error(
        'ensureAccount: Stripe accounts.create returned no account id',
      )
    }
    return { externalId: account.id, created: true }
  }

  /**
   * Create the account-onboarding link for an existing external
   * account. Caller MUST have already persisted the externalId before
   * calling this — if the link creation fails, a retry can re-call
   * this with the same externalId rather than orphaning another
   * account.
   */
  async function createOnboardingLink(
    externalId: string,
  ): Promise<{ url: string }> {
    if (!externalId || typeof externalId !== 'string') {
      throw new TypeError('createOnboardingLink: `externalId` is required.')
    }
    const accountLink = await stripe.accountLinks.create({
      account: externalId,
      refresh_url: `${appUrl}/dashboard/settings?stripe=refresh`,
      return_url: `${appUrl}/api/stripe/connect/callback?account_id=${encodeURIComponent(externalId)}`,
      type: 'account_onboarding',
    })
    // Defensive: accountLink.url is always a string per Stripe's
    // typings, but a malformed response would leave the caller
    // redirecting the developer to `undefined`.
    if (typeof accountLink.url !== 'string' || accountLink.url.length === 0) {
      throw new Error(
        'createOnboardingLink: Stripe accountLinks.create returned no url',
      )
    }
    return { url: accountLink.url }
  }

  /**
   * Convenience wrapper: ensureAccount + createOnboardingLink. Callers
   * that want the two-step resumable flow should call the primitives
   * directly; callers fine with the atomic "create + link or fail"
   * shape can call this. RailAdapter interface contract.
   */
  async function startOnboarding(
    dev: DeveloperProfile,
  ): Promise<{ url: string; externalId: string }> {
    const { externalId } = await ensureAccount(dev)
    const { url } = await createOnboardingLink(externalId)
    return { url, externalId }
  }

  async function syncOnboardingStatus(
    externalId: string,
  ): Promise<OnboardingStatus> {
    if (!externalId || typeof externalId !== 'string') {
      throw new TypeError('syncOnboardingStatus: `externalId` is required.')
    }
    const account = await stripe.accounts.retrieve(externalId)
    const chargesEnabled = account.charges_enabled === true
    const payoutsEnabled = account.payouts_enabled === true
    const detailsSubmitted = account.details_submitted === true

    let code: OnboardingStatusCode
    if (chargesEnabled && payoutsEnabled) {
      code = 'active'
    } else if (detailsSubmitted) {
      code = 'pending'
    } else {
      code = 'incomplete'
    }

    // Stripe's Account object has no single "status" string. For the
    // debug field we compose the three flags that DRIVE the code,
    // so a reader troubleshooting a status can see exactly which
    // Stripe signals were true. Matches the pattern other rails'
    // adapters should follow (Paddle would use its `status` enum,
    // etc.).
    const nativeStatus =
      `charges_enabled=${chargesEnabled};` +
      `payouts_enabled=${payoutsEnabled};` +
      `details_submitted=${detailsSubmitted}`

    return {
      code,
      nativeStatus,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    }
  }

  async function createTopupSession(
    params: TopupParams,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    if (!params || typeof params !== 'object') {
      throw new TypeError('createTopupSession: `params` is required.')
    }
    if (!Number.isInteger(params.amountMinorUnits) || params.amountMinorUnits <= 0) {
      throw new TypeError(
        'createTopupSession: `amountMinorUnits` must be a positive integer.',
      )
    }
    if (!params.currency || typeof params.currency !== 'string') {
      throw new TypeError('createTopupSession: `currency` is required.')
    }
    // Stripe requires lowercase ISO-4217 with no leading/trailing
    // whitespace. Normalize defensively — "USD " from user input or
    // sloppy upstream pipes would otherwise cause a 400 from Stripe
    // with a confusing "Invalid currency" error.
    const currency = params.currency.trim().toLowerCase()
    if (currency.length === 0) {
      throw new TypeError('createTopupSession: `currency` is required.')
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'SettleGrid credit top-up' },
            unit_amount: params.amountMinorUnits,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        // Caller-supplied metadata first, then our developerId so it
        // ALWAYS wins — a malicious caller passing
        // `metadata: { developerId: 'OVERRIDE' }` cannot forge the
        // developer identity on the top-up session.
        ...(params.metadata ?? {}),
        developerId: params.developerId,
      },
    })

    // session.id is string | null per Stripe's types in some API
    // versions; the checkout session always has an id at creation.
    const sessionId = session.id
    const checkoutUrl = session.url ?? ''
    if (!sessionId) {
      throw new Error('Stripe returned a session without an id')
    }
    if (!checkoutUrl) {
      throw new Error('Stripe returned a session without a checkout url')
    }
    return { checkoutUrl, sessionId }
  }

  async function handleWebhook(
    event: unknown,
  ): Promise<SettleGridInternalEvent | null> {
    // Callers are expected to hand a pre-verified Stripe.Event object
    // OR a { rawBody, signature } envelope that the adapter verifies
    // using the configured webhookSecret. We accept both shapes.
    let stripeEvent: Stripe.Event
    if (
      event &&
      typeof event === 'object' &&
      'rawBody' in event &&
      'signature' in event
    ) {
      if (!webhookSecret) {
        throw new Error(
          'handleWebhook: opts.webhookSecret is required to verify raw webhook envelopes',
        )
      }
      const envelope = event as { rawBody: string | Buffer; signature: string }
      stripeEvent = stripe.webhooks.constructEvent(
        envelope.rawBody,
        envelope.signature,
        webhookSecret,
      )
    } else if (
      event &&
      typeof event === 'object' &&
      'type' in event &&
      'id' in event
    ) {
      stripeEvent = event as Stripe.Event
    } else {
      return null
    }

    switch (stripeEvent.type) {
      case 'account.updated': {
        const account = stripeEvent.data.object as Stripe.Account
        return {
          kind: 'onboarding.status_changed',
          railId: 'stripe-connect',
          externalEventId: stripeEvent.id,
          externalAccountId: account.id,
          data: {
            chargesEnabled: account.charges_enabled === true,
            payoutsEnabled: account.payouts_enabled === true,
            detailsSubmitted: account.details_submitted === true,
          },
        }
      }
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session
        return {
          kind: 'topup.succeeded',
          railId: 'stripe-connect',
          externalEventId: stripeEvent.id,
          data: {
            sessionId: session.id,
            amountTotal: session.amount_total,
            currency: session.currency,
            developerId: session.metadata?.developerId,
          },
        }
      }
      case 'charge.dispute.created': {
        const dispute = stripeEvent.data.object as Stripe.Dispute
        return {
          kind: 'chargeback.opened',
          railId: 'stripe-connect',
          externalEventId: stripeEvent.id,
          data: {
            disputeId: dispute.id,
            chargeId: dispute.charge,
            amount: dispute.amount,
            currency: dispute.currency,
          },
        }
      }
      case 'charge.dispute.closed': {
        const dispute = stripeEvent.data.object as Stripe.Dispute
        return {
          kind: 'chargeback.resolved',
          railId: 'stripe-connect',
          externalEventId: stripeEvent.id,
          data: {
            disputeId: dispute.id,
            status: dispute.status,
          },
        }
      }
      default:
        // Unrecognized event — not an error; the webhook just isn't
        // relevant to our normalized state.
        return null
    }
  }

  const adapter: StripeRailAdapter = {
    id: 'stripe-connect',
    displayName: STRIPE_CONNECT_DISPLAY_NAME,
    legalStructure: 'platform',
    capabilities: STRIPE_CONNECT_CAPABILITIES,
    compliance: STRIPE_CONNECT_COMPLIANCE,
    pricing: STRIPE_CONNECT_PRICING,
    startOnboarding,
    syncOnboardingStatus,
    createTopupSession,
    handleWebhook,
    ensureAccount,
    createOnboardingLink,
  }

  return adapter
}

/**
 * Static capability envelope for Stripe Connect. Per Stripe's public
 * country matrix as of 2026-04-17; update when Stripe expands.
 * Source of truth: https://stripe.com/global
 */
export const STRIPE_CONNECT_CAPABILITIES = {
  individualCountries: [
    'AU', 'AT', 'BE', 'BR', 'BG', 'CA', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
    'FR', 'DE', 'GI', 'GR', 'HK', 'HU', 'IN', 'IE', 'IT', 'JP', 'LV', 'LI',
    'LT', 'LU', 'MT', 'MX', 'NL', 'NZ', 'NO', 'PL', 'PT', 'RO', 'SG', 'SK',
    'SI', 'ES', 'SE', 'CH', 'TH', 'AE', 'GB', 'US',
  ],
  businessCountries: [
    'AU', 'AT', 'BE', 'BR', 'BG', 'CA', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
    'FR', 'DE', 'GI', 'GR', 'HK', 'HU', 'IN', 'IE', 'IT', 'JP', 'LV', 'LI',
    'LT', 'LU', 'MT', 'MX', 'NL', 'NZ', 'NO', 'PL', 'PT', 'RO', 'SG', 'SK',
    'SI', 'ES', 'SE', 'CH', 'TH', 'AE', 'GB', 'US',
  ],
  payoutCurrencies: [
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'DKK', 'HKD', 'INR', 'JPY',
    'MXN', 'NOK', 'NZD', 'SEK', 'SGD', 'THB', 'BGN', 'BRL', 'CZK', 'HUF',
    'PLN', 'RON', 'AED',
  ],
  acceptCurrencies: [
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'DKK', 'HKD', 'INR', 'JPY',
    'MXN', 'NOK', 'NZD', 'SEK', 'SGD', 'THB', 'BGN', 'BRL', 'CZK', 'HUF',
    'PLN', 'RON', 'AED',
  ],
  supportsMeteredCheckout: true,
  supportsApplicationFees: true,
} as const

export const STRIPE_CONNECT_COMPLIANCE = {
  kycAml: 'rail',
  sanctionsScreening: 'rail',
  taxFormCollection: 'rail',
  taxFormIssuance: 'rail',
  vatGstCollection: 'rail',
  moneyTransmission: 'rail',
  chargebacks: 'settlegrid', // Platform absorbs Express negative balances.
} as const

/**
 * Public display name for the Stripe Connect rail. Safe to import
 * from client bundles — contains no SDK coupling. Dashboards render
 * this string next to the connection-status badge so renaming the
 * rail (e.g., "Stripe Payouts" → "Stripe Connect Standard") updates
 * the UI from the registry's single source of truth.
 */
export const STRIPE_CONNECT_DISPLAY_NAME = 'Stripe Connect' as const

/**
 * P3.K4 — Stripe Connect rate card. Values are illustrative for the
 * scaffold:
 *   - Base: 2.9% + 30 cents (Stripe's stated US card processing)
 *   - Volume tier at $50k / month: 2.7% (negotiated tier, placeholder)
 *   - Volume tier at $250k / month: 2.5% (enterprise, placeholder)
 *   - GBP / EUR surcharge: +100 bps (Stripe cross-border + FX markup)
 *
 * The precise numbers are operator-configurable and should come from
 * the developer's signed Stripe contract — the shape here is what the
 * router consumes. `percentBps` / `flatCents` are aliased to the base
 * so legacy readers keep working during the migration.
 */
export const STRIPE_CONNECT_PRICING = {
  basePercentBps: 290,
  baseFlatCents: 30,
  volumeTiers: [
    { minMonthlyCents: 5_000_000, percentBps: 270, flatCents: 30 },
    { minMonthlyCents: 25_000_000, percentBps: 250, flatCents: 30 },
  ],
  currencySurcharges: {
    GBP: { percentBps: 100 },
    EUR: { percentBps: 100 },
  },
  // Legacy aliases — read by code paths that haven't migrated to the
  // rate-card reader. Populated from the base tier so existing
  // `adapter.pricing.percentBps` references continue to return the
  // "starter" rate (which is what they assumed pre-P3.K4).
  percentBps: 290,
  flatCents: 30,
  notes:
    'Reference only — actual Stripe fees depend on country, card type, and currency. See https://stripe.com/pricing',
} as const

// The `StripeRailAdapter` interface is exported above. The factory
// is `createStripeRailAdapter`. No runtime alias is necessary — TS
// declaration-namespace rules let `StripeRailAdapter` refer to the
// interface when used as a type, and the factory function is always
// spelled `createStripeRailAdapter` when invoked.
