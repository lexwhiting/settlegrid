import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * Vercel Cron handler for the monthly developer summary email. Off for now (founder
 * decision 2026-11-24): its delivery is being reworked in a separate change, so the
 * job sends nothing and only reports that it is off.
 *
 * The earlier code never sent a summary: a JS Date inside a sql template threw for
 * every developer under the production postgres-js driver.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-monthly-summary:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.monthly_summary.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const result = { summaries: 'off', emailsSent: 0 }
    logger.info('cron.monthly_summary.completed', result)
    return successResponse(result)
  } catch (error) {
    logger.error('cron.monthly_summary.failed', {}, error)
    return internalErrorResponse(error)
  }
}
