// GET /api/sessions/:id — Get session state

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { getSessionState } from '@/lib/settlement/sessions'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-get:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id } = await params

    if (!id) {
      return addCorsHeaders(errorResponse('Session ID required.', 400))
    }

    const session = await getSessionState(id)

    if (!session) {
      return addCorsHeaders(errorResponse('Session not found.', 404))
    }

    return addCorsHeaders(successResponse(session))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
