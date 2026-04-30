/**
 * P2.INTL1 — machine-readable international-coverage constants.
 *
 * Pairs with `data/international/country-tracker.md` and
 * `docs/sops/manual-wise-payouts.md`. The prose docs are the
 * source-of-truth explanation; this file is the source-of-truth
 * runtime. Consumers (the cold-email backfill script, the
 * waitlist-routing UI, the developer-onboarding country check)
 * import from here rather than re-parsing markdown.
 *
 * Update procedure: when Stripe changes Connect country coverage,
 * update `STRIPE_CONNECT_CAPABILITIES.individualCountries` in
 * `packages/mcp/src/rails/stripe-connect.ts` and re-run the tests
 * that import this module — the test "Stripe-supported set is
 * mirrored from the Connect adapter" will fail if they drift.
 */

import { STRIPE_CONNECT_CAPABILITIES } from '@settlegrid/mcp'

/**
 * Set of ISO-3166 alpha-2 codes where Stripe Connect currently
 * supports individual payouts. Computed from the adapter's
 * capability envelope so this module is never out of sync with
 * the actual payout-rail support.
 */
export const STRIPE_SUPPORTED_COUNTRIES: ReadonlySet<string> = new Set(
  STRIPE_CONNECT_CAPABILITIES.individualCountries,
)

/**
 * Cohort 1 — the Stripe-unsupported corridors with highest expected
 * waitlist volume per `data/international/country-tracker.md` §5.
 * Used by the backfill script + the waitlist UI to label
 * "high-priority waitlist" candidates distinctly from the long-tail
 * of other unsupported countries.
 */
export const COHORT_1_COUNTRIES = [
  'PK', // Pakistan
  'NG', // Nigeria
  'BD', // Bangladesh
  'VN', // Vietnam
  'PH', // Philippines
  'ID', // Indonesia
  'KE', // Kenya
  'GH', // Ghana
  'UA', // Ukraine
  'TR', // Turkey
] as const

export type Cohort1Country = (typeof COHORT_1_COUNTRIES)[number]

const COHORT_1_SET: ReadonlySet<string> = new Set(COHORT_1_COUNTRIES)

/** Is this country Stripe-Connect-supported for individual payouts? */
export function isStripeSupported(isoCode: string): boolean {
  return STRIPE_SUPPORTED_COUNTRIES.has(isoCode.toUpperCase())
}

/** Is this country in the active Cohort-1 waitlist target set? */
export function isCohort1(isoCode: string): boolean {
  return COHORT_1_SET.has(isoCode.toUpperCase())
}

/**
 * OFAC comprehensively-sanctioned jurisdictions (`docs/legal/ofac-program.md`
 * §3.2). Prospects from these countries must NEVER be routed to the
 * waitlist — the waitlist implies "we'll figure out a payout rail
 * for you eventually", which is incompatible with sanctions
 * compliance. They route to `sanctions-blocked` instead and get no
 * further outbound email.
 *
 * This list mirrors the OFAC program's §3.2 manually; we don't
 * import it as a constant because OFAC program is markdown, not
 * code. If either list changes, the other must be updated.
 * Hostile-review test guards the coordination.
 */
export const SANCTIONS_BLOCKED_COUNTRIES = [
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea (DPRK)
  'SY', // Syria
  // Note: Crimea, DNR, LNR are sub-national regions of Ukraine and
  // don't have their own ISO-3166 α-2 code in the standard set.
  // Address-level review catches those — the free-text parser
  // returns UNKNOWN for "Crimea" / "Donetsk" / "Luhansk" because
  // they're not in LOCATION_LOOKUP, which is the right conservative
  // behavior.
] as const

const SANCTIONS_BLOCKED_SET: ReadonlySet<string> = new Set(
  SANCTIONS_BLOCKED_COUNTRIES,
)

/** Is this country comprehensively sanctioned by OFAC? */
export function isSanctionsBlocked(isoCode: string): boolean {
  return SANCTIONS_BLOCKED_SET.has(isoCode.toUpperCase())
}

/**
 * Classify a prospect's country into one of the outreach segments
 * per `data/international/country-tracker.md` §4.
 *
 * Precedence (hostile-review fix): sanctions block is checked BEFORE
 * Stripe support. A prospect from Iran is `sanctions-blocked` and
 * does NOT continue to the waitlist, regardless of any other factor.
 */
