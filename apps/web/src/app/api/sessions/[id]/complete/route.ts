// POST /api/sessions/:id/complete — Complete a session

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { completeSession } from '@/lib/settlement/sessions'
import { addCorsHeaders } from '@/lib/middleware/cors'

export const maxDuration = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-complete:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id: sessionId } = await params

    if (!sessionId) {
      return addCorsHeaders(errorResponse('Session ID required.', 400))
    }

    await completeSession(sessionId)

    return addCorsHeaders(successResponse({ status: 'completed', sessionId }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return addCorsHeaders(errorResponse(error.message, 404))
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
