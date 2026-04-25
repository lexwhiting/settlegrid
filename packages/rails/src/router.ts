/**
 * P3.RAIL1 — Stripe Connect account-type router.
 *
 * Pure functions. No I/O at runtime. The country matrix is bundled at
 * build time from `../data/stripe-connect-countries.json` (the
 * canonical source of truth — manually refreshed on a quarterly
 * cadence; see `packages/rails/data/README.md`).
 *
 * Two exported entry points:
 *
 *   - `selectStripeAccountType({ countryIso, entityType, tier?,
 *      requestsSelfManaged? })` — decides which Stripe Connect account
 *      type (Express / Standard / Custom) to provision. Throws
 *      `UnsupportedCountryError` if no Stripe variant fits — the
 *      caller (an /api/eligibility route or the /onboarding page)
 *      catches that and routes the developer to the waitlist.
 *
 *   - `routeDeveloper({ countryIso, entityType, preferredCurrency,
 *      tier?, requestsSelfManaged? })` — decides which rail to use
 *      (today: only `'stripe-connect'`) and the account type within
 *      it. Wraps `selectStripeAccountType` plus a payout-currency
 *      check.
 *
 * The router is the SINGLE place account-type decisions happen
 * (DoD: "routeDeveloper + selectStripeAccountType are the only places
 * account-type decisions happen"). Other modules call into this one;
 * they do not duplicate the priority chain.
 *
 * # Hostile-lens contracts
 *
 *   - **Frozen audit data:** every `RoutingDecision` returned is
 *     `Object.freeze`d so a caller cannot mutate the decision after
 *     the fact and corrupt downstream audit records. The matrix
 *     itself is also deep-frozen on load.
 *   - **Fail-closed on malformed matrix:** `loadCountryMatrix()`
 *     throws `ConfigurationError` rather than returning a partial
 *     view. A misconfigured deploy fails fast at boot, not at the
 *     first eligibility check.
 *   - **No information leak in errors:** `UnsupportedCountryError`
 *     surfaces a small enum (`waitlistReason`) — it does NOT echo
 *     the full supported-countries list. The /api/eligibility route
 *     transforms this into a generic 200 response so a probing
 *     client can't enumerate the matrix via differential responses.
 *   - **Idempotent matrix loading:** the parsed + frozen matrix is
 *     cached after first call; subsequent calls return the same
 *     reference (cheap, and the frozen instance is immutable).
 *   - **Bounded inputs:** all string inputs are length-clamped during
 *     validation — a malicious caller passing a 10MB country code
 *     hits a synchronous TypeError before any list traversal.
 */

import rawCountryMatrix from '../data/stripe-connect-countries.json'

// ─── Public types ────────────────────────────────────────────────────

/** ISO-3166 alpha-2 entity type the developer registers as. */
export type EntityType = 'individual' | 'company'

/**
 * Stripe Connect account type. Each has different onboarding +
 * compliance properties:
 *
 *   - `'express'` — Stripe-managed onboarding, platform absorbs
 *     dispute liability for connected-account negative balances.
 *     Default for all supported countries (see Pattern A+).
 *   - `'standard'` — developer manages their own Stripe dashboard,
 *     handles their own disputes. Wider country coverage than
 *     Express. Routed when a Scale-tier developer explicitly opts in
 *     (`requestsSelfManaged: true`) AND Express isn't available for
 *     their country.
 *   - `'custom'` — platform-managed onboarding for compliance-heavy
 *     cases. Reserved for future country-specific carve-outs.
 */
export type StripeAccountType = 'express' | 'standard' | 'custom'

/** Developer subscription tier — affects routing escalations. */
export type DeveloperTier = 'free' | 'builder' | 'scale'

/**
 * Why a developer hit the waitlist. The eligibility API maps these to
 * branded user-facing copy; consumers SHOULD treat the reason as an
 * opaque enum (string-matching is brittle).
 */
export type WaitlistReason =
  | 'country_not_supported_for_entity_type'
  | 'preferred_currency_not_supported'

