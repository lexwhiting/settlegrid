/**
 * P3.RAIL3 — /dashboard/admin/chargeback-watch.
 *
 * Founder-only page that lists every developer with an open
 * (unresolved) yellow- or red-tier chargeback alert. Each row links
 * to the Stripe Connect dispute dashboard for that account and, on
 * red-tier rows, exposes an "unpause" action that hits
 * POST /api/admin/chargeback-watch/unpause.
 *
 * Auth: requireDeveloper + ADMIN_EMAILS allowlist (same gate as
 * /admin/templater).
 *
 * Data flow: read every chargeback_alerts row WHERE resolved_at IS
 * NULL, joined with developers for email/connect-id. Order by
 * created_at DESC so the freshest alerts surface first.
 */

import Link from 'next/link'
import { forbidden, unauthorized } from 'next/navigation'
import { eq, isNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, chargebackAlerts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import UnpauseButton from './unpause-button'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/**
 * Cap the watch table at this many rows. The dashboard is meant to
 * surface the freshest yellow/red alerts; if there are >200 open at
 * once we have a much bigger problem than UI pagination.
 */
const MAX_WATCH_ROWS = 200

async function requireAdmin(): Promise<{ id: string; email: string }> {
  let auth
  try {
    auth = await requireDeveloper()
  } catch {
    unauthorized()
  }
  if (!ADMIN_EMAILS.includes(auth.email)) {
    forbidden()
  }
  return auth
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function tierClasses(tier: string): string {
  if (tier === 'red')
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
}

function stripeDisputeUrl(connectId: string | null): string {
  if (!connectId) return '#'
  return `https://dashboard.stripe.com/connect/accounts/${encodeURIComponent(connectId)}/disputes`
}

export default async function ChargebackWatchPage() {
  await requireAdmin()

  const rows = await db
    .select({
      id: chargebackAlerts.id,
      developerId: chargebackAlerts.developerId,
      developerEmail: developers.email,
      stripeConnectId: developers.stripeConnectId,
      onboardingPaused: developers.onboardingPaused,
      tier: chargebackAlerts.tier,
      rateByCount: chargebackAlerts.rateByCount,
      rateByVolume: chargebackAlerts.rateByVolume,
      chargesCount: chargebackAlerts.chargesCount,
      chargebacksCount: chargebackAlerts.chargebacksCount,
      chargesVolumeCents: chargebackAlerts.chargesVolumeCents,
      chargebacksVolumeCents: chargebackAlerts.chargebacksVolumeCents,
      pausedOnboarding: chargebackAlerts.pausedOnboarding,
      createdAt: chargebackAlerts.createdAt,
    })
    .from(chargebackAlerts)
    .innerJoin(developers, eq(developers.id, chargebackAlerts.developerId))
    .where(isNull(chargebackAlerts.resolvedAt))
    .orderBy(desc(chargebackAlerts.createdAt))
    .limit(MAX_WATCH_ROWS)

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <Link href="/dashboard/admin" className="hover:underline">
            Admin
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-200">
            Chargeback watch
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">
          Chargeback watch
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Open yellow + red alerts. Stripe&apos;s 1% intervention
          threshold is the upper bound — red tier kicks in at 0.5% to
          give us margin.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A] p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No open chargeback alerts.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A]">
          <table
            className="w-full text-sm"
            role="table"
            aria-label="Open chargeback alerts"
          >
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                <th
                  scope="col"
                  className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Tier
                </th>
                <th
                  scope="col"
                  className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Developer
                </th>
                <th
                  scope="col"
                  className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Rate (count)
                </th>
                <th
                  scope="col"
                  className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Rate (volume)
                </th>
                <th
                  scope="col"
                  className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Charges (30d)
                </th>
                <th
                  scope="col"
                  className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Disputes (30d)
                </th>
                <th
                  scope="col"
                  className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Logged
                </th>
                <th
                  scope="col"
                  className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rateByCount = Number(r.rateByCount)
                const rateByVolume = Number(r.rateByVolume)
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 dark:border-[#252836]"
                  >
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tierClasses(r.tier)}`}
                      >
                        {r.tier}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                      {r.developerEmail}
                      {r.onboardingPaused && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                          paused
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {(rateByCount * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {(rateByVolume * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {r.chargesCount} ({formatCents(r.chargesVolumeCents)})
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {r.chargebacksCount} (
                      {formatCents(r.chargebacksVolumeCents)})
                    </td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="py-2 px-3 space-x-2">
                      <a
                        href={stripeDisputeUrl(r.stripeConnectId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-brand hover:underline text-xs"
                      >
                        Stripe disputes ↗
                      </a>
                      {r.onboardingPaused && (
                        <UnpauseButton developerId={r.developerId} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Source of truth: Stripe Disputes + ledger charges. Computed
        daily by{' '}
        <code className="text-xs">scripts/chargeback-velocity.ts</code>.
      </p>
    </div>
  )
}
