import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { runGridBot } from '@/lib/gridbot'

export const maxDuration = 120

/**
 * GET /api/cron/gridbot
 *
 * Vercel Cron handler — runs GridBot every 6 hours to generate
 * marketplace demand across all 8 tool types.
 *
 * Auth: CRON_SECRET via Authorization header (set automatically by Vercel Cron).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyCronAuth(request.headers)
    if (auth !== 'ok') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.gridbot.start', { trigger: 'cron' })

    const result = await runGridBot({
      perTypeLimit: 2,
      budgetCents: Number(process.env.GRIDBOT_BUDGET_CENTS) || 200,
    })

    logger.info('cron.gridbot.complete', {
      totalSuccess: result.totalSuccess,
      totalErrors: result.totalErrors,
      totalSkipped: result.totalSkipped,
      totalCostCents: result.totalCostCents,
    })

    return successResponse({
      ok: true,
      summary: {
        success: result.totalSuccess,
        errors: result.totalErrors,
        skipped: result.totalSkipped,
        costCents: result.totalCostCents,
        toolTypes: result.toolTypesTargeted,
      },
    })
  } catch (error) {
    logger.error('cron.gridbot.error', {}, error)
    return errorResponse('GridBot cron failed', 500, 'CRON_ERROR')
  }
}
