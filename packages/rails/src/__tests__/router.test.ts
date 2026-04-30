/**
 * P3.RAIL1 — Router unit tests.
 *
 * Coverage targets every branch in `selectStripeAccountType` (Express
 * default, Standard scale-tier escalation, Custom mandate, Unsupported
 * throw) plus `routeDeveloper`'s currency check and the config-error
 * paths exercised by `__parseMatrixForTests`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  routeDeveloper,
  selectStripeAccountType,
  loadCountryMatrix,
  __parseMatrixForTests,
  UnsupportedCountryError,
  ConfigurationError,
  InvalidInputError,
  type CountryMatrix,
} from '../router'

// ─── Test fixtures ───────────────────────────────────────────────────

/**
 * Synthetic matrix used by tests that need fully-controlled lists.
 * Real-world `loadCountryMatrix()` is exercised by integration tests
 * below; matrix-shape unit tests run against this fixture so a
 * future refresh of the bundled JSON does not silently break a test
 * that depended on a specific country being absent.
 *
 *   - `US` is the only Express-supported country (both entity types).
 *   - `IN` is in Standard but NOT in Express (models Sandeep's case).
 *   - `CN` is in Custom only (models a compliance-mandated country).
 *   - `ZZ` is not in any list (models the waitlist fallback).
 */
const TEST_MATRIX: CountryMatrix = Object.freeze({
  _meta: Object.freeze({
    source: 'test://synthetic',
    lastRefreshedAt: '2026-04-24',
    refreshCadenceDays: 90,
    refreshNotes: 'synthetic',
  }),
  express: Object.freeze({
    individualCountries: Object.freeze(['US']),
    businessCountries: Object.freeze(['US']),
  }),
  standard: Object.freeze({
    individualCountries: Object.freeze(['US', 'IN']),
    businessCountries: Object.freeze(['US', 'IN']),
  }),
  custom: Object.freeze({
    individualCountries: Object.freeze(['CN']),
    businessCountries: Object.freeze(['CN']),
  }),
  payoutCurrencies: Object.freeze(['USD', 'INR', 'CNY']),
}) as CountryMatrix

// ─── selectStripeAccountType — priority-1 (Express default) ──────────

describe('selectStripeAccountType — Express default', () => {
  it('returns express for individual in Express-supported country', () => {
    const result = selectStripeAccountType(
      { countryIso: 'US', entityType: 'individual' },
      TEST_MATRIX,
    )
    expect(result).toBe('express')
  })

  it('returns express for company in Express-supported country', () => {
    const result = selectStripeAccountType(
      { countryIso: 'US', entityType: 'company' },
      TEST_MATRIX,
    )
    expect(result).toBe('express')
  })

  it('normalizes lowercase country code before matching the matrix', () => {
    const result = selectStripeAccountType(
      { countryIso: 'us', entityType: 'individual' },
      TEST_MATRIX,
    )
    expect(result).toBe('express')
  })

  it('Express fires even when scale tier requested self-managed (priority-1 wins)', () => {
    // The literal P3.RAIL1 priority chain: priority-1 is checked
    // first and returns immediately. A scale-tier developer in a
    // Express-supported country gets Express, not Standard.
    const result = selectStripeAccountType(
      {
        countryIso: 'US',
        entityType: 'individual',
        tier: 'scale',
        requestsSelfManaged: true,
      },
      TEST_MATRIX,
    )
    expect(result).toBe('express')
  })
})

// ─── selectStripeAccountType — priority-2 (Standard scale escalation) ─

describe('selectStripeAccountType — Standard scale-tier escalation', () => {
  it('returns standard for scale-tier individual in country supported by Standard but not Express (Sandeep upgrade)', () => {
    const result = selectStripeAccountType(
      {
        countryIso: 'IN',
        entityType: 'individual',
        tier: 'scale',
        requestsSelfManaged: true,
      },
      TEST_MATRIX,
    )
    expect(result).toBe('standard')
  })

  it('does NOT escalate to Standard without the explicit requestsSelfManaged flag', () => {
    expect(() =>
      selectStripeAccountType(
        { countryIso: 'IN', entityType: 'individual', tier: 'scale' },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })

  it('does NOT escalate to Standard for builder tier even with self-managed flag', () => {
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'IN',
          entityType: 'individual',
          tier: 'builder',
          requestsSelfManaged: true,
        },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })

  it('does NOT escalate to Standard for free tier even with self-managed flag (Sandeep waitlist case)', () => {
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'IN',
          entityType: 'individual',
          tier: 'free',
          requestsSelfManaged: true,
        },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })

  it('does NOT escalate to Standard if the country is also missing from the Standard list', () => {
    // Sandeep-like dev in 'ZZ' (not in Standard either) — falls
    // through to priority-3, then priority-4 → throw.
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'ZZ',
          entityType: 'individual',
          tier: 'scale',
          requestsSelfManaged: true,
        },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })
})

