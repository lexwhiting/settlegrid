/**
 * POST /api/outcomes/[id]/dispute — Open a dispute on an outcome verification
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { openDispute } from '@/lib/settlement/outcomes'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const disputeSchema = z.object({
  reason: z.string().min(1).max(1000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-dispute:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id } = await params
    const body = await parseBody(request, disputeSchema)

    await openDispute(id, body.reason)

    return addCorsHeaders(successResponse({ status: 'dispute_opened', verificationId: id }))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Verification not found') {
        return addCorsHeaders(errorResponse(error.message, 404, 'NOT_FOUND'))
      }
      if (error.message === 'Dispute deadline has passed') {
        return addCorsHeaders(errorResponse(error.message, 410, 'DEADLINE_PASSED'))
      }
      if (error.message === 'Cannot dispute an unverified outcome') {
        return addCorsHeaders(errorResponse(error.message, 400, 'NOT_VERIFIED'))
      }
      if (error.message === 'Dispute already exists') {
        return addCorsHeaders(errorResponse(error.message, 409, 'DISPUTE_EXISTS'))
      }
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
