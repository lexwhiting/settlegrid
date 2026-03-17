// POST /api/sessions/:id/delegate — Delegate budget to a child session

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { createSession } from '@/lib/settlement/sessions'
import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const delegateSchema = z.object({
  budgetCents: z.number().int().min(1),
  agentId: z.string().uuid().optional(),
  expiresIn: z.number().int().min(1).max(86400).optional(), // max 24h
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `session-delegate:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const { id: parentSessionId } = await params
    const body = await parseBody(request, delegateSchema)

    // Get parent session to determine customerId
    const [parent] = await db
      .select({ customerId: workflowSessions.customerId })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, parentSessionId))
      .limit(1)

    if (!parent) {
      return addCorsHeaders(errorResponse('Parent session not found.', 404))
    }

    const childSession = await createSession({
      customerId: parent.customerId,
      budgetCents: body.budgetCents,
      expiresIn: body.expiresIn,
      parentSessionId,
      metadata: {
        ...body.metadata,
        agentId: body.agentId,
        delegatedFrom: parentSessionId,
      },
    })

    return addCorsHeaders(successResponse(childSession, 201))
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('exceeds') ||
      error.message.includes('not active') ||
      error.message.includes('cannot expire')
    )) {
      return addCorsHeaders(errorResponse(error.message, 400))
    }
    return addCorsHeaders(internalErrorResponse(error))
  }
}
