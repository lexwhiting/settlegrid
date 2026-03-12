import { NextRequest } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerAlerts, consumerToolBalances, consumers, tools, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { sendAlertEmail } from '@/lib/alert-email'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour cooldown

/**
 * Vercel Cron handler: checks all active consumer alerts and fires them when conditions are met.
 * Alert types:
 *   - low_balance: balanceCents < threshold
 *   - budget_exceeded: currentPeriodSpendCents >= spendingLimitCents
 *   - usage_spike: last-hour invocations > 2x the 7-day hourly average
 * Cooldown: 1 hour per alert to prevent spam.
 * Schedule: every 5 minutes.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-alert-check:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS)

    // Fetch all active alerts where cooldown has elapsed
    const activeAlerts = await db
      .select({
        id: consumerAlerts.id,
        consumerId: consumerAlerts.consumerId,
        toolId: consumerAlerts.toolId,
        alertType: consumerAlerts.alertType,
        threshold: consumerAlerts.threshold,
        channel: consumerAlerts.channel,
        lastTriggeredAt: consumerAlerts.lastTriggeredAt,
        consumerEmail: consumers.email,
        toolName: tools.name,
      })
      .from(consumerAlerts)
      .innerJoin(consumers, eq(consumerAlerts.consumerId, consumers.id))
      .innerJoin(tools, eq(consumerAlerts.toolId, tools.id))
      .where(
        and(
          eq(consumerAlerts.status, 'active'),
          sql`(${consumerAlerts.lastTriggeredAt} IS NULL OR ${consumerAlerts.lastTriggeredAt} <= ${cooldownCutoff})`
        )
      )
      .limit(200)

    if (activeAlerts.length === 0) {
      return successResponse({ checked: 0, fired: 0 })
    }

    let fired = 0

    for (const alert of activeAlerts) {
      let shouldFire = false

      if (alert.alertType === 'low_balance') {
        // Check balance for this consumer+tool
        const [balance] = await db
          .select({ balanceCents: consumerToolBalances.balanceCents })
          .from(consumerToolBalances)
          .where(
            and(
              eq(consumerToolBalances.consumerId, alert.consumerId),
              eq(consumerToolBalances.toolId, alert.toolId)
            )
          )
          .limit(1)

        if (balance && balance.balanceCents < alert.threshold) {
          shouldFire = true
        }
      } else if (alert.alertType === 'budget_exceeded') {
        // Check if current period spend >= spending limit
        const [balance] = await db
          .select({
            currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
            spendingLimitCents: consumerToolBalances.spendingLimitCents,
          })
          .from(consumerToolBalances)
          .where(
            and(
              eq(consumerToolBalances.consumerId, alert.consumerId),
              eq(consumerToolBalances.toolId, alert.toolId)
            )
          )
          .limit(1)

        if (
          balance &&
          balance.spendingLimitCents !== null &&
          balance.currentPeriodSpendCents >= balance.spendingLimitCents
        ) {
          shouldFire = true
        }
      } else if (alert.alertType === 'usage_spike') {
        // Count invocations in the last hour
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [lastHourCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(invocations)
          .where(
            and(
              eq(invocations.consumerId, alert.consumerId),
              eq(invocations.toolId, alert.toolId),
              sql`${invocations.createdAt} >= ${oneHourAgo}`
            )
          )

        const [weeklyCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(invocations)
          .where(
            and(
              eq(invocations.consumerId, alert.consumerId),
              eq(invocations.toolId, alert.toolId),
              sql`${invocations.createdAt} >= ${sevenDaysAgo}`
            )
          )

        const lastHour = lastHourCount?.count ?? 0
        // 7 days = 168 hours, so hourly average = total / 168
        const hourlyAvg = (weeklyCount?.count ?? 0) / 168

        // Spike if last hour > 2x average (and at least some activity)
        if (hourlyAvg > 0 && lastHour > 2 * hourlyAvg) {
          shouldFire = true
        }
      }

      if (shouldFire) {
        // Send alert
        if (alert.channel === 'email') {
          await sendAlertEmail(
            alert.consumerEmail,
            alert.toolName,
            alert.alertType,
            alert.threshold
          )
        }

        // Update lastTriggeredAt
        await db
          .update(consumerAlerts)
          .set({ lastTriggeredAt: now })
          .where(eq(consumerAlerts.id, alert.id))

        fired++
      }
    }

    logger.info('cron.alert_check.completed', {
      checked: activeAlerts.length,
      fired,
    })

    return successResponse({ checked: activeAlerts.length, fired })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