// ─── selectStripeAccountType — priority-3 (Custom mandate) ───────────

describe('selectStripeAccountType — Custom mandate', () => {
  it('returns custom for individual in Custom-mandated country (no Express, no Standard)', () => {
    const result = selectStripeAccountType(
      { countryIso: 'CN', entityType: 'individual' },
      TEST_MATRIX,
    )
    expect(result).toBe('custom')
  })

  it('returns custom for company in Custom-mandated country', () => {
    const result = selectStripeAccountType(
      { countryIso: 'CN', entityType: 'company' },
      TEST_MATRIX,
    )
    expect(result).toBe('custom')
  })
})

// ─── selectStripeAccountType — priority-4 (Waitlist throw) ───────────

describe('selectStripeAccountType — Unsupported throw', () => {
  it('throws UnsupportedCountryError for individual in country not in any list', () => {
    expect(() =>
      selectStripeAccountType(
        { countryIso: 'ZZ', entityType: 'individual' },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })

  it('UnsupportedCountryError carries the correct fields for the waitlist UI', () => {
    try {
      selectStripeAccountType(
        { countryIso: 'ZZ', entityType: 'individual' },
        TEST_MATRIX,
      )
      expect.fail('Expected UnsupportedCountryError')
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedCountryError)
      const e = err as UnsupportedCountryError
      expect(e.countryIso).toBe('ZZ')
      expect(e.entityType).toBe('individual')
      expect(e.waitlistReason).toBe('country_not_supported_for_entity_type')
      expect(e.code).toBe('unsupported_country')
      expect(e.name).toBe('UnsupportedCountryError')
    }
  })
})

// ─── selectStripeAccountType — input validation ──────────────────────

describe('selectStripeAccountType — input validation', () => {
  it('throws InvalidInputError for non-2-letter country code', () => {
    expect(() =>
      selectStripeAccountType(
        { countryIso: 'USA', entityType: 'individual' },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for non-string country code', () => {
    expect(() =>
      selectStripeAccountType(
        { countryIso: 42 as unknown as string, entityType: 'individual' },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for empty country code', () => {
    expect(() =>
      selectStripeAccountType(
        { countryIso: '', entityType: 'individual' },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for excessively long country code (DoS guard)', () => {
    const huge = 'A'.repeat(10_000)
    expect(() =>
      selectStripeAccountType(
        { countryIso: huge, entityType: 'individual' },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for unknown entityType', () => {
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'US',
          entityType: 'sole-proprietor' as unknown as 'individual',
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for unknown tier', () => {
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'US',
          entityType: 'individual',
          tier: 'enterprise' as unknown as 'scale',
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for non-boolean requestsSelfManaged', () => {
    expect(() =>
      selectStripeAccountType(
        {
          countryIso: 'US',
          entityType: 'individual',
          tier: 'scale',
          requestsSelfManaged: 'yes' as unknown as boolean,
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for null input', () => {
    expect(() =>
      selectStripeAccountType(null as unknown as Parameters<typeof selectStripeAccountType>[0], TEST_MATRIX),
    ).toThrow(InvalidInputError)
  })
})

// ─── routeDeveloper ──────────────────────────────────────────────────

describe('routeDeveloper', () => {
  it('returns a frozen RoutingDecision for supported country+currency', () => {
    const decision = routeDeveloper(
      {
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      },
      TEST_MATRIX,
    )
    expect(decision.railId).toBe('stripe-connect')
    expect(decision.accountType).toBe('express')
    expect(decision.countryIso).toBe('US')
    expect(decision.entityType).toBe('individual')
    expect(decision.preferredCurrency).toBe('USD')
    expect(decision.reason).toContain('Stripe Connect express')
    expect(Object.isFrozen(decision)).toBe(true)
  })

  it('frozen RoutingDecision rejects mutation (audit-trail integrity)', () => {
    const decision = routeDeveloper(
      {
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      },
      TEST_MATRIX,
    )
    expect(() => {
      ;(decision as { railId: string }).railId = 'tampered'
    }).toThrow()
  })

  it('throws UnsupportedCountryError with currency reason when payout currency unsupported', () => {
    // 'CAD' is a structurally-valid 3-letter ISO code, but
    // TEST_MATRIX.payoutCurrencies only lists USD/INR/CNY — so input
    // validation passes and the currency-not-supported branch fires.
    try {
      routeDeveloper(
        { countryIso: 'US', entityType: 'individual', preferredCurrency: 'CAD' },
        TEST_MATRIX,
      )
      expect.fail('Expected UnsupportedCountryError for CAD')
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedCountryError)
      const e = err as UnsupportedCountryError
      expect(e.waitlistReason).toBe('preferred_currency_not_supported')
      expect(e.countryIso).toBe('US')
    }
  })

  it('throws UnsupportedCountryError with country reason when country unsupported', () => {
    try {
      routeDeveloper(
        { countryIso: 'ZZ', entityType: 'individual', preferredCurrency: 'USD' },
        TEST_MATRIX,
      )
      expect.fail('Expected UnsupportedCountryError')
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedCountryError)
      const e = err as UnsupportedCountryError
      expect(e.waitlistReason).toBe('country_not_supported_for_entity_type')
    }
  })

  it('throws InvalidInputError for malformed currency (wrong length)', () => {
    expect(() =>
      routeDeveloper(
        {
          countryIso: 'US',
          entityType: 'individual',
          preferredCurrency: 'US',
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for non-string currency', () => {
    expect(() =>
      routeDeveloper(
        {
          countryIso: 'US',
          entityType: 'individual',
          preferredCurrency: 42 as unknown as string,
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for empty currency', () => {
    expect(() =>
      routeDeveloper(
        {
          countryIso: 'US',
          entityType: 'individual',
          preferredCurrency: '',
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for excessively long currency (DoS guard)', () => {
    expect(() =>
      routeDeveloper(
        {
          countryIso: 'US',
          entityType: 'individual',
          preferredCurrency: 'X'.repeat(10_000),
        },
        TEST_MATRIX,
      ),
    ).toThrow(InvalidInputError)
  })

  it('throws InvalidInputError for null input', () => {
    expect(() =>
      routeDeveloper(null as unknown as Parameters<typeof routeDeveloper>[0], TEST_MATRIX),
    ).toThrow(InvalidInputError)
  })

  it('case-insensitive currency normalizes to uppercase before matching', () => {
    const decision = routeDeveloper(
      {
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'usd',
      },
      TEST_MATRIX,
    )
    expect(decision.preferredCurrency).toBe('USD')
  })

  it('routes scale-tier individual in IN to Standard (Sandeep upgrade end-to-end)', () => {
    const decision = routeDeveloper(
      {
        countryIso: 'IN',
        entityType: 'individual',
        preferredCurrency: 'INR',
        tier: 'scale',
        requestsSelfManaged: true,
      },
      TEST_MATRIX,
    )
    expect(decision.accountType).toBe('standard')
    expect(decision.countryIso).toBe('IN')
  })

  it('routes individual in IN without scale-tier upgrade to waitlist (Sandeep base case)', () => {
    expect(() =>
      routeDeveloper(
        {
          countryIso: 'IN',
          entityType: 'individual',
          preferredCurrency: 'INR',
        },
        TEST_MATRIX,
      ),
    ).toThrow(UnsupportedCountryError)
  })
})

// ─── loadCountryMatrix (bundled real JSON) ───────────────────────────

describe('loadCountryMatrix — bundled JSON', () => {
  it('loads + freezes the bundled matrix; result is structurally valid', () => {
    const m = loadCountryMatrix()
    expect(Object.isFrozen(m)).toBe(true)
    expect(m._meta.source).toContain('stripe.com')
    expect(Array.isArray(m.express.individualCountries)).toBe(true)
    expect(Object.isFrozen(m.express.individualCountries)).toBe(true)
    expect(Array.isArray(m.payoutCurrencies)).toBe(true)
    expect(Object.isFrozen(m.payoutCurrencies)).toBe(true)
  })

  it('returns the same cached reference on second call (idempotent)', () => {
    const m1 = loadCountryMatrix()
    const m2 = loadCountryMatrix()
    expect(m1).toBe(m2)
  })

  it('bundled matrix includes US for both entity types under Express', () => {
    const m = loadCountryMatrix()
    expect(m.express.individualCountries).toContain('US')
    expect(m.express.businessCountries).toContain('US')
  })

  it('bundled matrix has Sandeep India-individual block (excluded from Express)', () => {
    // The architecture-doc invariant: India individual must hit the
    // waitlist via the bundled JSON. This is a regression guard — if
    // a future refresh adds IN to express.individualCountries, the
    // Sandeep flow stops being reachable and this test will fail
    // loudly so the team can decide whether the waitlist flow is
    // still needed.
    const m = loadCountryMatrix()
    expect(m.express.individualCountries).not.toContain('IN')
    expect(m.standard.individualCountries).toContain('IN')
  })

  it('routeDeveloper against bundled matrix throws for India individual in INR', () => {
    expect(() =>
      routeDeveloper({
        countryIso: 'IN',
        entityType: 'individual',
        preferredCurrency: 'INR',
      }),
    ).toThrow(UnsupportedCountryError)
  })

  it('routeDeveloper against bundled matrix succeeds for US individual in USD', () => {
    const decision = routeDeveloper({
      countryIso: 'US',
      entityType: 'individual',
      preferredCurrency: 'USD',
    })
    expect(decision.railId).toBe('stripe-connect')
    expect(decision.accountType).toBe('express')
  })
})

// ─── ConfigurationError paths (matrix parser) ────────────────────────

describe('__parseMatrixForTests — config validation', () => {
  it('throws ConfigurationError when matrix is null', () => {
    expect(() => __parseMatrixForTests(null)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when matrix is a non-object scalar', () => {
    expect(() => __parseMatrixForTests('not-an-object')).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when _meta block is missing', () => {
    const malformed = { express: {}, standard: {}, custom: {}, payoutCurrencies: [] }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when _meta.lastRefreshedAt is not a string', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 42,
        refreshCadenceDays: 90,
        refreshNotes: '',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when _meta.refreshNotes is not a string', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: '2026-04-24',
        refreshCadenceDays: 90,
        refreshNotes: 42,
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when payoutCurrencies is not an array', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: '2026-04-24',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: 'USD',
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when _meta.source is not a string', () => {
    const malformed = {
      _meta: {
        source: 42,
        lastRefreshedAt: '2026-04-24',
        refreshCadenceDays: 90,
        refreshNotes: '',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when _meta.refreshCadenceDays is not finite', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 'soon',
        refreshNotes: 'n',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when express block is missing', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when a country list contains a non-string entry', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: ['US', 42], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when a country code is not 2 uppercase letters', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: ['us'], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when a country list is not an array', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: 'US', businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: [],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when a currency list contains a non-string entry', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: ['USD', 42],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when a currency code is not 3 uppercase letters', () => {
    const malformed = {
      _meta: {
        source: 's',
        lastRefreshedAt: 'd',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: [], businessCountries: [] },
      standard: { individualCountries: [], businessCountries: [] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: ['us'],
    }
    expect(() => __parseMatrixForTests(malformed)).toThrow(ConfigurationError)
  })

  it('parses + freezes a well-formed matrix', () => {
    const wellFormed = {
      _meta: {
        source: 'test',
        lastRefreshedAt: '2026-04-24',
        refreshCadenceDays: 90,
        refreshNotes: 'n',
      },
      express: { individualCountries: ['US'], businessCountries: ['US'] },
      standard: { individualCountries: ['US'], businessCountries: ['US'] },
      custom: { individualCountries: [], businessCountries: [] },
      payoutCurrencies: ['USD'],
    }
    const m = __parseMatrixForTests(wellFormed)
    expect(Object.isFrozen(m)).toBe(true)
    expect(Object.isFrozen(m.express)).toBe(true)
    expect(Object.isFrozen(m.express.individualCountries)).toBe(true)
    expect(m.express.individualCountries).toEqual(['US'])
  })
})

// ─── Production-env guards on test-only helpers ──────────────────────

describe('test-only helpers refuse to run outside NODE_ENV===test', () => {
  // The router exposes `__resetMatrixCacheForTests` and
  // `__parseMatrixForTests` for in-test use only. They guard against
  // accidental production calls (which would burn cycles re-parsing
  // the matrix per request) by checking NODE_ENV. These tests
  // exercise that guard so a future regression that drops the check
  // shows up in coverage.

  let originalNodeEnv: string | undefined
  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })
  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('__resetMatrixCacheForTests throws when NODE_ENV is "production"', async () => {
    process.env.NODE_ENV = 'production'
    const { __resetMatrixCacheForTests } = await import('../router')
    expect(() => __resetMatrixCacheForTests()).toThrow(/test-only/)
  })

  it('__resetMatrixCacheForTests throws when NODE_ENV is unset', async () => {
    delete process.env.NODE_ENV
    const { __resetMatrixCacheForTests } = await import('../router')
    expect(() => __resetMatrixCacheForTests()).toThrow(/test-only/)
  })

  it('__parseMatrixForTests throws when NODE_ENV is "production"', async () => {
    process.env.NODE_ENV = 'production'
    const { __parseMatrixForTests } = await import('../router')
    expect(() => __parseMatrixForTests({})).toThrow(/test-only/)
  })

  it('__resetMatrixCacheForTests succeeds in test env (clears the cache)', async () => {
    // Coverage for the success path (NODE_ENV === 'test' branch
    // through to the cache assignment). After reset, the next
    // loadCountryMatrix() call must re-parse and return a NEW
    // frozen matrix instance — not the cached reference from
    // before reset.
    process.env.NODE_ENV = 'test'
    const { loadCountryMatrix, __resetMatrixCacheForTests } = await import(
      '../router'
    )
    const before = loadCountryMatrix()
    __resetMatrixCacheForTests()
    const after = loadCountryMatrix()
    // Both are frozen + structurally identical, but the cache was
    // invalidated so the second load returned a freshly-parsed
    // object (different reference).
    expect(after).not.toBe(before)
    expect(after.express.individualCountries).toEqual(
      before.express.individualCountries,
    )
  })
})

// ─── Barrel re-exports ───────────────────────────────────────────────

describe('@settlegrid/rails barrel', () => {
  it('re-exports the router functions and error classes from index.ts', async () => {
    const barrel = await import('../index')
    expect(typeof barrel.routeDeveloper).toBe('function')
    expect(typeof barrel.selectStripeAccountType).toBe('function')
    expect(typeof barrel.loadCountryMatrix).toBe('function')
    expect(typeof barrel.UnsupportedCountryError).toBe('function')
    expect(typeof barrel.ConfigurationError).toBe('function')
    expect(typeof barrel.InvalidInputError).toBe('function')
    // Error classes are subclasses of Error
    expect(new barrel.UnsupportedCountryError({
      countryIso: 'XX',
      entityType: 'individual',
      waitlistReason: 'country_not_supported_for_entity_type',
    })).toBeInstanceOf(Error)
  })
})

// ─── Error-class shape checks ────────────────────────────────────────

describe('error classes', () => {
  it('UnsupportedCountryError preserves instanceof through new.target', () => {
    const e = new UnsupportedCountryError({
      countryIso: 'XX',
      entityType: 'individual',
      waitlistReason: 'country_not_supported_for_entity_type',
    })
    expect(e).toBeInstanceOf(UnsupportedCountryError)
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('UnsupportedCountryError')
    expect(e.code).toBe('unsupported_country')
  })

  it('ConfigurationError preserves instanceof + carries field', () => {
    const e = new ConfigurationError({ field: 'foo', reason: 'bar' })
    expect(e).toBeInstanceOf(ConfigurationError)
    expect(e).toBeInstanceOf(Error)
    expect(e.field).toBe('foo')
    expect(e.message).toContain('foo')
  })

  it('InvalidInputError preserves instanceof + carries field', () => {
    const e = new InvalidInputError({ field: 'countryIso', reason: 'bad' })
    expect(e).toBeInstanceOf(InvalidInputError)
    expect(e).toBeInstanceOf(Error)
    expect(e.field).toBe('countryIso')
  })

  it('errors are distinguishable from each other by class', () => {
    const u = new UnsupportedCountryError({
      countryIso: 'XX',
      entityType: 'individual',
      waitlistReason: 'country_not_supported_for_entity_type',
    })
    const c = new ConfigurationError({ field: 'x', reason: 'y' })
    const i = new InvalidInputError({ field: 'x', reason: 'y' })
    expect(u).not.toBeInstanceOf(ConfigurationError)
    expect(u).not.toBeInstanceOf(InvalidInputError)
    expect(c).not.toBeInstanceOf(UnsupportedCountryError)
    expect(c).not.toBeInstanceOf(InvalidInputError)
    expect(i).not.toBeInstanceOf(UnsupportedCountryError)
    expect(i).not.toBeInstanceOf(ConfigurationError)
  })
})
