import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { apiKeyRevokedEmail, sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export const maxDuration = 60


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
      .select({ id: apiKeys.id, status: apiKeys.status, keyPrefix: apiKeys.keyPrefix, toolId: apiKeys.toolId })
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

    // Audit log: API key revoked
    writeAuditLog({
      consumerId: auth.id,
      action: 'api_key.revoked',
      resourceType: 'apiKey',
      resourceId: id,
      ipAddress: ip,
    }).catch(() => {})

    // Fire-and-forget API key revocation notification email
    db.select({ name: tools.name })
      .from(tools)
      .where(eq(tools.id, key.toolId))
      .limit(1)
      .then(([tool]) => {
        if (tool) {
          const toolName = tool.name ?? 'Unknown Tool'
          const template = apiKeyRevokedEmail(auth.email, key.keyPrefix, toolName)
          sendEmail({ to: auth.email, subject: template.subject, html: template.html }).catch((err) => {
            logger.error('keys.revoked_email_failed', { consumerId: auth.id }, err)
          })
        }
      })
      .catch(() => {})

    return successResponse({ message: 'API key revoked successfully.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
