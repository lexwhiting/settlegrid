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
import { sendNotificationEmail } from '@/lib/notifications'
import { deliverOnce } from '@/lib/notification-delivery'
import { utcMonthStart, utcNextMonthStart, utcMonthKey } from '@/lib/utc-periods'
import { getEffectiveTier, getTierConfig, TIER_LIMITS } from '@/lib/tier-config'

export const maxDuration = 60


/**
 * Vercel Cron handler: checks each developer's ops this UTC month against their
 * tier limit and sends one warning email per level and month at 80%, 90% and 100%.
 * Org cost allocations are paused (see below).
 * Schedule: daily at 23:50 UTC (vercel.json), so each month's last day is checked
 * against that month.
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

    // Period: current month start to now
    const now = new Date()
    // The UTC calendar month, whatever the server's time zone
    const periodStart = utcMonthStart(now)
    const periodEnd = utcNextMonthStart(now)
    const monthKey = utcMonthKey(now)

    // Org cost allocations are paused (founder decision 2026-11-22). The earlier phase
    // matched organization members (developer ids) against invocation consumer ids,
    // added a duplicate row per member on every run and had no reader in the
    // dashboard. Existing cost_allocations rows are left as they are.

    // ─── Developer usage tier alerts ──────────────────────────────────
    // Ops this UTC month per developer, counted as the usage page counts them (every
    // invocation of the developer's tools). Timestamps go to SQL as ISO strings: the
    // postgres-js driver cannot serialize a JS Date inside a sql template.
    const usage = await db
      .select({ developerId: tools.developerId, opCount: sql<number>`count(*)::int` })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(
        gte(invocations.createdAt, sql`${periodStart.toISOString()}::timestamptz`),
        lt(invocations.createdAt, sql`${periodEnd.toISOString()}::timestamptz`),
      ))
      .groupBy(tools.developerId)

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

    let alertsSent = 0
    let failed = 0
    let skipped = 0
    const redis = getRedis()

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
          email = usageExceededEmail(devName, currentOps, limit, tier)
        } else if (level === '90') {
          email = usageWarning90Email(devName, currentOps, limit, tier)
        } else {
          email = usageWarning80Email(devName, currentOps, limit, tier)
        }

        // Once per level and month (lib/notification-delivery): recorded only when sent
        // or opted out, so a failed send is tried again tomorrow; overlapping runs and
        // a run killed mid-send can't send it twice.
        const result = await deliverOnce(redis, {
          key: `usage-alert:${dev.id}:${monthKey}:${level}`,
          recordTtlSecs: 31 * 24 * 60 * 60,
          send: (idempotencyKey) => sendNotificationEmail({
            developerId: dev.id,
            eventKey: 'usage_alert',
            email: dev.email,
            subject: email.subject,
            html: email.html,
            idempotencyKey,
          }),
        })

        if (result === 'delivered' || result === 'busy') continue
        if (result === 'failed') {
          failed++
          logger.warn('cron.aggregate_usage.send_failed', { developerId: dev.id, level })
          continue
        }
        if (result === 'opted_out') {
          skipped++ // the developer turned these off: recorded, not counted as sent
          continue
        }
        alertsSent++

        logger.info('cron.aggregate_usage.alert_sent', {
          developerId: dev.id,
          level,
          currentOps,
          limit,
          usagePct: Math.round(usagePct),
        })
      } catch (devErr) {
        // Don't let one developer failure stop the batch
        logger.error('cron.aggregate_usage.dev_alert_failed', { developerId: dev.id }, devErr)
      }
    }

    logger.info('cron.aggregate_usage.completed', {
      period: periodStart.toISOString(),
      developersWithUsage: usage.length,
      alertsSent,
      failed,
      skipped,
    })

    return successResponse({
      period: periodStart.toISOString(),
      developersWithUsage: usage.length,
      alertsSent,
      failed,
      skipped,
    })
  } catch (error) {
    logger.error('cron.aggregate_usage.failed', {}, error)
    return internalErrorResponse(error)
  }
}
