import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params

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