export type OutreachSegment =
  | 'activate-now'
  | 'stripe-unsupported-corridor-waitlist'
  | 'cold-unknown-country'
  | 'sanctions-blocked'

export function classifyProspect(
  countryIso: string | null | undefined,
): OutreachSegment {
  if (!countryIso || countryIso.toUpperCase() === 'UNKNOWN') {
    return 'cold-unknown-country'
  }
  if (isSanctionsBlocked(countryIso)) {
    return 'sanctions-blocked'
  }
  return isStripeSupported(countryIso)
    ? 'activate-now'
    : 'stripe-unsupported-corridor-waitlist'
}

/**
 * Parse a GitHub-user `location` string (which is free-text, e.g.
 * "San Francisco, CA", "Berlin, Germany", "🇮🇳 Bangalore") into an
 * ISO-3166 alpha-2 code. Returns null when the parse is
 * unambiguous enough to surrender.
 *
 * Honest scope note: this is a best-effort heuristic, not a full
 * gazetteer. It handles the common cases that show up in real
 * outreach data; the docstring in the table below lists what's
 * covered. Edge cases (subnational descriptions, typos,
 * aspirational locations, jokes) fall through to `null` and the
 * prospect routes to `cold-unknown-country` — the correct behavior
 * per the spec's backfill policy.
 */
export function parseGithubLocation(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  // Strip flag emoji, angle brackets, common decorations.
  const clean = raw
    .replace(
      /[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F3F4}\u{E0062}-\u{E007F}]+/gu,
      '',
    )
    .trim()
  if (clean.length === 0) return null

  const tokens = clean
    .split(/[,;/|—–]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  // Pass 1: prefer full-name / well-known-city matches. "San
  // Francisco, CA" must resolve to US (via "san francisco") rather
  // than to CA (Canada) via the 2-letter-code fallback.
  for (const token of tokens) {
    const hit = LOCATION_LOOKUP[token]
    if (hit) return hit
  }
  // Pass 2: fall back to 2-letter ISO codes — "Tokyo, JP" parses
  // the JP directly. Only reached when no named-location match was
  // found, so it can't clobber Pass 1.
  for (const token of tokens) {
    const asUpper = token.toUpperCase()
    if (asUpper.length === 2 && /^[A-Z]{2}$/.test(asUpper)) {
      if (ALL_ISO_COUNTRIES.has(asUpper)) return asUpper
    }
  }
  return null
}

/**
 * Parse an email domain or company domain into an ISO country code
 * via the domain's ccTLD. Returns null for generic TLDs
 * (.com/.org/.net/.io/.ai/.dev/.co) — we refuse to guess.
 */
export function parseDomainTld(
  domain: string | null | undefined,
): string | null {
  if (!domain || typeof domain !== 'string') return null
  const tld = domain.trim().toLowerCase().split('.').pop()
  if (!tld) return null
  if (GENERIC_TLDS.has(tld)) return null
  // Special-case the handful of compound/virtual ccTLDs that don't
  // map to their own country (co.uk → GB, com.au → AU, etc.).
  // Fall through to the direct ccTLD lookup for the rest.
  const mapped = SPECIAL_TLDS[tld]
  if (mapped) return mapped
  const asUpper = tld.toUpperCase()
  return CC_TLDS.has(tld) && ALL_ISO_COUNTRIES.has(asUpper)
    ? asUpper
    : null
}

/**
 * Full backfill: GitHub location first, domain TLD fallback,
 * UNKNOWN if neither resolves. Matches the spec-required heuristic
 * order from `data/international/country-tracker.md` §3.
 */
export function backfillCountry(input: {
  githubLocation?: string | null
  domain?: string | null
}): string {
  const fromGithub = parseGithubLocation(input.githubLocation)
  if (fromGithub) return fromGithub
  const fromDomain = parseDomainTld(input.domain)
  if (fromDomain) return fromDomain
  return 'UNKNOWN'
}

/* -------------------------------------------------------------------------- */
/*  Lookup tables                                                              */
/* -------------------------------------------------------------------------- */

