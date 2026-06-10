/**
 * P3.K4 — B1.4: pending-settlement reconciler cron.
 *
 * Recovers settlement rows stuck 'pending' (broadcast-but-unconfirmed, timeouts,
 * or settles broadcast during a gas outage) by re-confirming the broadcast tx
 * on-chain and flipping the row to settled/failed — the same funds-safety
 * mapping the live settle path uses. Covers circle-nano + x402. Bounded per run;
 * scheduled every 15 min in apps/web/vercel.json.
 */
import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { reconcilePendingSettlements } from '@/lib/settlement/reconcile'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-settlement-reconcile:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.settlement_reconcile.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const summary = await reconcilePendingSettlements()
    logger.info('cron.settlement_reconcile.done', {
      scanned: summary.scanned,
      settled: summary.settled,
      failed: summary.failed,
      pending: summary.pending,
      skipped: summary.skipped,
      // (S) truthful telemetry: raced no-op flips, examination errors, and
      // the pending-age alert count (null = the overdue check failed).
      noop: summary.noop,
      errored: summary.errored,
      overdue: summary.overdue,
    })
    return successResponse(summary)
  } catch (error) {
    logger.error('cron.settlement_reconcile.error', {}, error)
    return internalErrorResponse(error)
  }
}
