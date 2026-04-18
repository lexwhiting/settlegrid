/**
 * P2.INTL1 — tests for the cold-email-tracker backfill heuristic +
 * classification helpers.
 *
 * Covers the spec-required logic:
 *   - country_iso resolution from GitHub location (primary heuristic)
 *   - country_iso resolution from domain TLD (fallback heuristic)
 *   - UNKNOWN bucket for unresolvable prospects
 *   - stripe_supported derived from country_iso × Stripe's Connect
 *     supported list
 *   - Segment classification routing (activate-now vs
 *     stripe-unsupported-corridor-waitlist vs cold-unknown-country)
 *   - Cohort-1 membership (the target Stripe-unsupported corridors)
 *   - Drift guard: the Stripe-supported set stays mirrored from the
 *     @settlegrid/mcp RailAdapter capability envelope
 */

import { describe, it, expect } from 'vitest'
import {
  COHORT_1_COUNTRIES,
  SANCTIONS_BLOCKED_COUNTRIES,
  STRIPE_SUPPORTED_COUNTRIES,
  backfillCountry,
  classifyProspect,
  isCohort1,
  isSanctionsBlocked,
  isStripeSupported,
  parseDomainTld,
  parseGithubLocation,
} from '../international'
import { STRIPE_CONNECT_CAPABILITIES } from '@settlegrid/mcp'

describe('STRIPE_SUPPORTED_COUNTRIES — drift guard against the RailAdapter', () => {
  it('mirrors @settlegrid/mcp STRIPE_CONNECT_CAPABILITIES.individualCountries', () => {
    for (const cc of STRIPE_CONNECT_CAPABILITIES.individualCountries) {
      expect(STRIPE_SUPPORTED_COUNTRIES.has(cc)).toBe(true)
    }
    // Size check catches any Stripe-side addition that wasn't
    // reflected here.
    expect(STRIPE_SUPPORTED_COUNTRIES.size).toBe(
      STRIPE_CONNECT_CAPABILITIES.individualCountries.length,
    )
  })

  it('includes the anchor-market countries (US / GB / DE / JP / IN)', () => {
    for (const cc of ['US', 'GB', 'DE', 'JP', 'IN']) {
      expect(isStripeSupported(cc)).toBe(true)
    }
  })
})

describe('COHORT_1_COUNTRIES', () => {
  it('has exactly 10 countries per the country-tracker.md §5 list', () => {
    expect(COHORT_1_COUNTRIES).toHaveLength(10)
  })

  it('excludes India (Stripe Connect supports India; not a cohort-1 waitlist country)', () => {
    expect(COHORT_1_COUNTRIES).not.toContain('IN')
  })

  it('every cohort-1 country is NOT Stripe-supported', () => {
    // This is the definitional invariant: cohort 1 is "Stripe-
    // unsupported corridors with high waitlist demand". A country
    // appearing in both sets would be a configuration error —
    // detect it here before the routing logic produces nonsense.
    for (const cc of COHORT_1_COUNTRIES) {
      expect(isStripeSupported(cc), `${cc} must NOT be Stripe-supported`).toBe(false)
    }
  })

  it('includes the named P2.INTL1 priority countries (PK, NG, BD, VN, PH)', () => {
    for (const cc of ['PK', 'NG', 'BD', 'VN', 'PH']) {
      expect(isCohort1(cc)).toBe(true)
    }
  })

  it('isCohort1 is case-insensitive', () => {
    expect(isCohort1('pk')).toBe(true)
    expect(isCohort1('Pk')).toBe(true)
  })
})

