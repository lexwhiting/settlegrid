// POST /api/sessions/:id/finalize -- Finalize session and trigger settlement

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { finalizeSession } from '@/lib/settlement/sessions'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-finalize:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id: sessionId } = await params

    if (!sessionId) {
      return addCorsHeaders(errorResponse('Session ID required.', 400))
    }

    const result = await finalizeSession(sessionId)

    return addCorsHeaders(successResponse(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return addCorsHeaders(errorResponse(error.message, 404, 'SESSION_NOT_FOUND'))
    }
    if (error instanceof Error && error.message.includes('cannot be finalized')) {
      return addCorsHeaders(errorResponse(error.message, 409, 'INVALID_STATUS'))
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
