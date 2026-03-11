import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { conversionEvents, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 15

const ALLOWED_EVENT_TYPES = [
  'signup',
  'first_purchase',
  'upgrade',
  'downgrade',
  'churn',
  'reactivation',
] as const

const createConversionEventSchema = z.object({
  eventType: z.enum(ALLOWED_EVENT_TYPES),
  fromTier: z.string().max(50).optional(),
  toTier: z.string().max(50).optional(),
  toolId: z.string().uuid('toolId must be a valid UUID').optional(),
  metadata: z.record(z.unknown()).optional(),
})

/** POST /api/consumer/conversion-events — emit a conversion event */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `conv-events:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const body = await parseBody(request, createConversionEventSchema)

    // If toolId provided, verify it exists
    if (body.toolId) {
      const [tool] = await db
        .select({ id: tools.id })
        .from(tools)
        .where(eq(tools.id, body.toolId))
        .limit(1)

      if (!tool) {
        return errorResponse('Tool not found.', 404, 'TOOL_NOT_FOUND', requestId)
      }
    }

    // toolId is required by the schema — use a provided toolId or return error
    if (!body.toolId) {
      return errorResponse('toolId is required for conversion events.', 422, 'TOOL_ID_REQUIRED', requestId)
    }

    const [event] = await db
      .insert(conversionEvents)
      .values({
        consumerId: auth.id,
        toolId: body.toolId,
        event: body.eventType,
        fromTier: body.fromTier ?? null,
        toTier: body.toTier ?? null,
        metadata: body.metadata ?? null,
      })
      .returning({
        id: conversionEvents.id,
        event: conversionEvents.event,
        fromTier: conversionEvents.fromTier,
        toTier: conversionEvents.toTier,
        toolId: conversionEvents.toolId,
        metadata: conversionEvents.metadata,
        createdAt: conversionEvents.createdAt,
      })

    return successResponse({ conversionEvent: event }, 201, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

/** GET /api/consumer/conversion-events — list consumer's conversion events with pagination */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `conv-events-list:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '20', 10), 1), 100)
    const offset = (page - 1) * limit

    const events = await db
      .select({
        id: conversionEvents.id,
        event: conversionEvents.event,
        fromTier: conversionEvents.fromTier,
        toTier: conversionEvents.toTier,
        toolId: conversionEvents.toolId,
        metadata: conversionEvents.metadata,
        createdAt: conversionEvents.createdAt,
      })
      .from(conversionEvents)
      .where(eq(conversionEvents.consumerId, auth.id))
      .orderBy(desc(conversionEvents.createdAt))
      .limit(limit)
      .offset(offset)

    return successResponse({ events, page, limit }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
