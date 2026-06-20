import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { runInvocationsPayerMinimization } from '@/lib/settlement/invocations-payer-min'

export const maxDuration = 300 // 5 minutes — may process many protocol-invocation rows

/**
 * V-N3-invocations-min — daily invocations.metadata EVM-payer minimization cron
 * (DARK by default).
 *
 * Surgically removes the raw EVM on-chain payer SettleGrid captured (x402 /
 * circle-nano / drain) from the protocol-sentinel `invocations.metadata` rows —
 * the SECOND DC-16 census surface. The address stays permanently public on-chain,
 * so this is MINIMIZATION, not erasure. Mirrors the ledger payer-anonymize cron's
 * harness (rate-limit → verifyCronAuth → batched, idempotent). Guarded by
 * INVOCATIONS_PAYER_MINIMIZE_ENABLED: while OFF this returns a 200 no-op
 * { minimized: 0, enabled: false } and touches NO row.
 *
 * NOT wired in vercel.json — the route ships dark; the schedule is added only when
 * the enable-runbook flips the flag + runs the backfill (handoff §11).
 *
 * Schedule (once enabled): daily.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-invocations-payer-min:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured).
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.invocations_payer_min.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      logger.error('cron.invocations_payer_min.unauthorized', { ip })
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const result = await runInvocationsPayerMinimization({ label: 'cron' })

    logger.info('cron.invocations_payer_min.done', { ...result })
    return successResponse({
      message: result.enabled
        ? 'Invocations payer minimization completed'
        : 'Invocations payer minimization is disabled (INVOCATIONS_PAYER_MINIMIZE_ENABLED off)',
      ...result,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
