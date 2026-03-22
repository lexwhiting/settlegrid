import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

// Valid notification event keys — must match the client-side DEFAULT_NOTIFICATIONS list
const VALID_EVENT_KEYS = [
  'payout_completed',
  'payout_failed',
  'balance_low',
  'invoice_generated',
  'tool_published',
  'tool_status_changed',
  'tool_health_down',
  'usage_spike',
  'login_new_device',
  'password_changed',
  'api_key_created',
  'suspicious_activity',
  'webhook_delivery_failed',
  'webhook_endpoint_disabled',
] as const

const notificationPreferencesSchema = z.record(
  z.enum(VALID_EVENT_KEYS),
  z.boolean()
)

/** GET /api/dashboard/developer/notification-preferences — retrieve preferences */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-notif-prefs-get:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const [developer] = await db
      .select({ notificationPreferences: developers.notificationPreferences })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({
      preferences: developer.notificationPreferences ?? {},
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** PATCH /api/dashboard/developer/notification-preferences — update preferences */
export async function PATCH(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-notif-prefs-patch:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, notificationPreferencesSchema)

    // Merge with existing preferences
    const [existing] = await db
      .select({ notificationPreferences: developers.notificationPreferences })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    const current = (existing?.notificationPreferences ?? {}) as Record<string, boolean>
    const merged = { ...current, ...body }

    const [updated] = await db
      .update(developers)
      .set({
        notificationPreferences: merged,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, auth.id))
      .returning({
        notificationPreferences: developers.notificationPreferences,
      })

    if (!updated) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({
      preferences: updated.notificationPreferences,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
