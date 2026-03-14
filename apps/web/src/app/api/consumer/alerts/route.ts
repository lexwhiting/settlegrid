import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerAlerts, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const createAlertSchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
  alertType: z.enum(['low_balance', 'budget_exceeded', 'usage_spike']),
  threshold: z.number().int().min(1, 'Threshold must be at least 1'),
  channel: z.enum(['email', 'webhook']).default('email'),
})

/** GET /api/consumer/alerts — list consumer alerts */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-alerts:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const alerts = await db
      .select({
        id: consumerAlerts.id,
        toolId: consumerAlerts.toolId,
        toolName: tools.name,
        alertType: consumerAlerts.alertType,
        threshold: consumerAlerts.threshold,
        channel: consumerAlerts.channel,
        status: consumerAlerts.status,
        lastTriggeredAt: consumerAlerts.lastTriggeredAt,
        createdAt: consumerAlerts.createdAt,
      })
      .from(consumerAlerts)
      .innerJoin(tools, eq(consumerAlerts.toolId, tools.id))
      .where(eq(consumerAlerts.consumerId, auth.id))
      .limit(100)

    return successResponse({ alerts })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** POST /api/consumer/alerts — create a new alert */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-alerts:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, createAlertSchema)

    // Verify tool exists and is active
    const [tool] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.id, body.toolId), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Limit to 20 alerts per consumer
    const existing = await db
      .select({ id: consumerAlerts.id })
      .from(consumerAlerts)
      .where(eq(consumerAlerts.consumerId, auth.id))
      .limit(21)

    if (existing.length >= 20) {
      return errorResponse('Maximum of 20 alerts reached.', 400, 'ALERT_LIMIT_REACHED')
    }

    const [alert] = await db
      .insert(consumerAlerts)
      .values({
        consumerId: auth.id,
        toolId: body.toolId,
        alertType: body.alertType,
        threshold: body.threshold,
        channel: body.channel,
      })
      .returning({
        id: consumerAlerts.id,
        toolId: consumerAlerts.toolId,
        alertType: consumerAlerts.alertType,
        threshold: consumerAlerts.threshold,
        channel: consumerAlerts.channel,
        status: consumerAlerts.status,
        createdAt: consumerAlerts.createdAt,
      })

    return successResponse({ alert }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
