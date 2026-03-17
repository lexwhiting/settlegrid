// GET /api/agents/:id/facts — Get AgentFacts profile

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { generateAgentFactsProfile } from '@/lib/settlement/identity'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 10
export { corsOptions as OPTIONS }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `agent-facts:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id } = await params

    if (!id) {
      return addCorsHeaders(errorResponse('Agent ID required.', 400))
    }

    const profile = await generateAgentFactsProfile(id)

    if (!profile) {
      return addCorsHeaders(errorResponse('Agent not found.', 404))
    }

    return addCorsHeaders(successResponse(profile))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
