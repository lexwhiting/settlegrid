import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerSchedules } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { requireConsumer } from '@/lib/middleware/auth'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 15

interface RouteContext {
  params: Promise<{ id: string }>
}

// ── DELETE: Remove a schedule ───────────────────────────────────────────────

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-schedules-delete:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const consumer = await requireConsumer(request)
    const { id } = await ctx.params

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid schedule ID.', 400, 'INVALID_ID')
    }

    // Delete only if owned by this consumer
    const deleted = await db
      .delete(consumerSchedules)
      .where(
        and(
          eq(consumerSchedules.id, id),
          eq(consumerSchedules.consumerId, consumer.id)
        )
      )
      .returning({ id: consumerSchedules.id })

    if (deleted.length === 0) {
      return errorResponse('Schedule not found.', 404, 'NOT_FOUND')
    }

    logger.info('consumer_schedules.deleted', {
      scheduleId: id,
      consumerId: consumer.id,
    })

    return successResponse({ deleted: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return errorResponse(error.message, 401, 'UNAUTHORIZED')
    }
    logger.error('consumer_schedules.delete_error', {}, error)
    return internalErrorResponse(error)
  }
}

// ── PATCH: Toggle enabled/disabled ──────────────────────────────────────────

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-schedules-patch:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const consumer = await requireConsumer(request)
    const { id } = await ctx.params

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid schedule ID.', 400, 'INVALID_ID')
    }

    let body: { enabled?: boolean }
    try {
      body = await request.json() as { enabled?: boolean }
    } catch {
      return errorResponse('Request body must be valid JSON.', 400, 'INVALID_JSON')
    }

    if (typeof body.enabled !== 'boolean') {
      return errorResponse('enabled must be a boolean.', 400, 'INVALID_BODY')
    }

    const updated = await db
      .update(consumerSchedules)
      .set({ enabled: body.enabled })
      .where(
        and(
          eq(consumerSchedules.id, id),
          eq(consumerSchedules.consumerId, consumer.id)
        )
      )
      .returning()

    if (updated.length === 0) {
      return errorResponse('Schedule not found.', 404, 'NOT_FOUND')
    }

    logger.info('consumer_schedules.toggled', {
      scheduleId: id,
      consumerId: consumer.id,
      enabled: body.enabled,
    })

    return successResponse({ schedule: updated[0] })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return errorResponse(error.message, 401, 'UNAUTHORIZED')
    }
    logger.error('consumer_schedules.patch_error', {}, error)
    return internalErrorResponse(error)
  }
}
