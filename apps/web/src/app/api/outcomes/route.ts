/**
 * POST /api/outcomes — Create an outcome verification
 * GET  /api/outcomes — Not implemented (would need auth + filters)
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { createOutcomeVerification } from '@/lib/settlement/outcomes'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const createOutcomeSchema = z.object({
  invocationId: z.string().min(1),
  toolId: z.string().min(1),
  consumerId: z.string().min(1),
  outcomeType: z.enum(['boolean', 'score', 'custom']),
  successCriteria: z.object({
    outcomeType: z.enum(['boolean', 'score', 'custom']),
    minScore: z.number().optional(),
    maxLatencyMs: z.number().optional(),
    requiredFields: z.array(z.string()).optional(),
  }),
  fullPriceCents: z.number().int().min(0),
  failurePriceCents: z.number().int().min(0).optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-create:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, createOutcomeSchema)

    const result = await createOutcomeVerification({
      invocationId: body.invocationId,
      toolId: body.toolId,
      consumerId: body.consumerId,
      outcomeType: body.outcomeType,
      successCriteria: body.successCriteria,
      fullPriceCents: body.fullPriceCents,
      failurePriceCents: body.failurePriceCents,
    })

    return successResponse(result, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
