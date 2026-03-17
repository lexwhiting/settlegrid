// POST /api/sessions/:id/hop -- Record a service call within a session

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { recordHop } from '@/lib/settlement/sessions'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

const hopSchema = z.object({
  serviceId: z.string().min(1).max(256),
  toolId: z.string().uuid(),
  method: z.string().min(1).max(128),
  costCents: z.number().int().min(0).max(1_000_000),
  latencyMs: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-hop:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id: sessionId } = await params
    const body = await parseBody(request, hopSchema)

    const result = await recordHop(sessionId, body)

    return addCorsHeaders(successResponse(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient session budget')) {
      return addCorsHeaders(errorResponse(error.message, 402, 'BUDGET_EXCEEDED'))
    }
    if (error instanceof Error && error.message.includes('not found or not active')) {
      return addCorsHeaders(errorResponse(error.message, 404, 'SESSION_NOT_FOUND'))
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
