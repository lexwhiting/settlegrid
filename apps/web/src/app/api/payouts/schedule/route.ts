/**
 * P3.RAIL3 — POST /api/payouts/schedule.
 *
 * Developer-facing endpoint to update the connected account's payout
 * schedule (interval + weekday/monthDay anchor).
 *
 * Flow:
 *   1. Auth via requireDeveloper.
 *   2. Rate-limit by IP.
 *   3. Validate payload via Zod (interval discriminated union).
 *   4. Look up the developer's `stripeConnectId`. Reject if missing
 *      with 409 — no Stripe account = no schedule to update.
 *   5. Call `updatePayoutSchedule()` from @settlegrid/rails. The
 *      helper is idempotent — a re-submit of the same schedule
 *      collapses to a no-op (hostile (a)).
 *   6. Persist the schedule to the developers table cache so the
 *      /dashboard/payouts page can render without an extra Stripe
 *      round-trip on every page view.
 *   7. Audit-log the change.
 *
 * Hostile pre-checks:
 *   - (a) Idempotent: helper compares against current schedule
 *     before calling Stripe; double-submit = single Stripe call max.
 *   - Fail-closed on Stripe errors: API errors map to 502 with a
 *     generic message; the underlying error is logged but not
 *     leaked to the caller.
 *   - Onboarding-paused developers (chargeback red tier) are NOT
 *     blocked from changing their own payout schedule — that's an
 *     active-developer operation, separate from new-tool gating.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { getStripeClient } from '@/lib/rails'
import {
  updatePayoutSchedule,
  InvalidPayoutScheduleError,
  type DesiredPayoutSchedule,
  type StripePayoutClient,
} from '@settlegrid/rails'

export const maxDuration = 60

// Discriminated union via Zod — `weekday` is required iff
// interval='weekly', `monthDay` iff interval='monthly'. The same
// shape is enforced at the rails-package layer (defence in depth).
const scheduleSchema = z.discriminatedUnion('interval', [
  z.object({ interval: z.literal('manual') }),
  z.object({ interval: z.literal('daily') }),
  z.object({
    interval: z.literal('weekly'),
    weekday: z.enum([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]),
  }),
  z.object({
    interval: z.literal('monthly'),
    monthDay: z.number().int().min(1).max(31),
  }),
])

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `payout-schedule:${ip.split(',')[0]?.trim() ?? 'unknown'}`)
    if (!rl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Authentication required',
        401,
        'UNAUTHORIZED',
      )
    }

    const userRl = await checkRateLimit(apiLimiter, `payout-schedule:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    const body = (await parseBody(request, scheduleSchema)) as DesiredPayoutSchedule

    // Look up the developer's Stripe Connect ID + cached schedule.
    const [dev] = await db
      .select({
        stripeConnectId: developers.stripeConnectId,
        payoutSchedule: developers.payoutSchedule,
        payoutScheduleWeekday: developers.payoutScheduleWeekday,
        payoutScheduleMonthDay: developers.payoutScheduleMonthDay,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!dev) {
      // Should be impossible after requireDeveloper, but defend
      // against a race between auth and DB read.
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    if (!dev.stripeConnectId) {
      return errorResponse(
        'No connected Stripe account. Complete onboarding first.',
        409,
        'NO_STRIPE_ACCOUNT',
      )
    }

    let result
    try {
      const client = getStripeClient() as unknown as StripePayoutClient
      result = await updatePayoutSchedule(client, dev.stripeConnectId, body)
    } catch (err) {
      if (err instanceof InvalidPayoutScheduleError) {
        return errorResponse(err.message, 400, 'INVALID_PAYOUT_SCHEDULE')
      }
      // Stripe-side error (network blip, rate-limit, account
      // restricted): log details but return a generic 502.
      logger.error('payout_schedule.stripe_error', { developerId: auth.id }, err)
      return errorResponse(
        'Could not update payout schedule with Stripe. Please try again.',
        502,
        'STRIPE_ERROR',
      )
    }

    // Persist the new schedule to the local cache so the dashboard
    // page can render without hitting Stripe on every load.
    await db
      .update(developers)
      .set({
        payoutSchedule: result.schedule.interval,
        payoutScheduleWeekday: result.schedule.weekly_anchor ?? null,
        payoutScheduleMonthDay: result.schedule.monthly_anchor ?? null,
        payoutScheduleSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(developers.id, auth.id))

    await writeAuditLog({
      developerId: auth.id,
      action: 'payout_schedule.update',
      resourceType: 'developer',
      resourceId: auth.id,
      details: {
        interval: result.schedule.interval,
        weekday: result.schedule.weekly_anchor ?? null,
        monthDay: result.schedule.monthly_anchor ?? null,
        applied: result.updated,
        reason: result.reason,
      },
    }).catch((err) => {
      logger.warn('audit_log.write_failed', { error: err instanceof Error ? err.message : String(err) })
    })

    return successResponse({
      interval: result.schedule.interval,
      weekday: result.schedule.weekly_anchor ?? null,
      monthDay: result.schedule.monthly_anchor ?? null,
      applied: result.updated,
    })
  } catch (err) {
    return internalErrorResponse(err)
  }
}
