/**
 * GET /api/outcomes/[id] — Get outcome verification status
 */

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { getOutcomeVerification } from '@/lib/settlement/outcomes'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-get:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id } = await params
    const verification = await getOutcomeVerification(id)

    if (!verification) {
      return addCorsHeaders(errorResponse('Verification not found', 404, 'NOT_FOUND'))
    }

    return addCorsHeaders(NextResponse.json(verification))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
