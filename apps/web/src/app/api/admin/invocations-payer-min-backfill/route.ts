import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { runInvocationsPayerMinimization } from '@/lib/settlement/invocations-payer-min'

export const maxDuration = 300 // 5 minutes — one-time sweep of the existing backlog

/**
 * V-N3-invocations-min — one-time invocations.metadata EVM-payer minimization
 * BACKFILL (DARK by default).
 *
 * POST /api/admin/invocations-payer-min-backfill
 *
 * Sweeps the EXISTING backlog of protocol-sentinel rows that still carry the raw
 * EVM payer in `invocations.metadata`, using the SAME transform + predicate as the
 * daily cron (one shared `runInvocationsPayerMinimization`). Re-runnable: each
 * invocation restarts at the oldest still-candidate row and drains within a
 * wall-clock budget; `completed:false` ⇒ re-POST to continue. Returns a manifest
 * (counts + batch progress).
 *
 * It is an ADMIN ROUTE, never a script: the jsonb rewrite is guarded by HTTP
 * verifyCronAuth (CRON_SECRET, fail-closed) + the deployed-env
 * INVOCATIONS_PAYER_MINIMIZE_ENABLED flag — flipping that flag IS the counsel-gated
 * act (handoff §11). While the flag is OFF this returns a 200 no-op
 * { minimized: 0, enabled: false } and touches NO row. A per-shell env var cannot
 * defeat the deployed-flag gate.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `admin-invocations-payer-min-backfill:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured).
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('admin.invocations_payer_min_backfill.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      logger.error('admin.invocations_payer_min_backfill.unauthorized', { ip })
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const result = await runInvocationsPayerMinimization({ label: 'backfill' })

    logger.info('admin.invocations_payer_min_backfill.done', { ...result })
    return successResponse({
      message: result.enabled
        ? `Invocations payer backfill ${result.completed ? 'completed' : 'made progress (re-POST to continue)'}`
        : 'Invocations payer minimization is disabled (INVOCATIONS_PAYER_MINIMIZE_ENABLED off)',
      ...result,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