describe('parseGithubLocation — free-text → ISO α-2', () => {
  it('rejects null / undefined / empty', () => {
    expect(parseGithubLocation(null)).toBeNull()
    expect(parseGithubLocation(undefined)).toBeNull()
    expect(parseGithubLocation('')).toBeNull()
  })

  it('rejects non-string inputs defensively', () => {
    expect(parseGithubLocation(42 as unknown as string)).toBeNull()
  })

  it.each([
    ['San Francisco, CA', 'US'],
    ['Berlin, Germany', 'DE'],
    ['Paris, France', 'FR'],
    ['London', 'GB'],
    ['Tokyo, Japan', 'JP'],
    ['Bangalore, India', 'IN'],
    ['Lagos, Nigeria', 'NG'],
    ['Karachi, Pakistan', 'PK'],
    ['Dhaka, Bangladesh', 'BD'],
    ['Hanoi, Vietnam', 'VN'],
    ['Manila, Philippines', 'PH'],
    ['Jakarta, Indonesia', 'ID'],
    ['Nairobi, Kenya', 'KE'],
    ['Kyiv, Ukraine', 'UA'],
    ['Istanbul, Turkey', 'TR'],
    ['Madrid, Spain', 'ES'],
    ['The Netherlands', 'NL'],
    ['Rio de Janeiro, Brasil', 'BR'],
    ['México DF, Mexico', 'MX'],
  ])('parses "%s" → %s', (input, expected) => {
    expect(parseGithubLocation(input)).toBe(expected)
  })

  it('strips flag emoji prefixes', () => {
    expect(parseGithubLocation('🇮🇳 Bangalore')).toBe('IN')
    expect(parseGithubLocation('🇳🇬 Lagos')).toBe('NG')
  })

  it('recognizes inline 2-letter country codes', () => {
    expect(parseGithubLocation('Tokyo, JP')).toBe('JP')
    expect(parseGithubLocation('Sydney, AU')).toBe('AU')
  })

  it('recognizes multiple common splitters (semicolon, slash, dash)', () => {
    expect(parseGithubLocation('Berlin; Germany')).toBe('DE')
    expect(parseGithubLocation('Berlin / Germany')).toBe('DE')
    expect(parseGithubLocation('Berlin — Germany')).toBe('DE')
  })

  it('handles alternate country spellings (Türkiye, Deutschland)', () => {
    expect(parseGithubLocation('Istanbul, Türkiye')).toBe('TR')
    expect(parseGithubLocation('Istanbul, Turkiye')).toBe('TR')
    expect(parseGithubLocation('Munich, Deutschland')).toBe('DE')
  })

  it('returns null for unresolvable free text', () => {
    expect(parseGithubLocation('Earth')).toBeNull()
    expect(parseGithubLocation('The Moon')).toBeNull()
    expect(parseGithubLocation('Remote')).toBeNull()
    expect(parseGithubLocation('here and there')).toBeNull()
  })

  it('does NOT guess when prefix-only (e.g. "NY")', () => {
    // 2-letter tokens are accepted only if they match a known ISO
    // country code. "NY" does not map to a country (that's a US
    // state); parser must return null rather than inventing.
    expect(parseGithubLocation('NY')).toBeNull()
  })
})

describe('parseDomainTld — ccTLD → ISO α-2', () => {
  it('rejects null / undefined / empty', () => {
    expect(parseDomainTld(null)).toBeNull()
    expect(parseDomainTld(undefined)).toBeNull()
    expect(parseDomainTld('')).toBeNull()
  })

  it.each([
    ['example.de', 'DE'],
    ['example.fr', 'FR'],
    ['example.co.uk', 'GB'],
    ['example.uk', 'GB'],
    ['example.jp', 'JP'],
    ['example.in', 'IN'],
    ['example.ng', 'NG'],
    ['example.pk', 'PK'],
    ['example.br', 'BR'],
    ['example.mx', 'MX'],
    ['example.au', 'AU'],
    ['example.tr', 'TR'],
  ])('maps %s → %s', (domain, expected) => {
    expect(parseDomainTld(domain)).toBe(expected)
  })

  it.each([
    'example.com',
    'example.org',
    'example.net',
    'example.io',
    'example.ai',
    'example.dev',
    'example.co',
    'example.app',
  ])('returns null for generic TLD %s (refuses to guess US)', (domain) => {
    expect(parseDomainTld(domain)).toBeNull()
  })

  it('returns null for an empty-TLD string', () => {
    expect(parseDomainTld('.')).toBeNull()
  })

  it('returns null for unknown ccTLDs we don\'t track (e.g. .test)', () => {
    expect(parseDomainTld('example.test')).toBeNull()
  })
})

