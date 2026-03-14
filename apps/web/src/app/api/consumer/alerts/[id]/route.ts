import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerAlerts } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const updateAlertSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  threshold: z.number().int().min(1).optional(),
  channel: z.enum(['email', 'webhook']).optional(),
})

/** PATCH /api/consumer/alerts/[id] — update an alert */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-alerts:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid alert ID.', 400, 'INVALID_ID')
    }

    const body = await parseBody(request, updateAlertSchema)

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.threshold !== undefined) updateData.threshold = body.threshold
    if (body.channel !== undefined) updateData.channel = body.channel

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields to update.', 400, 'NO_UPDATES')
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: consumerAlerts.id })
      .from(consumerAlerts)
      .where(and(eq(consumerAlerts.id, id), eq(consumerAlerts.consumerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Alert not found.', 404, 'NOT_FOUND')
    }

    const [updated] = await db
      .update(consumerAlerts)
      .set(updateData)
      .where(eq(consumerAlerts.id, id))
      .returning({
        id: consumerAlerts.id,
        toolId: consumerAlerts.toolId,
        alertType: consumerAlerts.alertType,
        threshold: consumerAlerts.threshold,
        channel: consumerAlerts.channel,
        status: consumerAlerts.status,
        lastTriggeredAt: consumerAlerts.lastTriggeredAt,
      })

    return successResponse({ alert: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** DELETE /api/consumer/alerts/[id] — delete an alert */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-alerts:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid alert ID.', 400, 'INVALID_ID')
    }

    const [existing] = await db
      .select({ id: consumerAlerts.id })
      .from(consumerAlerts)
      .where(and(eq(consumerAlerts.id, id), eq(consumerAlerts.consumerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Alert not found.', 404, 'NOT_FOUND')
    }

    await db
      .delete(consumerAlerts)
      .where(eq(consumerAlerts.id, id))

    return successResponse({ deleted: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
