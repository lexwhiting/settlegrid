// GET /api/cron/expire-sessions -- Expire stale workflow sessions

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyCronAuth } from '@/lib/cron-auth'
import { expireStaleSessionsBatch } from '@/lib/settlement/sessions'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-expire-sessions:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const expired = await expireStaleSessionsBatch()

    return successResponse({ expired })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
