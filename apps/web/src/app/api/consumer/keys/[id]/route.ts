import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `keys-revoke:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid key ID format.', 400, 'INVALID_ID')
    }

    // Verify key exists and belongs to consumer
    const [key] = await db
      .select({ id: apiKeys.id, status: apiKeys.status })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.consumerId, auth.id)))
      .limit(1)

    if (!key) {
      return errorResponse('API key not found.', 404, 'NOT_FOUND')
    }

    if (key.status === 'revoked') {
      return errorResponse('API key is already revoked.', 400, 'ALREADY_REVOKED')
    }

    await db
      .update(apiKeys)
      .set({ status: 'revoked' })
      .where(eq(apiKeys.id, id))

    return successResponse({ message: 'API key revoked successfully.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