describe('backfillCountry — full heuristic precedence', () => {
  it('GitHub location wins when both fields present', () => {
    const result = backfillCountry({
      githubLocation: 'Karachi, Pakistan',
      domain: 'example.de', // should lose to GitHub signal
    })
    expect(result).toBe('PK')
  })

  it('falls back to domain TLD when GitHub location absent', () => {
    const result = backfillCountry({
      githubLocation: null,
      domain: 'acme.in',
    })
    expect(result).toBe('IN')
  })

  it('falls back to domain TLD when GitHub location unresolvable', () => {
    const result = backfillCountry({
      githubLocation: 'Remote',
      domain: 'acme.ng',
    })
    expect(result).toBe('NG')
  })

  it('returns UNKNOWN when neither heuristic resolves', () => {
    expect(backfillCountry({ githubLocation: null, domain: null })).toBe(
      'UNKNOWN',
    )
    expect(
      backfillCountry({ githubLocation: 'Earth', domain: 'example.com' }),
    ).toBe('UNKNOWN')
  })

  it('returns UNKNOWN when both fields are missing from input entirely', () => {
    expect(backfillCountry({})).toBe('UNKNOWN')
  })
})

describe('classifyProspect — routing to outreach segments', () => {
  it('Stripe-supported country → activate-now', () => {
    expect(classifyProspect('US')).toBe('activate-now')
    expect(classifyProspect('DE')).toBe('activate-now')
    expect(classifyProspect('IN')).toBe('activate-now') // IN is Stripe-supported
  })

  it('Cohort-1 country → stripe-unsupported-corridor-waitlist', () => {
    expect(classifyProspect('PK')).toBe('stripe-unsupported-corridor-waitlist')
    expect(classifyProspect('NG')).toBe('stripe-unsupported-corridor-waitlist')
    expect(classifyProspect('VN')).toBe('stripe-unsupported-corridor-waitlist')
  })

  it('non-cohort Stripe-unsupported country → still waitlist', () => {
    // The waitlist is the fallback for ANY Stripe-unsupported
    // country, not just cohort 1. Cohort 1 is a prioritization
    // label inside the waitlist, not a gatekeeper for it.
    expect(classifyProspect('CN')).toBe('stripe-unsupported-corridor-waitlist')
    expect(classifyProspect('SA')).toBe('stripe-unsupported-corridor-waitlist')
  })

  it('null / undefined / empty → cold-unknown-country', () => {
    expect(classifyProspect(null)).toBe('cold-unknown-country')
    expect(classifyProspect(undefined)).toBe('cold-unknown-country')
    expect(classifyProspect('')).toBe('cold-unknown-country')
  })

  it('literal "UNKNOWN" → cold-unknown-country (not sent to waitlist)', () => {
    // Critical: an unknown-country prospect should NOT be routed
    // to the waitlist (we'd be spamming about an inapplicable
    // waitlist). They stay cold until they reveal location info.
    expect(classifyProspect('UNKNOWN')).toBe('cold-unknown-country')
  })
})

describe('SANCTIONS_BLOCKED_COUNTRIES — hostile-review coordination guard', () => {
  it('lists the 4 OFAC-program §3.2 comprehensively-sanctioned countries', () => {
    expect(SANCTIONS_BLOCKED_COUNTRIES).toEqual(['CU', 'IR', 'KP', 'SY'])
  })

  it('no sanctioned country is also Stripe-supported (would be contradictory)', () => {
    for (const cc of SANCTIONS_BLOCKED_COUNTRIES) {
      expect(isStripeSupported(cc)).toBe(false)
    }
  })

  it('no sanctioned country is in Cohort 1 (waitlist vs block contradiction)', () => {
    // Cohort 1 is the waitlist-target set. A country in both sets
    // would route to the waitlist by cohort membership AND to
    // sanctions-blocked by compliance — a definitional conflict.
    for (const cc of SANCTIONS_BLOCKED_COUNTRIES) {
      expect(isCohort1(cc)).toBe(false)
    }
  })

  it('isSanctionsBlocked is case-insensitive', () => {
    expect(isSanctionsBlocked('ir')).toBe(true)
    expect(isSanctionsBlocked('IR')).toBe(true)
    expect(isSanctionsBlocked('Ir')).toBe(true)
  })

  it('non-sanctioned countries return false', () => {
    for (const cc of ['US', 'DE', 'IN', 'PK', 'NG']) {
      expect(isSanctionsBlocked(cc)).toBe(false)
    }
  })
})

