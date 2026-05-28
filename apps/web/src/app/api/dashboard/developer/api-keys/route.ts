import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developerApiKeys } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { generatePublisherApiKey } from '@/lib/crypto'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { publisherApiKeyCreatedEmail } from '@/lib/email'
import { sendNotificationEmail } from '@/lib/notifications'

// Known deferred hardening for this surface (rate-limit resilience/identifier,
// active-key-cap race, key hashing) is tracked in
// docs/tech-debt/publisher-api-keys-audit-2026-05-28.md — read before extending.
export const maxDuration = 60

// Cap on active (non-revoked) publisher keys per developer. Soft guard against
// unbounded key creation; revoked keys do not count toward the limit.
const MAX_ACTIVE_KEYS = 10

const createKeySchema = z.object({
  label: z.string().trim().max(100, 'Label must be 100 characters or fewer').optional(),
})

/**
 * GET /api/dashboard/developer/api-keys
 * Lists the authenticated developer's publisher API keys (hash never returned).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `dev-keys-list:${ip}`)
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

    const keys = await db
      .select({
        id: developerApiKeys.id,
        keyPrefix: developerApiKeys.keyPrefix,
        label: developerApiKeys.label,
        status: developerApiKeys.status,
        lastUsedAt: developerApiKeys.lastUsedAt,
        createdAt: developerApiKeys.createdAt,
        revokedAt: developerApiKeys.revokedAt,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.developerId, auth.id))
      .orderBy(desc(developerApiKeys.createdAt))
      .limit(500)

    return successResponse({ keys })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * POST /api/dashboard/developer/api-keys
 * Creates a new publisher API key. The plaintext key is returned ONCE.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `dev-keys-create:${ip}`)
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

    const body = await parseBody(request, createKeySchema)

    // Enforce the per-developer active-key cap.
    const activeKeys = await db
      .select({ id: developerApiKeys.id })
      .from(developerApiKeys)
      .where(and(eq(developerApiKeys.developerId, auth.id), eq(developerApiKeys.status, 'active')))
      .limit(MAX_ACTIVE_KEYS + 1)

    if (activeKeys.length >= MAX_ACTIVE_KEYS) {
      return errorResponse(
        `You have reached the maximum of ${MAX_ACTIVE_KEYS} active API keys. Revoke an existing key before creating a new one.`,
        422,
        'MAX_KEYS_EXCEEDED'
      )
    }

    const { key, hash, prefix } = generatePublisherApiKey()

    const [created] = await db
      .insert(developerApiKeys)
      .values({
        developerId: auth.id,
        keyHash: hash,
        keyPrefix: prefix,
        label: body.label ?? null,
      })
      .returning({
        id: developerApiKeys.id,
        keyPrefix: developerApiKeys.keyPrefix,
        label: developerApiKeys.label,
        status: developerApiKeys.status,
        createdAt: developerApiKeys.createdAt,
      })

    // Audit log — fire-and-forget
    writeAuditLog({
      developerId: auth.id,
      action: 'publisher_api_key.created',
      resourceType: 'publisher_api_key',
      resourceId: created.id,
      details: { keyPrefix: prefix, label: body.label ?? null },
      ipAddress: ip,
    }).catch(() => {})

    // Notification email — fire-and-forget, respects developer preferences
    try {
      const template = publisherApiKeyCreatedEmail(auth.email, prefix, {
        label: body.label,
        ip: ip !== 'unknown' ? ip : undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      })
      sendNotificationEmail({
        developerId: auth.id,
        eventKey: 'api_key_created',
        email: auth.email,
        subject: template.subject,
        html: template.html,
      }).catch(() => {})
    } catch {
      // Never let email generation crash the response
    }

    return successResponse(
      {
        key, // Full key returned ONCE — never stored in plaintext
        apiKey: {
          id: created.id,
          keyPrefix: created.keyPrefix,
          label: created.label,
          status: created.status,
          createdAt: created.createdAt,
        },
      },
      201
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
}
