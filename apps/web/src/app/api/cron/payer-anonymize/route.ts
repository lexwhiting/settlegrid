import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { runPayerAnonymization } from '@/lib/settlement/anonymize-payer'

export const maxDuration = 300 // 5 minutes — may process many aged settlement rows

/**
 * V-N3 — daily ledger payer-PII minimization cron (DARK by default).
 *
 * Anonymizes TERMINAL, credit-resolved, aged x402/circle-nano settlement rows
 * that have crossed the floored retention window: rewrites operation_id to drop
 * the raw EVM payer+nonce and surgically nulls metadata.payer (the address stays
 * permanently public on-chain via external_ref — this is MINIMIZATION, not
 * erasure). Mirrors the data-retention cron's harness (rate-limit → verifyCronAuth
 * → batched, idempotent). Guarded by LEDGER_PAYER_ANONYMIZE_ENABLED: while OFF
 * this returns a 200 no-op { anonymized: 0, enabled: false } and touches NO row.
 *
 * NOT wired in vercel.json — the route ships dark; the schedule is added only
 * after counsel flips the flag (handoff §5b/§7).
 *
 * Schedule (once enabled): daily.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-payer-anonymize:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured).
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.payer_anonymize.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      logger.error('cron.payer_anonymize.unauthorized', { ip })
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const result = await runPayerAnonymization({ label: 'cron' })

    logger.info('cron.payer_anonymize.done', { ...result })
    return successResponse({
      message: result.enabled
        ? 'Payer-PII minimization completed'
        : 'Payer-PII minimization is disabled (LEDGER_PAYER_ANONYMIZE_ENABLED off)',
      ...result,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
