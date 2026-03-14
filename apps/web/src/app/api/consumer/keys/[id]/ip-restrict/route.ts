import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { isValidIpOrCidr } from '@/lib/ip-validation'

export const maxDuration = 60


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ipRestrictSchema = z.object({
  ipAllowlist: z.array(z.string().min(7).max(45)).max(20),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `ip-restrict:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid key ID format.', 400, 'INVALID_ID')
    }

    const body = await parseBody(request, ipRestrictSchema)

    // Validate each IP/CIDR entry
    const invalidEntries = body.ipAllowlist.filter(entry => !isValidIpOrCidr(entry))
    if (invalidEntries.length > 0) {
      return errorResponse(
        `Invalid IP/CIDR entries: ${invalidEntries.join(', ')}`,
        400,
        'INVALID_IP_FORMAT'
      )
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

    if (key.status !== 'active') {
      return errorResponse('Cannot modify a revoked API key.', 400, 'KEY_NOT_ACTIVE')
    }

    const [updated] = await db
      .update(apiKeys)
      .set({ ipAllowlist: body.ipAllowlist })
      .where(eq(apiKeys.id, id))
      .returning({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        toolId: apiKeys.toolId,
        status: apiKeys.status,
        ipAllowlist: apiKeys.ipAllowlist,
      })

    return successResponse({ apiKey: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `ip-restrict-clear:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer()
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

    if (key.status !== 'active') {
      return errorResponse('Cannot modify a revoked API key.', 400, 'KEY_NOT_ACTIVE')
    }

    const [updated] = await db
      .update(apiKeys)
      .set({ ipAllowlist: null })
      .where(eq(apiKeys.id, id))
      .returning({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        toolId: apiKeys.toolId,
        status: apiKeys.status,
        ipAllowlist: apiKeys.ipAllowlist,
      })

    return successResponse({ apiKey: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
