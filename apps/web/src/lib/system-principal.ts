/**
 * The crawler/scan SYSTEM developer principal — it owns the crawled/unclaimed tool
 * catalog, carries a NULL `supabaseUserId`, and is NEVER a GDPR data subject nor an
 * adoptable/relinkable identity. Guarded at the `processDataDeletion` chokepoint,
 * both erasure doors, and the `auth/callback` relink so no authenticated user can
 * ADOPT it (and then erase the whole catalog, or take it over — mutate every tool's
 * proxy/pricing/payout). See ③ deep-audit A-1 / defect class DC-27.
 *
 * ⚠ SECURITY: the historical email is on `settlegrid.com` — a THIRD-PARTY domain the
 * company does NOT own (a live debt-settlement platform, "XoBot"). Its mailbox is
 * attacker-obtainable, so the EMAIL is NOT a safe identity anchor: the guards key on
 * the stable, company-owned SLUG. `SYSTEM_DEVELOPER_EMAIL` is migrated to the company
 * domain for any FUTURE row; the EXISTING prod row keeps its legacy email until ops
 * runs `UPDATE developers SET email='system@settlegrid.ai' WHERE slug='settlegrid-system'`
 * (which `isSystemPrincipal` also matches by the legacy value in the meantime).
 */
export const SYSTEM_DEVELOPER_SLUG = 'settlegrid-system'
export const SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.ai'
export const SYSTEM_DEVELOPER_NAME = 'SettleGrid System'

/** The legacy third-party-domain email the existing prod system row still carries. */
const LEGACY_SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.com'

/**
 * True if a developer row is the system catalog principal. SLUG is the load-bearing,
 * stable anchor (company-owned, immutable); email is matched as belt-and-suspenders
 * for the legacy prod row until its email is migrated off the third-party domain.
 */
export function isSystemPrincipal(row: { email?: string | null; slug?: string | null }): boolean {
  if (row.slug === SYSTEM_DEVELOPER_SLUG) return true
  const email = row.email?.toLowerCase()
  return email === SYSTEM_DEVELOPER_EMAIL || email === LEGACY_SYSTEM_DEVELOPER_EMAIL
}