/** The country / currency / entity matrix consumed by the router. */
export interface CountryMatrix {
  readonly _meta: {
    readonly source: string
    readonly lastRefreshedAt: string
    readonly refreshCadenceDays: number
    readonly refreshNotes: string
  }
  readonly express: {
    readonly individualCountries: readonly string[]
    readonly businessCountries: readonly string[]
  }
  readonly standard: {
    readonly individualCountries: readonly string[]
    readonly businessCountries: readonly string[]
  }
  readonly custom: {
    readonly individualCountries: readonly string[]
    readonly businessCountries: readonly string[]
  }
  readonly payoutCurrencies: readonly string[]
}

/** Input to `selectStripeAccountType`. */
export interface SelectAccountTypeInput {
  /** ISO-3166 alpha-2 country code; case-insensitive. */
  countryIso: string
  /** Whether the developer registered as an individual or a company. */
  entityType: EntityType
  /** Subscription tier (defaults to `'free'`). */
  tier?: DeveloperTier
  /**
   * True if the developer EXPLICITLY opted in to Stripe Standard for
   * self-managed disputes / custom payout schedules. Only Scale-tier
   * developers can trigger the Standard escalation. Default: `false`.
   */
  requestsSelfManaged?: boolean
}

/** Input to `routeDeveloper`. */
export interface RouteDeveloperInput extends SelectAccountTypeInput {
  /** ISO-4217 alpha-3 currency code; case-insensitive. */
  preferredCurrency: string
}

/** Decision returned by `routeDeveloper`. Frozen on return. */
export interface RoutingDecision {
  readonly railId: 'stripe-connect'
  readonly accountType: StripeAccountType
  readonly reason: string
  readonly countryIso: string
  readonly entityType: EntityType
  readonly preferredCurrency: string
}

// ─── Error classes ───────────────────────────────────────────────────

/**
 * Thrown when no Stripe Connect variant can serve the developer's
 * country/entity-type/currency combination. Caller routes to waitlist.
 *
 * Carries a small enum (`waitlistReason`) — NOT the full unsupported
 * matrix — so a probing client cannot enumerate Stripe coverage by
 * spamming requests with different country codes.
 */
export class UnsupportedCountryError extends Error {
  readonly name = 'UnsupportedCountryError'
  readonly code = 'unsupported_country' as const
  readonly countryIso: string
  readonly entityType: EntityType
  readonly waitlistReason: WaitlistReason

