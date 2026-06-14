/**
 * Internal / seed / system SettleGrid accounts that must be EXCLUDED from
 * growth/traction metrics: the founder's accounts, internal ops addresses, the
 * seed-data account (apps/web/scripts/seed-dashboard-data.ts), and the system
 * account that owns the crawled catalog (system@settlegrid.com).
 *
 * Established 2026-06-14 after a prod audit found ~90% of "traction" metrics were
 * seed/internal (29/31 active tools + ~7/16 developers). See
 * docs/tech-debt/ecosystem-metrics-internal-account-exclusion-2026-06-14.md.
 *
 * STOPGAP STATUS: this list is the metric-exclusion source of truth UNTIL the
 * persistent `developers.isInternal` flag ships (see the doc above). When that
 * lands, the flag's one-time backfill MUST be derived from this same list so the
 * two never diverge, then metrics graduate to `WHERE NOT is_internal`.
 *
 * A denylist fails OPEN: a new internal account not covered here silently
 * re-inflates metrics. The DOMAIN rule auto-covers future @settlegrid.* /
 * @alerterra.com accounts (fail-closed); personal-gmail founder/seed accounts
 * have no shared domain and MUST be listed explicitly below.
 */

/** Org domains whose every address is internal (auto-covers future signups). */
export const INTERNAL_EMAIL_DOMAINS = ['settlegrid.ai', 'settlegrid.com', 'alerterra.com'] as const

/** Personal-domain internal/seed accounts (no shared domain — must be explicit). */
export const INTERNAL_DEVELOPER_EMAILS = [
  'lexwhiting@gmail.com', // seed-data account (seed-dashboard-data.ts target)
  'lexwhiting365@gmail.com', // admin (ecosystem-metrics ADMIN_EMAILS)
  'lutherwhitingcollins@gmail.com', // founder
] as const

const INTERNAL_EMAIL_SET = new Set<string>(
  INTERNAL_DEVELOPER_EMAILS.map((e) => e.toLowerCase()),
)

/**
 * True if `email` belongs to an internal/seed/system account and should be
 * excluded from traction metrics. Matches the explicit list OR an internal
 * org domain. Null/blank/malformed → false (treated as external, fail-visible).
 */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  if (INTERNAL_EMAIL_SET.has(e)) return true
  const at = e.lastIndexOf('@')
  if (at === -1) return false
  const domain = e.slice(at + 1)
  return (INTERNAL_EMAIL_DOMAINS as readonly string[]).includes(domain)
}
