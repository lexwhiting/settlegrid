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
 * re-inflates metrics. The DOMAIN rule auto-covers future @settlegrid.ai /
 * @alerterra.com accounts (fail-closed); personal-gmail founder/seed accounts
 * and the system principal's third-party-domain email are listed explicitly below.
 *
 * ⚠ `settlegrid.com` was REMOVED from the domain rule (③ deep-audit A-1): it is a
 * THIRD-PARTY domain we do NOT own (a live debt platform, "XoBot"), so trusting
 * every `@settlegrid.com` address as "internal" is wrong — an attacker-controlled
 * signup on that domain would be silently classified internal (and, once the planned
 * `developers.isInternal` flag backfills from this list, could inherit trust). Only
 * the ONE legitimate internal account on that domain (the crawler system principal)
 * is listed explicitly. Migrate its email to `system@settlegrid.ai` so the domain
 * rule covers it, then drop the explicit entry.
 */

/** Org domains whose every address is internal (auto-covers future signups). */
export const INTERNAL_EMAIL_DOMAINS = ['settlegrid.ai', 'alerterra.com'] as const

/** Personal-domain / third-party-domain internal-seed accounts (must be explicit). */
export const INTERNAL_DEVELOPER_EMAILS = [
  'lexwhiting@gmail.com', // seed-data account (seed-dashboard-data.ts target)
  'lexwhiting365@gmail.com', // admin (ecosystem-metrics ADMIN_EMAILS)
  'lutherwhitingcollins@gmail.com', // founder
  'system@settlegrid.com', // crawler system principal (legacy third-party-domain email — do NOT trust the DOMAIN)
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
