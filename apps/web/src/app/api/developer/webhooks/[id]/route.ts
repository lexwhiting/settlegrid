import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** DELETE /api/developer/webhooks/[id] — remove a webhook endpoint */
export async function DELETE(
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

    const deleted = await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.developerId, auth.id)
        )
      )
      .returning({ id: webhookEndpoints.id })

    if (deleted.length === 0) {
      return errorResponse('Webhook endpoint not found.', 404, 'NOT_FOUND')
    }

    return successResponse({ deleted: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
