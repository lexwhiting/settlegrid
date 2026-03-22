import { NextRequest } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints, webhookDeliveries } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developer/webhooks/[id]/deliveries — list delivery history */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-webhooks:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid webhook endpoint ID.', 400, 'INVALID_ID')
    }

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Verify endpoint belongs to developer
    const [endpoint] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.developerId, auth.id)
        )
      )
      .limit(1)

    if (!endpoint) {
      return errorResponse('Webhook endpoint not found.', 404, 'NOT_FOUND')
    }

    const deliveries = await db
      .select({
        id: webhookDeliveries.id,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        httpStatus: webhookDeliveries.httpStatus,
        attempts: webhookDeliveries.attempts,
        maxAttempts: webhookDeliveries.maxAttempts,
        lastAttemptAt: webhookDeliveries.lastAttemptAt,
        deliveredAt: webhookDeliveries.deliveredAt,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(100)

    return successResponse({ deliveries })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
