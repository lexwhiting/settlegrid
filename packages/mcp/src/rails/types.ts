/**
 * P2.RAIL1 — RailAdapter interface.
 *
 * Per `private/master-plan/multi-rail-architecture.md` (Pattern A+).
 * SettleGrid abstracts rail-specific logic (Stripe Connect today;
 * Paddle / Lemon Squeezy / Wise / Razorpay / Flutterwave possibly
 * later) behind a single interface so future rail additions don't
 * require rewriting dashboards or webhook handlers.
 *
 * This is a PURE TYPE LAYER — no runtime behavior. Implementations
 * live alongside in sibling files (stripe-connect.ts today) and are
 * wired into the registry (registry.ts).
 */

/** Canonical identifier for each rail. The registry uses this as a key. */
export type RailId =
  | 'stripe-connect'
  | 'paddle'
  | 'lemon-squeezy'
  | 'wise-batch'
  | 'razorpay-route'
  | 'flutterwave'

/**
 * Legal structure the rail operates under. Determines who holds funds,
 * who issues tax forms, and who absorbs compliance duties.
 *
 * - `platform`: SettleGrid is a platform; rail holds funds (Stripe Connect).
 * - `merchant-of-record`: rail is MoR; rail issues consumer receipts (Paddle, LS).
 * - `agent-of-payee`: rail disburses on SettleGrid's behalf (Wise).
 * - `crypto-rail`: non-fiat settlement (e.g., Circle-native rails).
 */
export type LegalStructure =
  | 'platform'
  | 'merchant-of-record'
  | 'agent-of-payee'
  | 'crypto-rail'

/**
 * Who absorbs each compliance obligation when the rail is in use.
 * `rail` = the upstream provider absorbs it; `settlegrid` = we do;
 * `developer` = the merchant developer does.
 */
export interface ComplianceResponsibility {
  kycAml: 'rail' | 'settlegrid' | 'developer'
  sanctionsScreening: 'rail' | 'settlegrid' | 'developer'
  taxFormCollection: 'rail' | 'settlegrid' | 'developer'
  taxFormIssuance: 'rail' | 'settlegrid' | 'developer'
  vatGstCollection: 'rail' | 'settlegrid' | 'developer'
  moneyTransmission: 'rail' | 'settlegrid' | 'developer'
  chargebacks: 'rail' | 'settlegrid' | 'developer'
}

/**
 * Static capability envelope for a rail. Drives the routing function.
 *
 * Arrays are `readonly` because implementations should declare them
 * with `as const` to prevent accidental mutation (e.g., adding a
 * country at runtime would invalidate the routing-decision cache).
 */
export interface RailCapabilities {
  /** ISO-3166 alpha-2 country codes the rail supports for individual accounts. */
  individualCountries: readonly string[]
  /** ISO-3166 alpha-2 codes supported for business accounts. */
  businessCountries: readonly string[]
  /** ISO-4217 currencies the rail can PAY OUT to developer banks. */
  payoutCurrencies: readonly string[]
  /** ISO-4217 currencies the rail can ACCEPT on the consumer side. */
  acceptCurrencies: readonly string[]
  /** True if the rail supports metered checkout (usage-based billing). */
  supportsMeteredCheckout: boolean
  /** True if the rail supports platform application fees. */
  supportsApplicationFees: boolean
}

/** Minimal developer identity the adapter needs to start onboarding. */
export interface DeveloperProfile {
  /** SettleGrid-internal developer ID (UUID / opaque string). */
  developerId: string
  /** Verified email address; used as the rail account's contact. */
  email: string
  /**
   * If the developer has already begun onboarding and has an external
   * rail account ID, pass it here so the adapter links to it rather
   * than creating a duplicate account.
   */
  existingExternalId?: string
  /** Optional display name for the rail account. */
  name?: string
}

/**
 * Normalized onboarding status across rails. Implementations map their
 * native status → one of these values. Dashboards and routing logic
 * read THIS enum, never the rail-specific string.
 */