describe('classifyProspect — sanctions block takes precedence (hostile-review fix)', () => {
  it('Iran → sanctions-blocked (NOT waitlist)', () => {
    // Hostile-review: a prospect from Iran must NOT be routed to
    // the Stripe-unsupported-corridor-waitlist, which implies
    // "we'll figure out a payout rail eventually". OFAC compliance
    // forbids that; they must be blocked outright.
    expect(classifyProspect('IR')).toBe('sanctions-blocked')
  })

  it.each(['CU', 'IR', 'KP', 'SY'])(
    '%s (comprehensively sanctioned) → sanctions-blocked',
    (cc) => {
      expect(classifyProspect(cc)).toBe('sanctions-blocked')
    },
  )

  it('classifier does NOT leak a sanctioned country into waitlist', () => {
    // Regression guard: the order of checks in classifyProspect
    // must put sanctions FIRST. A refactor that puts Stripe-support
    // first would leak IR/CU/KP/SY into the waitlist (since they're
    // not Stripe-supported, they'd fall into
    // stripe-unsupported-corridor-waitlist by default).
    for (const cc of SANCTIONS_BLOCKED_COUNTRIES) {
      expect(classifyProspect(cc)).not.toBe(
        'stripe-unsupported-corridor-waitlist',
      )
    }
  })

  it('Non-cohort non-sanctioned unsupported country → waitlist (unchanged)', () => {
    // Sanity check that the sanctions branch hasn't broken the
    // waitlist path for legitimately unsupported countries.
    expect(classifyProspect('CN')).toBe('stripe-unsupported-corridor-waitlist')
  })
})

describe('parseGithubLocation — "Paris" ambiguity defense (hostile-review fix)', () => {
  it('"Paris" alone returns null (ambiguous — could be TX, ON, or FR)', () => {
    expect(parseGithubLocation('Paris')).toBeNull()
  })

  it('"Paris, France" still resolves to FR via country-name match', () => {
    expect(parseGithubLocation('Paris, France')).toBe('FR')
  })

  it('"Paris, TX" stays ambiguous (not a false FR)', () => {
    // Texas abbr isn't in LOCATION_LOOKUP, and "paris" alone isn't
    // either (deliberately). Result: null → cold-unknown-country.
    // Better than a false-FR classification.
    expect(parseGithubLocation('Paris, TX')).toBeNull()
  })
})

describe('Integration — real-world prospect scenarios', () => {
  it('backfill + classify: Pakistani dev via GitHub → waitlist', () => {
    const country = backfillCountry({
      githubLocation: 'Lahore, Pakistan',
      domain: 'acme.pk',
    })
    expect(country).toBe('PK')
    expect(classifyProspect(country)).toBe(
      'stripe-unsupported-corridor-waitlist',
    )
    expect(isCohort1(country)).toBe(true)
  })

  it('backfill + classify: US dev via domain → activate-now', () => {
    const country = backfillCountry({
      githubLocation: null,
      domain: 'acme.us',
    })
    expect(country).toBe('US')
    expect(classifyProspect(country)).toBe('activate-now')
    expect(isCohort1(country)).toBe(false)
  })

  it('backfill + classify: unresolvable → stays cold', () => {
    const country = backfillCountry({
      githubLocation: 'Building stuff',
      domain: 'portfolio.com',
    })
    expect(country).toBe('UNKNOWN')
    expect(classifyProspect(country)).toBe('cold-unknown-country')
  })

  it('backfill + classify: Indian dev via GitHub (Stripe supports) → activate-now', () => {
    const country = backfillCountry({
      githubLocation: 'Bangalore, India',
      domain: null,
    })
    expect(country).toBe('IN')
    expect(classifyProspect(country)).toBe('activate-now')
    // Not in cohort 1 because Stripe does support IN.
    expect(isCohort1(country)).toBe(false)
  })
})
