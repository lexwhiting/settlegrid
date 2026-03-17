// GET /api/settlements/:id -- Get settlement batch status

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { getSettlementBatch } from '@/lib/settlement/sessions'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `settlement-get:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id: batchId } = await params

    if (!batchId) {
      return addCorsHeaders(errorResponse('Settlement batch ID required.', 400))
    }

    const batch = await getSettlementBatch(batchId)

    if (!batch) {
      return addCorsHeaders(errorResponse('Settlement batch not found.', 404, 'BATCH_NOT_FOUND'))
    }

    return addCorsHeaders(successResponse(batch))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
