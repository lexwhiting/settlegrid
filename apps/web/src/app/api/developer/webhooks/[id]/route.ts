import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints, developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60

const MAX_CUSTOM_HEADERS = 10
const MAX_HEADER_VALUE_LEN = 2048

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const customHeadersSchema = z.object({
  customHeaders: z.record(
    z.string().min(1).max(128),
    z.string().max(MAX_HEADER_VALUE_LEN)
  ).nullable(),
}).strict()

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

    // Audit log: webhook deleted
    writeAuditLog({
      developerId: auth.id,
      action: 'webhook.deleted',
      resourceType: 'webhook',
      resourceId: id,
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ deleted: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** PATCH /api/developer/webhooks/[id] — update custom headers (Scale+) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-webhooks-patch:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid webhook endpoint ID.', 400, 'INVALID_ID')
    }

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: custom_webhook_headers requires Scale+ ──────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'custom_webhook_headers', developer.isFoundingMember)) {
      return errorResponse(
        'Custom webhook headers require the Scale plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'scale', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    const body = await parseBody(request, customHeadersSchema)

    // Validate header count
    if (body.customHeaders && Object.keys(body.customHeaders).length > MAX_CUSTOM_HEADERS) {
      return errorResponse(
        `Maximum ${MAX_CUSTOM_HEADERS} custom headers allowed.`,
        400,
        'LIMIT_EXCEEDED'
      )
    }

    // Verify endpoint belongs to developer
    const [endpoint] = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.developerId, auth.id),
      ))
      .limit(1)

    if (!endpoint) {
      return errorResponse('Webhook endpoint not found.', 404, 'NOT_FOUND')
    }

    const [updated] = await db
      .update(webhookEndpoints)
      .set({
        customHeaders: body.customHeaders,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, id))
      .returning({
        id: webhookEndpoints.id,
        customHeaders: webhookEndpoints.customHeaders,
      })

    writeAuditLog({
      developerId: auth.id,
      action: 'webhook.custom_headers_updated',
      resourceType: 'webhook',
      resourceId: id,
      details: { headerCount: body.customHeaders ? Object.keys(body.customHeaders).length : 0 },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({
      id: updated?.id,
      customHeaders: updated?.customHeaders,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
