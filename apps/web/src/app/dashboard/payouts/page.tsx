/**
 * P3.RAIL3 — /dashboard/payouts.
 *
 * Developer-facing page that combines:
 *   1. Payout-schedule editor (client component) wired to
 *      POST /api/payouts/schedule.
 *   2. Read-only rolling-reserve policy text. (No DB-side
 *      reserve config exists yet; the spec says read-only-for-now.)
 *   3. Payout history table (status, dates, amounts).
 *
 * Server component: auth via requireDeveloper, DB read for the
 * cached schedule + recent payouts. The client schedule-form gets
 * the cached values as initial state; the form re-validates on the
 * server via Zod + the rails-package helper before persisting.
 *
 * If the developer has no Stripe Connect ID yet, the page renders
 * the schedule form disabled with an explanation + a deep link to
 * /api/stripe/connect.
 */

import Link from 'next/link'
import { unauthorized } from 'next/navigation'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, payouts as payoutsTable } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { getStripeClient } from '@/lib/rails'
import { logger } from '@/lib/logger'
import ScheduleForm from './schedule-form'
import TriggerPayoutButton from './trigger-button'
import { SCHEDULE_TTL_MS, nextPayoutDates } from './_lib'

export const dynamic = 'force-dynamic'

/**
 * Spec hostile: "current schedule is cached in the developers table
 * with a 1-hour TTL to avoid hitting Stripe on every page view."
 *
 * If the cache is older than this TTL we fetch from Stripe on the
 * next page load, persist, and render the fresh value. Stale-while-
 * error: if Stripe is unreachable the page falls back to the cached
 * value rather than rendering an error state, since the page is
 * developer-facing and the schedule cache is rarely stale-and-wrong.
 */

interface RefreshedSchedule {
  payoutSchedule: 'daily' | 'weekly' | 'monthly' | 'manual'
  payoutScheduleWeekday:
    | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    | null
  payoutScheduleMonthDay: number | null
  refreshed: boolean
}