  constructor(init: {
    countryIso: string
    entityType: EntityType
    waitlistReason: WaitlistReason
  }) {
    super(
      `No Stripe Connect variant supports ${init.entityType} ` +
        `accounts in ${init.countryIso} (reason: ${init.waitlistReason}).`,
    )
    this.countryIso = init.countryIso
    this.entityType = init.entityType
    this.waitlistReason = init.waitlistReason
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the bundled country matrix JSON is malformed (wrong
 * shape, non-string country code, etc.). Indicates a deploy-time
 * misconfiguration, NOT a runtime input problem. Distinct from
 * `UnsupportedCountryError` so on-call dashboards can alert on it
 * separately.
 */
export class ConfigurationError extends Error {
  readonly name = 'ConfigurationError'
  readonly code = 'configuration_error' as const
  readonly field: string

  constructor(init: { field: string; reason: string }) {
    super(`Country matrix configuration error at \`${init.field}\`: ${init.reason}`)
    this.field = init.field
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when a caller passes structurally-invalid input (non-string
 * country, wrong-length code, unknown entity-type, etc.). Distinct
 * from `UnsupportedCountryError` because the latter is a "valid input,
 * just no rail support" outcome — an `InvalidInputError` is a caller
 * bug.
 */
export class InvalidInputError extends Error {
  readonly name = 'InvalidInputError'
  readonly code = 'invalid_input' as const
  readonly field: string

  constructor(init: { field: string; reason: string }) {
    super(`Invalid input \`${init.field}\`: ${init.reason}`)
    this.field = init.field
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Matrix loader (cached + frozen) ─────────────────────────────────

const ISO_COUNTRY = /^[A-Z]{2}$/
const ISO_CURRENCY = /^[A-Z]{3}$/
const MAX_INPUT_LEN = 32

let cachedMatrix: CountryMatrix | undefined

/**
 * Validate + freeze the bundled country matrix. Idempotent — first
 * call validates and freezes; subsequent calls return the cached
 * reference. Throws `ConfigurationError` on malformed JSON so a
 * misconfigured deploy fails fast at boot.
 *
 * Exported so apps/web's `/api/eligibility` route can preload at
 * route module load and surface configuration errors at deploy time
 * instead of at the first eligibility check.
 */
export function loadCountryMatrix(): CountryMatrix {
  if (cachedMatrix !== undefined) return cachedMatrix
  cachedMatrix = parseAndFreezeMatrix(rawCountryMatrix as unknown)
  return cachedMatrix
}

/**
 * TEST-ONLY: clear the cached matrix. Lets tests inject a fresh
 * matrix without leaking state between cases. Refuses to run outside
 * `NODE_ENV === 'test'` so a misdirected production call cannot DoS
 * the routing layer by forcing re-parse on every request.
 */
export function __resetMatrixCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      '__resetMatrixCacheForTests is test-only. Refusing to run outside NODE_ENV===test.',
    )
  }
  cachedMatrix = undefined
}

/**
 * TEST-ONLY: invoke the matrix parser directly so config-validation
 * paths get coverage even though the bundled JSON is well-formed.
 * Refuses to run outside `NODE_ENV === 'test'` for the same reason
 * `__resetMatrixCacheForTests` does — a production call would burn
 * cycles re-parsing per request.
 */
export function __parseMatrixForTests(raw: unknown): CountryMatrix {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      '__parseMatrixForTests is test-only. Refusing to run outside NODE_ENV===test.',
    )
  }
  return parseAndFreezeMatrix(raw)
}

function parseAndFreezeMatrix(raw: unknown): CountryMatrix {
  if (raw === null || typeof raw !== 'object') {
    throw new ConfigurationError({
      field: 'root',
      reason: 'matrix must be a non-null object',
    })
  }
  const r = raw as Record<string, unknown>

  const _meta = r['_meta']
  if (!_meta || typeof _meta !== 'object') {
    throw new ConfigurationError({ field: '_meta', reason: 'must be an object' })
  }
  const m = _meta as Record<string, unknown>
  if (typeof m['source'] !== 'string') {
    throw new ConfigurationError({ field: '_meta.source', reason: 'must be a string' })
  }
  if (typeof m['lastRefreshedAt'] !== 'string') {
    throw new ConfigurationError({
      field: '_meta.lastRefreshedAt',
      reason: 'must be a string',
    })
  }
  if (typeof m['refreshCadenceDays'] !== 'number' || !Number.isFinite(m['refreshCadenceDays'])) {
    throw new ConfigurationError({
      field: '_meta.refreshCadenceDays',
      reason: 'must be a finite number',
    })
  }
  if (typeof m['refreshNotes'] !== 'string') {
    throw new ConfigurationError({
      field: '_meta.refreshNotes',
      reason: 'must be a string',
    })
  }

  const express = parseTypeBlock(r['express'], 'express')
  const standard = parseTypeBlock(r['standard'], 'standard')
  const custom = parseTypeBlock(r['custom'], 'custom')

  const payoutCurrencies = parseCurrencyList(
    r['payoutCurrencies'],
    'payoutCurrencies',
  )

  const matrix: CountryMatrix = {
    _meta: Object.freeze({
      source: m['source'] as string,
      lastRefreshedAt: m['lastRefreshedAt'] as string,
      refreshCadenceDays: m['refreshCadenceDays'] as number,
      refreshNotes: m['refreshNotes'] as string,
    }),
    express,
    standard,
    custom,
    payoutCurrencies,
  }
  return Object.freeze(matrix)
}

function parseTypeBlock(
  raw: unknown,
  field: string,
): { readonly individualCountries: readonly string[]; readonly businessCountries: readonly string[] } {
  if (!raw || typeof raw !== 'object') {
    throw new ConfigurationError({ field, reason: 'must be an object' })
  }
  const r = raw as Record<string, unknown>
  return Object.freeze({
    individualCountries: parseCountryList(
      r['individualCountries'],
      `${field}.individualCountries`,
    ),
    businessCountries: parseCountryList(
      r['businessCountries'],
      `${field}.businessCountries`,
    ),
  })
}

function parseCountryList(raw: unknown, field: string): readonly string[] {
  if (!Array.isArray(raw)) {
    throw new ConfigurationError({ field, reason: 'must be an array' })
  }
  // Build via map, then assert each entry, then freeze. We DO NOT
  // mutate the underlying array — `as const` plus Object.freeze gives
  // both compile-time and runtime immutability.
  const cleaned = raw.map((entry, idx) => {
    if (typeof entry !== 'string') {
      throw new ConfigurationError({
        field: `${field}[${idx}]`,
        reason: 'must be a string',
      })
    }
    if (!ISO_COUNTRY.test(entry)) {
      throw new ConfigurationError({
        field: `${field}[${idx}]`,
        reason: `must be ISO-3166 alpha-2 (uppercase 2-letter); got ${JSON.stringify(entry)}`,
      })
    }
    return entry
  })
  return Object.freeze(cleaned)
}

function parseCurrencyList(raw: unknown, field: string): readonly string[] {
  if (!Array.isArray(raw)) {
    throw new ConfigurationError({ field, reason: 'must be an array' })
  }
  const cleaned = raw.map((entry, idx) => {
    if (typeof entry !== 'string') {
      throw new ConfigurationError({
        field: `${field}[${idx}]`,
        reason: 'must be a string',
      })
    }
    if (!ISO_CURRENCY.test(entry)) {
      throw new ConfigurationError({
        field: `${field}[${idx}]`,
        reason: `must be ISO-4217 alpha-3 (uppercase 3-letter); got ${JSON.stringify(entry)}`,
      })
    }
    return entry
  })
  return Object.freeze(cleaned)
}

// ─── Input validation ────────────────────────────────────────────────

function assertCountryIso(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new InvalidInputError({ field, reason: 'must be a string' })
  }
  if (value.length === 0 || value.length > MAX_INPUT_LEN) {
    throw new InvalidInputError({
      field,
      reason: `length must be in (0, ${MAX_INPUT_LEN}]`,
    })
  }
  const upper = value.trim().toUpperCase()
  if (!ISO_COUNTRY.test(upper)) {
    throw new InvalidInputError({
      field,
      reason: 'must be ISO-3166 alpha-2 (2 letters)',
    })
  }
  return upper
}

