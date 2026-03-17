/**
 * POST /api/outcomes/[id]/verify — Submit actual outcome for evaluation
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { verifyOutcome } from '@/lib/settlement/outcomes'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const verifySchema = z.object({
  actualOutcome: z.unknown(),
  latencyMs: z.number().int().min(0).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-verify:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id } = await params
    const body = await parseBody(request, verifySchema)

    const result = await verifyOutcome(id, body.actualOutcome, body.latencyMs)

    return addCorsHeaders(successResponse(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Verification not found') {
        return addCorsHeaders(errorResponse(error.message, 404, 'NOT_FOUND'))
      }
      if (error.message === 'Verification already completed') {
        return addCorsHeaders(errorResponse(error.message, 409, 'ALREADY_VERIFIED'))
      }
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
