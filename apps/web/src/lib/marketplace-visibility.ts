import { z } from 'zod'
import { eq, and, or, type SQL } from 'drizzle-orm'
import { tools } from './db/schema'

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

/**
 * Whether a marketplace tool card should render the amber "Claimed" badge.
 * The badge distinguishes claimed-but-not-yet-monetized listings from
 * unclaimed and from monetized listings (P2.INTL2). Only `status='draft'`
 * tools that satisfied `shouldIncludeInMarketplace` are eligible.
 *
 * Pure function so the rendering condition has a regression-testable mirror.
 * The actual JSX lives in `apps/web/src/components/marketplace/tool-card.tsx`.
 */
export function shouldShowClaimedBadge(status: string): boolean {
  return status === 'draft'
}

/**
 * Whether a marketplace tool card should render the "Unclaimed" badge.
 * True for shadow-directory entries (`status='unclaimed'`) that haven't
 * been claimed by a maintainer yet. Paired with `shouldShowClaimedBadge`
 * so every marketplace-visible tool can be classified:
 *   unclaimed → "Unclaimed"
 *   draft     → "Claimed" (amber — has an owner, no pricing yet)
 *   active    → no badge
 *
 * Replaces a hand-rolled heuristic in tool-card.tsx
 * (`status==='active' && totalRevenueCents===0 && !verified`) that fired
 * on "published-but-no-traffic" rather than on the actual unclaimed state,
 * causing shadow-directory tools to display without any badge.
 */
export function shouldShowUnclaimedBadge(status: string): boolean {
  return status === 'unclaimed'
}

/**
 * Whether a tool is purchasable via the Buy Credits flow.
 *
 * True iff `status='active'` — the developer has completed Stripe Connect
 * onboarding and has a pricing config. Draft (claimed but no payments live
 * in their region) and unclaimed (no owner) tools cannot receive payouts
 * and must NOT be purchasable.
 *
 * Mirrored by:
 *   - `apps/web/src/app/api/billing/checkout/route.ts` (server-side gate)
 *   - `apps/web/src/app/tools/[slug]/page.tsx` (render-side gate)
 *   - `apps/web/src/components/storefront/buy-credits-button.tsx` (defense-in-depth)
 *
 * Extracted so the three sites cannot drift — the producer-audit punch
 * list flagged this as the same bug class as the INTL2 marketplace
 * predicate drift.
 */
export function canPurchaseCredits(status: string): boolean {
  return status === 'active'
}

/**
 * Zod schema for the PATCH /api/tools/[id]/listed-in-marketplace request body.
 * Exported so the route handler and the regression tests share one definition
 * of the wire shape.
 */
export const listedInMarketplacePatchSchema = z.object({
  listedInMarketplace: z.boolean(),
})

/**
 * P2.INTL2 — the four statuses a marketplace-visible tool can have.
 *
 * Kept here so the TS helper (`shouldIncludeInMarketplace`) and the Drizzle
 * predicate builder (`marketplaceInclusionSql`) read from one list. Drift
 * between them used to let unclaimed tools pass the marketplace predicate
 * but fail the detail-route predicate — the exact class of bug this module
 * is meant to prevent.
 */
export const MARKETPLACE_ALWAYS_VISIBLE_STATUSES = ['unclaimed', 'active'] as const
export const MARKETPLACE_CONDITIONALLY_VISIBLE_STATUSES = ['draft'] as const

/**
 * Canonical Drizzle predicate mirroring `shouldIncludeInMarketplace`.
 *
 * SQL call sites (marketplace content page, /api/marketplace, trending,
 * /api/tools/public/[slug]) MUST use this instead of hand-rolling the
 * expression. Hand-rolled versions drifted — the public detail route
 * omitted 'unclaimed', which caused every unclaimed tool card in the
 * marketplace to link to a 404 page.
 *
 * The predicate matches the TS rule one-to-one:
 *   - status IN ('unclaimed', 'active')                           → always in
 *   - status = 'draft' AND listed_in_marketplace = true          → conditionally in
 *   - any other status                                            → excluded
 */
export function marketplaceInclusionSql(): SQL {
  return or(
    eq(tools.status, 'unclaimed'),
    eq(tools.status, 'active'),
    and(eq(tools.status, 'draft'), eq(tools.listedInMarketplace, true)),
  )!
}