function assertCurrency(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new InvalidInputError({ field, reason: 'must be a string' })
  }
  if (value.length === 0 || value.length > MAX_INPUT_LEN) {
    throw new InvalidInputError({
      field,
      reason: `length must be in (0, ${MAX_INPUT_LEN}]`,
    })
  }
  const upper = value.trim().toUpperCase()
  if (!ISO_CURRENCY.test(upper)) {
    throw new InvalidInputError({
      field,
      reason: 'must be ISO-4217 alpha-3 (3 letters)',
    })
  }
  return upper
}

function assertEntityType(value: unknown, field: string): EntityType {
  if (value !== 'individual' && value !== 'company') {
    throw new InvalidInputError({
      field,
      reason: "must be 'individual' or 'company'",
    })
  }
  return value
}

function assertTier(value: unknown, field: string): DeveloperTier | undefined {
  if (value === undefined) return undefined
  if (value !== 'free' && value !== 'builder' && value !== 'scale') {
    throw new InvalidInputError({
      field,
      reason: "must be 'free', 'builder', or 'scale'",
    })
  }
  return value
}

function assertOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new InvalidInputError({ field, reason: 'must be a boolean' })
  }
  return value
}

// ─── Account-type selector (the priority chain) ──────────────────────

/**
 * Decide which Stripe Connect account type to provision for the
 * developer's country / entity-type / tier combination.
 *
 * Priority order (FIRST match wins; matches the P3.RAIL1 spec):
 *
 *   1. Country+entity-type is in the Express supported matrix → `'express'`
 *      (the default; lightest onboarding path)
 *   2. Developer is on the `'scale'` tier AND has explicitly requested
 *      self-managed disputes / custom payout schedules
 *      (`requestsSelfManaged: true`) AND the country+entity-type IS in
 *      the Standard matrix → `'standard'`
 *   3. Country+entity-type requires Custom (rare compliance-heavy
 *      cases listed in `custom.*Countries`) → `'custom'`
 *   4. Otherwise → throw `UnsupportedCountryError` so the caller can
 *      route to the waitlist
 *
 * Pure: no I/O, no clocks. The matrix defaults to the bundled
 * `loadCountryMatrix()` result; tests inject custom matrices.
 */