export type OnboardingStatusCode =
  | 'not_started'
  | 'pending'
  | 'incomplete'
  | 'active'
  | 'restricted'
  | 'rejected'

export interface OnboardingStatus {
  code: OnboardingStatusCode
  /** Rail-native status string (for debugging; never used for logic). */
  nativeStatus?: string
  /** True if the rail considers the account ready to accept charges. */
  chargesEnabled: boolean
  /** True if the rail considers the account ready to receive payouts. */
  payoutsEnabled: boolean
  /** True if the developer has submitted the onboarding form. */
  detailsSubmitted: boolean
}

/** Parameters for creating a consumer top-up / checkout session. */
export interface TopupParams {
  /** SettleGrid developer ID whose balance the top-up credits. */
  developerId: string
  /** Amount to charge, in the smallest currency unit (cents for USD). */
  amountMinorUnits: number
  /** ISO-4217 currency code. */
  currency: string
  /** URL to return to on success. */
  successUrl: string
  /** URL to return to on cancel. */
  cancelUrl: string
  /** Optional customer email for prefilling the checkout form. */
  customerEmail?: string
  /** Free-form metadata threaded through to the rail-native session. */
  metadata?: Record<string, string>
}

/**
 * Rail-agnostic normalized webhook event. Each adapter's
 * `handleWebhook` translates native events (Stripe `account.updated`,
 * Paddle `subscription.activated`, etc.) into this shape so
 * downstream handlers can remain rail-agnostic.
 */
export type SettleGridInternalEventKind =
  | 'onboarding.status_changed'
  | 'topup.succeeded'
  | 'topup.failed'
  | 'payout.succeeded'
  | 'payout.failed'
  | 'chargeback.opened'
  | 'chargeback.resolved'
  | 'unknown'

export interface SettleGridInternalEvent {
  kind: SettleGridInternalEventKind
  /** Rail that emitted the event. */
  railId: RailId
  /** Rail-native event ID for idempotency / dedup. */
  externalEventId: string
  /** External rail account ID the event pertains to, if applicable. */
  externalAccountId?: string
  /** Free-form event payload (normalized subset). Consumers should NOT
   *  rely on the full native shape; only on the documented fields. */
  data: Record<string, unknown>
}

/**
 * THE canonical rail adapter interface. Each rail's implementation file
 * exports a `StripeRailAdapter` / `PaddleRailAdapter` / ... that
 * satisfies this shape.
 */
export interface RailAdapter {
  /** Stable rail identifier; used as the registry key. */
  readonly id: RailId
  /** Human-readable name shown in dashboards. */
  readonly displayName: string
  /** Legal structure the rail operates under. */
  readonly legalStructure: LegalStructure
  /** Static capability envelope. */
  readonly capabilities: RailCapabilities
  /** Compliance obligation split. */
  readonly compliance: ComplianceResponsibility
  /** Rail pricing — basis points + flat cents per transaction. */
  readonly pricing: {
    percentBps: number
    flatCents: number
    notes?: string
  }

  /**
   * Begin onboarding for a developer. Returns a URL the developer
   * must visit to complete the rail's native onboarding form +
   * the external account ID the rail assigned.
   */
  startOnboarding(
    dev: DeveloperProfile,
  ): Promise<{ url: string; externalId: string }>

  /**
   * Re-read the rail's view of an account and return the normalized
   * onboarding status. Called on OAuth-style callback and on
   * periodic sync jobs.
   */
  syncOnboardingStatus(externalId: string): Promise<OnboardingStatus>

  /**
   * Create a consumer-facing top-up / checkout session. Returns the
   * URL the consumer must visit and the rail-native session ID.
   */
  createTopupSession(
    params: TopupParams,
  ): Promise<{ checkoutUrl: string; sessionId: string }>

  /**
   * Translate a rail-native webhook event into the normalized
   * `SettleGridInternalEvent` shape. Returns `null` if the event is
   * not relevant to SettleGrid's internal state.
   */
  handleWebhook(event: unknown): Promise<SettleGridInternalEvent | null>
}
