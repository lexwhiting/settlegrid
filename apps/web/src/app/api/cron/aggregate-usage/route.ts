import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { utcMonthStart, utcNextMonthStart, utcMonthKey } from '@/lib/utc-periods'

export const maxDuration = 60

/**
 * Vercel Cron handler for the monthly usage job. Both of its phases are off for now
 * (founder decisions 2026-11-22 and 2026-11-24), so it only reports the period:
 *
 * - Org cost allocations are paused. The earlier phase matched organization members
 *   (developer ids) against invocation consumer ids, added a duplicate row per member
 *   on every run and had no reader in the dashboard. Existing cost_allocations rows
 *   are left as they are; nothing is deleted.
 * - Plan-usage warning emails (80/90/100% of the monthly ops limit) are off until
 *   their delivery is reworked in a separate change. The earlier code never sent one:
 *   a JS Date inside a sql template threw for every developer under the production
 *   postgres-js driver.
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

    // The UTC calendar month, whatever the server's time zone
    const now = new Date()
    const periodStart = utcMonthStart(now)
    const periodEnd = utcNextMonthStart(now)
    const monthKey = utcMonthKey(now)

    const result = {
      period: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      month: monthKey,
      costAllocations: 'paused',
      usageAlerts: 'off',
      alertsSent: 0,
    }
    logger.info('cron.aggregate_usage.completed', result)
    return successResponse(result)
  } catch (error) {
    logger.error('cron.aggregate_usage.failed', {}, error)
    return internalErrorResponse(error)
  }
}
