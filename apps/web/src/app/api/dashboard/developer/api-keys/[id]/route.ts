import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developerApiKeys } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { publisherApiKeyRevokedEmail } from '@/lib/email'
import { sendNotificationEmail } from '@/lib/notifications'

export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/dashboard/developer/api-keys/[id]
 * Soft-revokes one of the authenticated developer's publisher API keys.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-keys-revoke:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-keys-revoke:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid key ID format.', 400, 'INVALID_ID')
    }

    // Verify the key exists and belongs to this developer (ownership-scoped).
    const [key] = await db
      .select({
        id: developerApiKeys.id,
        status: developerApiKeys.status,
        keyPrefix: developerApiKeys.keyPrefix,
        label: developerApiKeys.label,
      })
      .from(developerApiKeys)
      .where(and(eq(developerApiKeys.id, id), eq(developerApiKeys.developerId, auth.id)))
      .limit(1)

    if (!key) {
      return errorResponse('API key not found.', 404, 'NOT_FOUND')
    }

    if (key.status === 'revoked') {
      return errorResponse('API key is already revoked.', 400, 'ALREADY_REVOKED')
    }

    // Re-scope the UPDATE to the developer as defense-in-depth against IDOR.
    await db
      .update(developerApiKeys)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(and(eq(developerApiKeys.id, id), eq(developerApiKeys.developerId, auth.id)))

    // Audit log — fire-and-forget
    writeAuditLog({
      developerId: auth.id,
      action: 'publisher_api_key.revoked',
      resourceType: 'publisher_api_key',
      resourceId: id,
      details: { keyPrefix: key.keyPrefix, label: key.label },
      ipAddress: ip,
    }).catch(() => {})

    // Notification email — fire-and-forget. Revocation is a security signal.
    try {
      const template = publisherApiKeyRevokedEmail(auth.email, key.keyPrefix, {
        label: key.label ?? undefined,
      })
      sendNotificationEmail({
        developerId: auth.id,
        eventKey: 'api_key_revoked',
        email: auth.email,
        subject: template.subject,
        html: template.html,
        critical: true, // revocation is a security signal — always notify, bypass opt-out
      }).catch(() => {})
    } catch {
      // Never let email generation crash the response
    }

    return successResponse({ message: 'API key revoked successfully.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