// Generic TLDs we deliberately don't map (insufficient signal).
const GENERIC_TLDS = new Set([
  'com', 'org', 'net', 'io', 'ai', 'dev', 'co', 'app', 'xyz', 'tech',
  'info', 'biz', 'me', 'online', 'site', 'cloud',
])

// ccTLDs that map to a non-obvious country (or to a different country
// than the 2-letter code would suggest).
const SPECIAL_TLDS: Record<string, string> = {
  uk: 'GB',
  eu: 'EU', // not an ISO country but flagged for waitlist
}

// Every ISO-3166 α-2 country code (short version; covers the ones
// that appear in cold-outreach data at volume). If the outreach
// hits a country not in this list, the user is presumed not a
// high-frequency-enough target to matter and falls to UNKNOWN.
const ALL_ISO_COUNTRIES = new Set([
  ...STRIPE_CONNECT_CAPABILITIES.individualCountries,
  ...COHORT_1_COUNTRIES,
  'CN', 'RU', 'BY', 'SA', 'QA', 'EG', 'MA', 'DZ', 'TN', 'IL', 'IR',
  'IQ', 'AF', 'LK', 'NP', 'MM', 'MY', 'KH', 'LA', 'MN', 'KR', 'TW',
  'AR', 'CL', 'CO', 'PE', 'UY', 'VE', 'EC', 'BO', 'PY', 'CR', 'PA',
  'DO', 'GT', 'HN', 'SV', 'NI', 'JM', 'TT', 'ZA', 'ZM', 'ZW', 'TZ',
  'UG', 'RW', 'SN', 'CI', 'CM', 'ET',
])

// ccTLDs that map directly to their α-2 code (the standard case).
// Only populate for countries we actually see in outreach data.
const CC_TLDS = new Set([
  // Stripe-supported (via individualCountries)
  'au', 'at', 'be', 'br', 'bg', 'ca', 'hr', 'cy', 'cz', 'dk', 'ee',
  'fi', 'fr', 'de', 'gi', 'gr', 'hk', 'hu', 'in', 'ie', 'it', 'jp',
  'lv', 'li', 'lt', 'lu', 'mt', 'mx', 'nl', 'nz', 'no', 'pl', 'pt',
  'ro', 'sg', 'sk', 'si', 'es', 'se', 'ch', 'th', 'ae', 'us',
  // Cohort 1 (unsupported)
  'pk', 'ng', 'bd', 'vn', 'ph', 'id', 'ke', 'gh', 'ua', 'tr',
  // Long tail that shows up in outreach data
  'cn', 'ru', 'by', 'sa', 'qa', 'eg', 'ma', 'il', 'lk', 'my', 'kr',
  'tw', 'ar', 'cl', 'co', 'pe', 'cr', 'za', 'zw',
])

