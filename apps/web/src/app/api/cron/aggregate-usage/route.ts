import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { invocations, developers, tools } from '@/lib/db/schema'
import { sql, eq, and, gte, lt, inArray } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { usageWarning80Email, usageWarning90Email, usageExceededEmail } from '@/lib/email'
import { sendNotificationEmailResult } from '@/lib/notifications'
import { deliverOnce } from '@/lib/notification-delivery'
import { utcMonthStart, utcNextMonthStart, utcMonthKey } from '@/lib/utc-periods'
import { getEffectiveTier, getTierConfig, TIER_LIMITS } from '@/lib/tier-config'

export const maxDuration = 60

/**
 * After a UTC month ends, its warnings are still checked for this long, under that
 * month's keys: a level crossed after the month's last hourly run is sent (naming the
 * month), and a send left unresolved just before midnight is retried inside Resend's
 * 24 h window or, after it, recorded as ambiguous and logged (lib/notification-delivery).
 * Two days, so a missed run or two doesn't lose either.
 */
const CATCH_UP_MS = 48 * 60 * 60 * 1000

/** Delivery records outlive the longest month plus its catch-up, so nothing is sent twice. */
const RECORD_TTL_SECS = 40 * 24 * 60 * 60

/**
 * Vercel Cron handler: checks each developer's ops in a UTC month against their tier
 * limit and sends one warning email per level and month at 80%, 90% and 100%: the
 * current month, and for the first CATCH_UP_MS of a month the month before too.
 * Org cost allocations are paused (see below).
 * Schedule: hourly at :50 (vercel.json). A warning goes out within the hour of a
 * level being crossed, and a retry after a failed or cut-off send lands well inside
 * Resend's 24 h idempotency window (lib/notification-delivery).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-aggregate-usage:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.aggregate_usage.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // The UTC calendar month, whatever the server's time zone; and the month before
    // while it is still being caught up on
    const now = new Date()
    const periodStart = utcMonthStart(now)
    const months = [periodStart]
    if (now.getTime() - periodStart.getTime() < CATCH_UP_MS) {
      months.unshift(utcMonthStart(new Date(periodStart.getTime() - 1)))
    }

    // Org cost allocations are paused (founder decision 2026-11-22). The earlier phase
    // matched organization members (developer ids) against invocation consumer ids,
    // added a duplicate row per member on every run and had no reader in the
    // dashboard. Existing cost_allocations rows are left as they are.

    const totals = { developersWithUsage: 0, alertsSent: 0, failed: 0, skipped: 0 }
    const redis = getRedis()
    for (const monthStart of months) {
      await warnForMonth(monthStart, monthStart.getTime() !== periodStart.getTime(), redis, totals)
    }

    logger.info('cron.aggregate_usage.completed', {
      period: periodStart.toISOString(),
      ...(months.length > 1 ? { caughtUp: months[0].toISOString() } : {}),
      ...totals,
    })

    return successResponse({
      period: periodStart.toISOString(),
      ...(months.length > 1 ? { caughtUp: months[0].toISOString() } : {}),
      ...totals,
    })
  } catch (error) {
    logger.error('cron.aggregate_usage.failed', {}, error)
    return internalErrorResponse(error)
  }
}

/**
 * Warns each developer at the highest level they reached in the UTC month starting at
 * `monthStart`, once per level and month. `pastMonth` names the month in the email:
 * it is sent after the month ended (the catch-up).
 */