export function selectStripeAccountType(
  input: SelectAccountTypeInput,
  matrix: CountryMatrix = loadCountryMatrix(),
): StripeAccountType {
  if (!input || typeof input !== 'object') {
    throw new InvalidInputError({
      field: 'input',
      reason: 'must be a non-null object',
    })
  }
  const countryIso = assertCountryIso(input.countryIso, 'countryIso')
  const entityType = assertEntityType(input.entityType, 'entityType')
  const tier = assertTier(input.tier, 'tier')
  const requestsSelfManaged = assertOptionalBoolean(
    input.requestsSelfManaged,
    'requestsSelfManaged',
  )

  const expressList =
    entityType === 'individual'
      ? matrix.express.individualCountries
      : matrix.express.businessCountries
  const standardList =
    entityType === 'individual'
      ? matrix.standard.individualCountries
      : matrix.standard.businessCountries
  const customList =
    entityType === 'individual'
      ? matrix.custom.individualCountries
      : matrix.custom.businessCountries

  // Priority 1: Express supported → default lightest onboarding.
  if (expressList.includes(countryIso)) {
    return 'express'
  }

  // Priority 2: Scale-tier opt-in to Standard for self-managed
  // disputes / custom payout schedules. Falls through if any of the
  // three preconditions fail (tier ≠ scale, flag false, country not
  // in the Standard matrix). The Standard list is the binding
  // constraint — without country support, a Standard onboarding form
  // would dead-end the same way an unsupported Express would, which
  // is exactly what the router exists to prevent.
  if (
    tier === 'scale' &&
    requestsSelfManaged === true &&
    standardList.includes(countryIso)
  ) {
    return 'standard'
  }

  // Priority 3: Custom mandated by country+entity-type combination.
  if (customList.includes(countryIso)) {
    return 'custom'
  }

  // Priority 4: no Stripe variant fits — caller routes to waitlist.
  throw new UnsupportedCountryError({
    countryIso,
    entityType,
    waitlistReason: 'country_not_supported_for_entity_type',
  })
}

// ─── Top-level rail router ───────────────────────────────────────────

/**
 * Route a developer to a payment rail at onboarding time. Today the
 * registry ships only `'stripe-connect'`; this function still exists
 * so the future addition of a second rail (Paddle, Lemon Squeezy,
 * Wise, etc.) is a localized change rather than a refactor across
 * every onboarding caller.
 *
 * Delegates account-type selection to `selectStripeAccountType`; this
 * function adds:
 *   - Currency support check (the rail must payout in the developer's
 *     preferred currency).
 *   - Frozen `RoutingDecision` return so callers cannot mutate the
 *     decision after it's been recorded (audit-trail integrity).
 *
 * Throws `UnsupportedCountryError` if either the country/entity-type
 * or the currency isn't supported. The caller (eligibility API,
 * onboarding page) catches and routes to waitlist.
 */
export function routeDeveloper(
  input: RouteDeveloperInput,
  matrix: CountryMatrix = loadCountryMatrix(),
): RoutingDecision {
  if (!input || typeof input !== 'object') {
    throw new InvalidInputError({
      field: 'input',
      reason: 'must be a non-null object',
    })
  }
  const countryIso = assertCountryIso(input.countryIso, 'countryIso')
  const entityType = assertEntityType(input.entityType, 'entityType')
  const preferredCurrency = assertCurrency(
    input.preferredCurrency,
    'preferredCurrency',
  )
  // tier + requestsSelfManaged are validated inside selectStripeAccountType.

  if (!matrix.payoutCurrencies.includes(preferredCurrency)) {
    throw new UnsupportedCountryError({
      countryIso,
      entityType,
      waitlistReason: 'preferred_currency_not_supported',
    })
  }

  const accountType = selectStripeAccountType(
    {
      countryIso,
      entityType,
      tier: input.tier,
      requestsSelfManaged: input.requestsSelfManaged,
    },
    matrix,
  )

  return Object.freeze({
    railId: 'stripe-connect',
    accountType,
    reason:
      `Stripe Connect ${accountType} supports ${entityType} accounts in ` +
      `${countryIso} with ${preferredCurrency} payouts.`,
    countryIso,
    entityType,
    preferredCurrency,
  })
}
