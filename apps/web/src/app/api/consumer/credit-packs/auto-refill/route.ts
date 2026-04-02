import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const maxDuration = 15

const VALID_PACK_IDS = ['pack_20', 'pack_100', 'pack_500', 'pack_1000'] as const

/** Minimum trigger balance to prevent abuse: 100 cents ($1) */
const MIN_TRIGGER_CENTS = 100

/** Maximum trigger balance to prevent runaway charges: $500 */
const MAX_TRIGGER_CENTS = 50000

const autoRefillSchema = z.object({
  packId: z.enum(VALID_PACK_IDS).nullable(),
  triggerBalanceCents: z.number().int().min(MIN_TRIGGER_CENTS).max(MAX_TRIGGER_CENTS).nullable(),
})

/**
 * GET /api/consumer/credit-packs/auto-refill — returns current auto-refill settings.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-auto-refill:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const [consumer] = await db
      .select({
        autoRefillPackId: consumers.autoRefillPackId,
        autoRefillTriggerCents: consumers.autoRefillTriggerCents,
      })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    if (!consumer) {
      return errorResponse('Consumer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({
      enabled: consumer.autoRefillPackId !== null && consumer.autoRefillTriggerCents !== null,
      packId: consumer.autoRefillPackId,
      triggerBalanceCents: consumer.autoRefillTriggerCents,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * POST /api/consumer/credit-packs/auto-refill — configure auto-refill settings.
 * Pass { packId: null, triggerBalanceCents: null } to disable.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-auto-refill-set:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    let parsed: z.infer<typeof autoRefillSchema>
    try {
      parsed = await parseBody(request, autoRefillSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
    }

    const { packId, triggerBalanceCents } = parsed

    // Both must be null (disable) or both must be set (enable)
    if ((packId === null) !== (triggerBalanceCents === null)) {
      return errorResponse(
        'Both packId and triggerBalanceCents must be set or both must be null to disable.',
        400,
        'VALIDATION_ERROR',
      )
    }

    // Prevent infinite auto-refill loops: trigger must be less than the pack credit amount.
    // If trigger >= pack value, buying a pack wouldn't raise balance above trigger.
    if (packId !== null && triggerBalanceCents !== null) {
      const PACK_CREDIT_AMOUNTS: Record<string, number> = {
        pack_20: 2000,
        pack_100: 10000,
        pack_500: 50000,
        pack_1000: 100000,
      }
      const packCredit = PACK_CREDIT_AMOUNTS[packId]
      if (packCredit !== undefined && triggerBalanceCents >= packCredit) {
        return errorResponse(
          `Trigger balance ($${(triggerBalanceCents / 100).toFixed(2)}) must be less than the pack credit amount ($${(packCredit / 100).toFixed(2)}) to prevent repeat charges.`,
          400,
          'TRIGGER_TOO_HIGH',
        )
      }
    }

    await db
      .update(consumers)
      .set({
        autoRefillPackId: packId,
        autoRefillTriggerCents: triggerBalanceCents,
      })
      .where(eq(consumers.id, auth.id))

    logger.info('consumer.auto_refill.configured', {
      consumerId: auth.id,
      packId,
      triggerBalanceCents,
    })

    return successResponse({
      enabled: packId !== null,
      packId,
      triggerBalanceCents,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
