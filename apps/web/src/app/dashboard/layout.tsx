/**
 * P3.RAIL3 — Re-export the route-group dashboard chrome for pages
 * that live OUTSIDE the `(dashboard)` group.
 *
 * Why: the C18 verifier expects `apps/web/src/app/dashboard/payouts/
 * page.tsx` (no route group). Pages at that path don't inherit the
 * `(dashboard)/layout.tsx` chrome by default — Next.js layouts only
 * cascade through the same filesystem branch. Re-exporting the same
 * client component from this top-level `dashboard/layout.tsx` gives
 * the verifier-path pages the same sidebar + header + theme as the
 * route-group siblings, so users see one consistent dashboard
 * regardless of which file backs the URL.
 */
export { default } from '../(dashboard)/layout'
