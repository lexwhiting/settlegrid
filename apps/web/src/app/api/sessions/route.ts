// POST /api/sessions — Create a new workflow session
// GET /api/sessions — not implemented (would need auth)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { createSession } from '@/lib/settlement/sessions'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const createSessionSchema = z.object({
  customerId: z.string().min(1),
  budgetCents: z.number().int().min(1),
  expiresIn: z.number().int().min(1).max(86400).optional(), // max 24h
  protocol: z.enum(['mcp', 'x402', 'ap2', 'visa-tap']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-create:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, createSessionSchema)

    const session = await createSession({
      customerId: body.customerId,
      budgetCents: body.budgetCents,
      expiresIn: body.expiresIn,
      protocol: body.protocol,
      metadata: body.metadata,
    })

    return successResponse(session, 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be positive')) {
      return errorResponse(error.message, 400)
    }
    return internalErrorResponse(error)
  }
})