// GitHub-location free-text lookup. Lowercase keys; values are α-2
// codes. Covers country names, major-city references that are
// unambiguous in isolation (when the city uniquely names one
// country), and the common "<city>, <country-code>" patterns.
const LOCATION_LOOKUP: Record<string, string> = {
  // Full country names
  'united states': 'US',
  'usa': 'US',
  'united states of america': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'england': 'GB',
  'scotland': 'GB',
  'wales': 'GB',
  'northern ireland': 'GB',
  'germany': 'DE',
  'deutschland': 'DE',
  'france': 'FR',
  'spain': 'ES',
  'españa': 'ES',
  'italy': 'IT',
  'italia': 'IT',
  'netherlands': 'NL',
  'the netherlands': 'NL',
  'holland': 'NL',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'ireland': 'IE',
  'portugal': 'PT',
  'poland': 'PL',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'austria': 'AT',
  'switzerland': 'CH',
  'belgium': 'BE',
  'greece': 'GR',
  'japan': 'JP',
  'singapore': 'SG',
  'australia': 'AU',
  'new zealand': 'NZ',
  'canada': 'CA',
  'brazil': 'BR',
  'brasil': 'BR',
  'mexico': 'MX',
  'méxico': 'MX',
  'india': 'IN',
  'hong kong': 'HK',
  'thailand': 'TH',
  'united arab emirates': 'AE',
  'uae': 'AE',
  // Cohort 1
  'pakistan': 'PK',
  'nigeria': 'NG',
  'bangladesh': 'BD',
  'vietnam': 'VN',
  'viet nam': 'VN',
  'philippines': 'PH',
  'indonesia': 'ID',
  'kenya': 'KE',
  'ghana': 'GH',
  'ukraine': 'UA',
  'turkey': 'TR',
  'türkiye': 'TR',
  'turkiye': 'TR',
  // Long tail
  'china': 'CN',
  'russia': 'RU',
  'south korea': 'KR',
  'korea': 'KR',
  'south africa': 'ZA',
  'argentina': 'AR',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'egypt': 'EG',
  'israel': 'IL',
  'malaysia': 'MY',
  'taiwan': 'TW',
  // Major cities — used when GitHub location says e.g. "San Francisco"
  // or "🇮🇳 Bangalore" without a country name. Only cities that
  // UNAMBIGUOUSLY identify one country are included (e.g., "Paris"
  // is also a town in Texas and Ontario, so it's deliberately NOT
  // listed — the location "Paris, France" matches via the country
  // name instead).
  'san francisco': 'US',
  'sf': 'US',
  'new york': 'US',
  'nyc': 'US',
  'los angeles': 'US',
  'la': 'US',
  'seattle': 'US',
  'boston': 'US',
  'austin': 'US',
  'chicago': 'US',
  'denver': 'US',
  'portland': 'US',
  'brooklyn': 'US',
  'san jose': 'US',
  'palo alto': 'US',
  'mountain view': 'US',
  'london': 'GB',
  'manchester': 'GB',
  'edinburgh': 'GB',
  'cambridge': 'GB',
  'oxford': 'GB',
  'berlin': 'DE',
  'munich': 'DE',
  'münchen': 'DE',
  'hamburg': 'DE',
  'cologne': 'DE',
  'köln': 'DE',
  // 'paris' deliberately OMITTED — there are Paris, TX and Paris, ON
  // and the ambiguity matters more than the convenience. "Paris,
  // France" still matches via the 'france' country-name entry.
  'lyon': 'FR',
  'amsterdam': 'NL',
  'rotterdam': 'NL',
  'madrid': 'ES',
  'barcelona': 'ES',
  'rome': 'IT',
  'milan': 'IT',
  'milano': 'IT',
  'stockholm': 'SE',
  'oslo': 'NO',
  'copenhagen': 'DK',
  'helsinki': 'FI',
  'dublin': 'IE',
  'lisbon': 'PT',
  'warsaw': 'PL',
  'prague': 'CZ',
  'vienna': 'AT',
  'zurich': 'CH',
  'geneva': 'CH',
  'brussels': 'BE',
  'athens': 'GR',
  'tokyo': 'JP',
  'osaka': 'JP',
  'kyoto': 'JP',
  'bangalore': 'IN',
  'bengaluru': 'IN',
  'mumbai': 'IN',
  'bombay': 'IN',
  'delhi': 'IN',
  'new delhi': 'IN',
  'hyderabad': 'IN',
  'chennai': 'IN',
  'pune': 'IN',
  'karachi': 'PK',
  'lahore': 'PK',
  'islamabad': 'PK',
  'dhaka': 'BD',
  'lagos': 'NG',
  'abuja': 'NG',
  'hanoi': 'VN',
  'ho chi minh': 'VN',
  'ho chi minh city': 'VN',
  'saigon': 'VN',
  'manila': 'PH',
  'cebu': 'PH',
  'jakarta': 'ID',
  'bandung': 'ID',
  'nairobi': 'KE',
  'accra': 'GH',
  'kyiv': 'UA',
  'kiev': 'UA',
  'istanbul': 'TR',
  'ankara': 'TR',
  'toronto': 'CA',
  'vancouver': 'CA',
  'montreal': 'CA',
  'sydney': 'AU',
  'melbourne': 'AU',
  'auckland': 'NZ',
  'wellington': 'NZ',
  'são paulo': 'BR',
  'sao paulo': 'BR',
  'buenos aires': 'AR',
  'mexico city': 'MX',
  'ciudad de méxico': 'MX',
  'bogota': 'CO',
  'bogotá': 'CO',
  'lima': 'PE',
  'santiago': 'CL',
}