async function warnForMonth(
  monthStart: Date,
  pastMonth: boolean,
  redis: ReturnType<typeof getRedis>,
  totals: { developersWithUsage: number; alertsSent: number; failed: number; skipped: number },
) {
  const monthEnd = utcNextMonthStart(monthStart)
  const monthKey = utcMonthKey(monthStart)
  const monthName = pastMonth
    ? monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : undefined

  // Ops this month per developer, counted as the usage page counts them (every
  // invocation of the developer's tools). Timestamps go to SQL as ISO strings: the
  // postgres-js driver cannot serialize a JS Date inside a sql template.
  const usage = await db
    .select({ developerId: tools.developerId, opCount: sql<number>`count(*)::int` })
    .from(invocations)
    .innerJoin(tools, eq(invocations.toolId, tools.id))
    .where(and(
      gte(invocations.createdAt, sql`${monthStart.toISOString()}::timestamptz`),
      lt(invocations.createdAt, sql`${monthEnd.toISOString()}::timestamptz`),
    ))
    .groupBy(tools.developerId)
  if (!pastMonth) totals.developersWithUsage = usage.length

  // No tier warns below 80% of the smallest limit.
  const minLimit = Math.min(...Object.values(TIER_LIMITS).map((t) => t.opsPerMonth))
  const opsByDev = new Map(
    usage.filter((u) => u.opCount >= minLimit * 0.8).map((u) => [u.developerId, u.opCount])
  )
  const candidates = opsByDev.size === 0 ? [] : await db
    .select({
      id: developers.id,
      email: developers.email,
      name: developers.name,
      tier: developers.tier,
      isFoundingMember: developers.isFoundingMember,
    })
    .from(developers)
    .where(inArray(developers.id, [...opsByDev.keys()]))

  for (const dev of candidates) {
    try {
      // The tier the usage page shows (founding members get Scale)
      const tier = getEffectiveTier(dev.tier, dev.isFoundingMember)
      // Monthly ops limit (soft: tools keep working); legacy and academic tiers included
      const limit = getTierConfig(tier).opsPerMonth
      if (!Number.isFinite(limit)) continue // Enterprise has no cap

      const currentOps = opsByDev.get(dev.id) ?? 0
      const usagePct = (currentOps / limit) * 100
      const devName = dev.name ?? 'Developer'

      // Determine which threshold level to alert at
      let level: '80' | '90' | '100' | null = null
      if (usagePct >= 100) {
        level = '100'
      } else if (usagePct >= 90) {
        level = '90'
      } else if (usagePct >= 80) {
        level = '80'
      }

      if (!level) continue

      // Build and send the appropriate email
      let email: { subject: string; html: string }
      if (level === '100') {
        email = usageExceededEmail(devName, currentOps, limit, tier, monthName)
      } else if (level === '90') {
        email = usageWarning90Email(devName, currentOps, limit, tier, monthName)
      } else {
        email = usageWarning80Email(devName, currentOps, limit, tier, monthName)
      }

      // Once per level and month (lib/notification-delivery): recorded only when sent
      // or opted out, so a failed send is tried again next hour; overlapping runs and
      // a run killed mid-send can't send it twice.
      const result = await deliverOnce(redis, {
        key: `usage-alert:${dev.id}:${monthKey}:${level}`,
        recordTtlSecs: RECORD_TTL_SECS,
        recipient: dev.email,
        render: () => ({ to: dev.email, ...email }),
        send: (payload, idempotencyKey) => sendNotificationEmailResult({
          developerId: dev.id,
          eventKey: 'usage_alert',
          email: payload.to,
          subject: payload.subject,
          html: payload.html,
          idempotencyKey,
        }),
      })

      if (result === 'delivered' || result === 'busy') continue
      if (result === 'ambiguous') {
        // An earlier attempt's outcome is unknown and Resend's 24 h window has passed:
        // not resent (recorded); reconcile by hand
        totals.failed++
        logger.error('cron.aggregate_usage.delivery_ambiguous', { developerId: dev.id, month: monthKey, level })
        continue
      }
      if (result === 'failed') {
        totals.failed++
        logger.warn('cron.aggregate_usage.send_failed', { developerId: dev.id, month: monthKey, level })
        continue
      }
      if (result === 'opted_out') {
        totals.skipped++ // the developer turned these off: recorded, not counted as sent
        continue
      }
      totals.alertsSent++

      logger.info('cron.aggregate_usage.alert_sent', {
        developerId: dev.id,
        month: monthKey,
        level,
        currentOps,
        limit,
        usagePct: Math.round(usagePct),
      })
    } catch (devErr) {
      // Don't let one developer failure stop the batch; the next run retries it
      totals.failed++
      logger.error('cron.aggregate_usage.dev_alert_failed', { developerId: dev.id, month: monthKey }, devErr)
    }
  }
}
