import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { runPayerAnonymization } from '@/lib/settlement/anonymize-payer'

export const maxDuration = 300 // 5 minutes — one-time sweep of the existing backlog

/**
 * V-N3 — one-time ledger payer-PII minimization BACKFILL (DARK by default).
 *
 * POST /api/admin/payer-anonymize-backfill
 *
 * Sweeps the EXISTING backlog of eligible rows using the SAME transform +
 * predicate as the daily cron (one shared `runPayerAnonymization`) — including
 * the same floored age filter, so it can NEVER anonymize a still-replayable row
 * (handoff F2). Re-runnable: each invocation restarts at the oldest still-eligible
 * row and drains within a wall-clock budget; `completed:false` ⇒ re-POST to
 * continue. Returns a manifest (counts + batch progress).
 *
 * It is an ADMIN ROUTE, never a script (handoff F3): the irreversible transform
 * is guarded by HTTP verifyCronAuth (CRON_SECRET, fail-closed) + the deployed-env
 * LEDGER_PAYER_ANONYMIZE_ENABLED flag — flipping that flag IS the counsel-gated
 * act. While the flag is OFF this returns a 200 no-op { anonymized: 0,
 * enabled: false } and touches NO row. A per-shell env var cannot defeat it.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `admin-payer-anonymize-backfill:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured).
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('admin.payer_anonymize_backfill.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      logger.error('admin.payer_anonymize_backfill.unauthorized', { ip })
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const result = await runPayerAnonymization({ label: 'backfill' })

    logger.info('admin.payer_anonymize_backfill.done', { ...result })
    return successResponse({
      message: result.enabled
        ? `Payer-PII backfill ${result.completed ? 'completed' : 'made progress (re-POST to continue)'}`
        : 'Payer-PII minimization is disabled (LEDGER_PAYER_ANONYMIZE_ENABLED off)',
      ...result,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
