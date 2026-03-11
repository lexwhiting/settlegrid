import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { attemptWebhookDelivery } from '@/lib/webhooks'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/developer/webhooks/[id]/test — send a test ping to the webhook */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-webhook-test:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid webhook endpoint ID.', 400, 'INVALID_ID')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Authentication required',
        401,
        'UNAUTHORIZED'
      )
    }

    // Look up the endpoint (must belong to the authenticated developer)
    const [endpoint] = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        status: webhookEndpoints.status,
      })
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

    if (endpoint.status !== 'active') {
      return errorResponse('Webhook endpoint is not active.', 400, 'ENDPOINT_INACTIVE')
    }

    // Send test payload
    const testPayload = {
      message: 'Test webhook from SettleGrid',
      timestamp: new Date().toISOString(),
    }

    const result = await attemptWebhookDelivery(
      endpoint.url,
      endpoint.secret,
      'test.ping',
      { ...testPayload, test: true }
    )

    return successResponse({
      success: result.status === 'delivered',
      httpStatus: result.httpStatus,
      event: 'test.ping',
      payload: { event: 'test.ping', data: testPayload, test: true },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
