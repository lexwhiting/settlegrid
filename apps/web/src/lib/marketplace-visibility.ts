/**
 * P2.INTL2 marketplace inclusion rule.
 *
 * Pure function documenting which tools should appear in the public
 * marketplace. The corresponding SQL predicates live in
 * `apps/web/src/app/marketplace/marketplace-content.tsx`,
 * `apps/web/src/app/api/marketplace/route.ts`, and
 * `apps/web/src/app/marketplace/trending/page.tsx`. This helper exists
 * so the rule has one canonical, testable definition and so any drift in
 * the SQL predicates is caught by regression tests rather than by a
 * production bug.
 *
 * The rule:
 *   - status='unclaimed' → always included (shadow-directory behavior)
 *   - status='active'    → always included (published)
 *   - status='draft'     → included only if listedInMarketplace=true
 *                          (P2.INTL2: preserves visibility through claim
 *                          transition for developers in Stripe-unsupported
 *                          corridors who can't yet publish)
 *   - any other status   → excluded (e.g., 'deleted', 'hidden', or future
 *                          statuses not yet wired into marketplace UX)
 */
export function shouldIncludeInMarketplace(
  status: string,
  listedInMarketplace: boolean,
): boolean {
  if (status === 'unclaimed' || status === 'active') return true
  if (status === 'draft') return listedInMarketplace
  return false
}
