/**
 * GET /api/outcomes/[id] — Get outcome verification status
 */

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { getOutcomeVerification } from '@/lib/settlement/outcomes'

export const maxDuration = 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-get:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    const verification = await getOutcomeVerification(id)

    if (!verification) {
      return errorResponse('Verification not found', 404, 'NOT_FOUND')
    }

    return NextResponse.json(verification)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
