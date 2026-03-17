// GET /api/cron/expire-sessions -- Expire stale workflow sessions

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getCronSecret } from '@/lib/env'
import { expireStaleSessionsBatch } from '@/lib/settlement/sessions'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-expire-sessions:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const expired = await expireStaleSessionsBatch()

    return successResponse({ expired })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