async function refreshScheduleIfStale(params: {
  developerId: string
  stripeConnectId: string
  cached: {
    payoutSchedule: string | null
    payoutScheduleWeekday: string | null
    payoutScheduleMonthDay: number | null
    payoutScheduleSyncedAt: Date | null
  }
}): Promise<RefreshedSchedule> {
  const fallback: RefreshedSchedule = {
    payoutSchedule:
      params.cached.payoutSchedule === 'daily' ||
      params.cached.payoutSchedule === 'weekly' ||
      params.cached.payoutSchedule === 'monthly' ||
      params.cached.payoutSchedule === 'manual'
        ? params.cached.payoutSchedule
        : 'monthly',
    payoutScheduleWeekday:
      params.cached.payoutScheduleWeekday === 'monday' ||
      params.cached.payoutScheduleWeekday === 'tuesday' ||
      params.cached.payoutScheduleWeekday === 'wednesday' ||
      params.cached.payoutScheduleWeekday === 'thursday' ||
      params.cached.payoutScheduleWeekday === 'friday' ||
      params.cached.payoutScheduleWeekday === 'saturday' ||
      params.cached.payoutScheduleWeekday === 'sunday'
        ? params.cached.payoutScheduleWeekday
        : null,
    payoutScheduleMonthDay: params.cached.payoutScheduleMonthDay ?? null,
    refreshed: false,
  }
  const syncedMs = params.cached.payoutScheduleSyncedAt
    ? params.cached.payoutScheduleSyncedAt.getTime()
    : 0
  if (Date.now() - syncedMs < SCHEDULE_TTL_MS) {
    return fallback
  }
  try {
    const stripe = getStripeClient()
    const account = await stripe.accounts.retrieve(params.stripeConnectId)
    const sched = account.settings?.payouts?.schedule
    if (!sched || typeof sched.interval !== 'string') return fallback

    const interval = sched.interval
    if (
      interval !== 'daily' &&
      interval !== 'weekly' &&
      interval !== 'monthly' &&
      interval !== 'manual'
    ) {
      return fallback
    }
    const weekday =
      typeof sched.weekly_anchor === 'string' ? sched.weekly_anchor : null
    const monthDay =
      typeof sched.monthly_anchor === 'number' ? sched.monthly_anchor : null

    await db
      .update(developers)
      .set({
        payoutSchedule: interval,
        payoutScheduleWeekday: weekday,
        payoutScheduleMonthDay: monthDay,
        payoutScheduleSyncedAt: new Date(),
      })
      .where(eq(developers.id, params.developerId))

    return {
      payoutSchedule: interval,
      payoutScheduleWeekday:
        weekday === 'monday' ||
        weekday === 'tuesday' ||
        weekday === 'wednesday' ||
        weekday === 'thursday' ||
        weekday === 'friday' ||
        weekday === 'saturday' ||
        weekday === 'sunday'
          ? weekday
          : null,
      payoutScheduleMonthDay: monthDay,
      refreshed: true,
    }
  } catch (err) {
    // Stale-while-error: log + fall back to cached value. The dashboard
    // would be misleading if a Stripe outage rendered "no schedule".
    logger.warn('payouts.schedule_refresh_failed', {
      developerId: params.developerId,
      error: err instanceof Error ? err.message : String(err),
    })
    return fallback
  }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusVariantClasses(status: string): string {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'in_transit':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

interface PayoutRow {
  id: string
  amountCents: number
  platformFeeCents: number
  status: string
  periodStart: Date | null
  periodEnd: Date | null
  createdAt: Date
}

export default async function PayoutsPage() {
  let auth
  try {
    auth = await requireDeveloper()
  } catch {
    unauthorized()
  }

  const [dev] = await db
    .select({
      stripeConnectId: developers.stripeConnectId,
      stripeConnectStatus: developers.stripeConnectStatus,
      payoutSchedule: developers.payoutSchedule,
      payoutScheduleWeekday: developers.payoutScheduleWeekday,
      payoutScheduleMonthDay: developers.payoutScheduleMonthDay,
      payoutScheduleSyncedAt: developers.payoutScheduleSyncedAt,
      payoutMinimumCents: developers.payoutMinimumCents,
      balanceCents: developers.balanceCents,
      onboardingPaused: developers.onboardingPaused,
      onboardingPausedReason: developers.onboardingPausedReason,
    })
    .from(developers)
    .where(eq(developers.id, auth.id))
    .limit(1)

  if (!dev) unauthorized()

  // Spec: cache schedule with 1-hour TTL. Refresh from Stripe lazily
  // when stale; fall back to cached value on Stripe error.
  const refreshed = dev.stripeConnectId
    ? await refreshScheduleIfStale({
        developerId: auth.id,
        stripeConnectId: dev.stripeConnectId,
        cached: {
          payoutSchedule: dev.payoutSchedule,
          payoutScheduleWeekday: dev.payoutScheduleWeekday,
          payoutScheduleMonthDay: dev.payoutScheduleMonthDay,
          payoutScheduleSyncedAt: dev.payoutScheduleSyncedAt,
        },
      })
    : {
        payoutSchedule: 'monthly' as const,
        payoutScheduleWeekday: null,
        payoutScheduleMonthDay: null,
        refreshed: false,
      }

  const recentPayouts = (await db
    .select({
      id: payoutsTable.id,
      amountCents: payoutsTable.amountCents,
      platformFeeCents: payoutsTable.platformFeeCents,
      status: payoutsTable.status,
      periodStart: payoutsTable.periodStart,
      periodEnd: payoutsTable.periodEnd,
      createdAt: payoutsTable.createdAt,
    })
    .from(payoutsTable)
    .where(eq(payoutsTable.developerId, auth.id))
    .orderBy(desc(payoutsTable.createdAt))
    .limit(20)) as PayoutRow[]

  // Upcoming payouts = rows already queued at Stripe (status pending /
  // in_transit) that haven't paid yet. We render these in the
  // "Upcoming" section — actual amounts live here, deterministic dates
  // for "the schedule says next will run on …" come from
  // nextPayoutDates(...).
  const inFlightPayouts = (await db
    .select({
      id: payoutsTable.id,
      amountCents: payoutsTable.amountCents,
      platformFeeCents: payoutsTable.platformFeeCents,
      status: payoutsTable.status,
      periodStart: payoutsTable.periodStart,
      periodEnd: payoutsTable.periodEnd,
      createdAt: payoutsTable.createdAt,
    })
    .from(payoutsTable)
    .where(
      and(
        eq(payoutsTable.developerId, auth.id),
        inArray(payoutsTable.status, ['pending', 'in_transit']),
      ),
    )
    .orderBy(payoutsTable.createdAt)
    .limit(10)) as PayoutRow[]

  const initialInterval = refreshed.payoutSchedule
  const initialWeekday = refreshed.payoutScheduleWeekday

  const hasConnect = Boolean(dev.stripeConnectId)

  const upcomingDates = hasConnect
    ? nextPayoutDates({
        interval: refreshed.payoutSchedule,
        weekday: refreshed.payoutScheduleWeekday,
        monthDay: refreshed.payoutScheduleMonthDay,
      })
    : []

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-200">Payouts</span>
        </nav>
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">
          Payouts
        </h1>
      </div>

      {dev.onboardingPaused && (
        <div
          role="alert"
          className="rounded-md border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            New tool onboarding is currently paused for your account.
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            {dev.onboardingPausedReason ??
              'Reach out to support to discuss the chargeback velocity for your account.'}
          </p>
          <p className="mt-2 text-xs text-red-700 dark:text-red-400">
            Existing tools and payouts are not affected.
          </p>
        </div>
      )}

      <section
        aria-labelledby="schedule-heading"
        className="rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A] p-6"
      >
        <h2
          id="schedule-heading"
          className="text-lg font-semibold text-indigo dark:text-gray-100 mb-4"
        >
          Payout schedule
        </h2>

        {!hasConnect ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-3">
              Connect your Stripe account before configuring a payout
              schedule.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Connect Stripe
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <ScheduleForm
              initialInterval={initialInterval}
              initialWeekday={initialWeekday}
              initialMonthDay={dev.payoutScheduleMonthDay ?? null}
            />
            {/* Manual trigger — only when Connect is active and balance
                meets the threshold. Server-side eligibility checks
                are still authoritative; we hide the button when we
                already know it'd 400. */}
            {dev.stripeConnectStatus === 'active' &&
              dev.balanceCents >= dev.payoutMinimumCents && (
                <div className="border-t border-gray-200 dark:border-[#2A2D3E] pt-4">
                  <h3 className="text-sm font-semibold text-indigo dark:text-gray-100 mb-2">
                    Or pay out now
                  </h3>
                  <TriggerPayoutButton
                    balanceCents={dev.balanceCents}
                    payoutMinimumCents={dev.payoutMinimumCents}
                  />
                </div>
              )}
          </div>
        )}
      </section>

      <section
        aria-labelledby="reserve-heading"
        className="rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A] p-6"
      >
        <h2
          id="reserve-heading"
          className="text-lg font-semibold text-indigo dark:text-gray-100 mb-2"
        >
          Rolling reserve (read-only)
        </h2>
        <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
          <li>
            <strong>15%</strong> of each payout is held back for{' '}
            <strong>30 days</strong> on accounts younger than 90 days.
          </li>
          <li>
            <strong>0%</strong> reserve after 90 days of clean dispute
            history (≤ 0.3% chargeback rate).
          </li>
          <li>
            Held funds release automatically; there is no admin step
            for the developer.
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Reserve policy is platform-wide and not configurable per
          account at this time.
        </p>
      </section>

      <section
        aria-labelledby="upcoming-heading"
        className="rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A] p-6"
      >
        <h2
          id="upcoming-heading"
          className="text-lg font-semibold text-indigo dark:text-gray-100 mb-2"
        >
          Upcoming payouts
        </h2>
        {!hasConnect ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connect your Stripe account to see upcoming payouts.
          </p>
        ) : (
          <>
            {inFlightPayouts.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table
                  className="w-full text-sm"
                  role="table"
                  aria-label="In-flight payouts"
                >
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                      <th
                        scope="col"
                        className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                      >
                        Initiated
                      </th>
                      <th
                        scope="col"
                        className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inFlightPayouts.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 dark:border-[#252836]"
                      >
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-indigo dark:text-gray-100 tabular-nums">
                          {formatCents(p.amountCents)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusVariantClasses(p.status)}`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {upcomingDates.length > 0 ? (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Based on your current schedule, the next payouts will run on:
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
                  {upcomingDates.map((d) => (
                    <li key={d.toISOString()}>
                      {formatDate(d)}{' '}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (amount finalizes from settled balance at run time)
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manual schedule — payouts run only when you trigger
                them. No upcoming payouts scheduled automatically.
              </p>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="history-heading"
        className="rounded-lg border border-gray-200 dark:border-[#2A2D3E] bg-white dark:bg-[#15182A] p-6"
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2
            id="history-heading"
            className="text-lg font-semibold text-indigo dark:text-gray-100"
          >
            Payout history
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Minimum payout: {formatCents(dev.payoutMinimumCents)}
          </p>
        </div>

        {recentPayouts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No payouts yet. Payouts run on the schedule above once your
            balance reaches the minimum.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              role="table"
              aria-label="Payout history"
            >
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#2A2D3E]">
                  <th
                    scope="col"
                    className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    Period
                  </th>
                  <th
                    scope="col"
                    className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    Platform fee
                  </th>
                  <th
                    scope="col"
                    className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentPayouts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 dark:border-[#252836]"
                  >
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-indigo dark:text-gray-100 tabular-nums">
                      {formatCents(p.amountCents)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatCents(p.platformFeeCents)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusVariantClasses(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
