import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

/**
 * `/status` — public status page entry point.
 *
 * Linked from the marketing footer ("Status"). The route resolves to
 * one of two behaviors depending on `UPTIMEROBOT_STATUS_URL`:
 *
 *   1. **Set + valid (production):** server-side redirect to the
 *      UptimeRobot public status page. The redirect happens during
 *      render, so RSC prefetch from `<Link>` caches the redirect
 *      target and click-through is instant.
 *
 *   2. **Unset or malformed (local dev, fresh preview):** render a
 *      small explanation page with a contact mailto fallback. Avoids
 *      a 404 — the previous footer link had no target page and the
 *      RSC prefetch surfaced as a console 404 on every page that
 *      rendered the footer.
 *
 * Mirrors the env-gating pattern already in
 * `app/protocols/x402/facilitator/page.tsx::FacilitatorStatusBadge`
 * (https:// protocol check before trusting the env value).
 */

export const metadata: Metadata = {
  title: 'Status — SettleGrid',
  description:
    'Live status of the SettleGrid platform — kernel, rails, and adapter health.',
  // Status pages are linked from the footer; no reason to noindex,
  // but no SEO upside either. Leaving robots default (indexable) so
  // sitemap inclusion is consistent.
}

export default function StatusPage() {
  const uptimeStatusUrl = process.env.UPTIMEROBOT_STATUS_URL?.trim()

  if (uptimeStatusUrl && /^https:\/\//.test(uptimeStatusUrl)) {
    // Server-side redirect — works for RSC prefetch (cached as a
    // redirect, not a 404) and click-through navigation. `redirect()`
    // accepts an external URL; Next.js emits a 307 to the absolute
    // URL.
    redirect(uptimeStatusUrl)
  }

  // Fallback: no UptimeRobot URL configured. Render a tiny info page
  // rather than 404 so the footer link still terminates cleanly.
  return (
    <main className="min-h-screen bg-[#0C0E14] text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <h1 className="text-3xl font-bold mb-4">Status</h1>
        <p className="text-gray-400 mb-6">
          A live status page isn&apos;t configured for this environment.
          For incidents or downtime reports, reach{' '}
          <a
            href="mailto:support@settlegrid.ai"
            className="text-amber-400 hover:text-amber-300 underline"
          >
            support@settlegrid.ai
          </a>
          .
        </p>
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Home
        </Link>
      </div>
    </main>
  )
}
