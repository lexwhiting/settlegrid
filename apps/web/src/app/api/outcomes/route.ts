/**
 * POST /api/outcomes — Create an outcome verification
 * GET  /api/outcomes — List outcome verifications by toolId query param
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { createOutcomeVerification, getOutcomesByTool } from '@/lib/settlement/outcomes'
import { withCors, addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/outcomes?toolId=...&limit=... — list outcome verifications for a tool */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `outcomes-list:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const url = new URL(request.url)
    const toolId = url.searchParams.get('toolId')

    if (!toolId || !UUID_RE.test(toolId)) {
      return addCorsHeaders(errorResponse('toolId query parameter (valid UUID) is required.', 400, 'MISSING_TOOL_ID'))
    }

    const limitParam = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10), 1), 200)

    const result = await getOutcomesByTool(toolId, limitParam)

    return addCorsHeaders(successResponse(result))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}

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
