import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints, developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { isWebhookUrlSafe } from '@/lib/webhooks'

export const maxDuration = 60


const VALID_EVENTS = [
  'invocation.completed',
  'payout.initiated',
  'tool.status_changed',
  'balance.low',
] as const

const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid HTTPS URL').refine(
    (u) => u.startsWith('https://'),
    'Webhook URL must use HTTPS'
  ),
  events: z
    .array(z.enum(VALID_EVENTS))
    .min(1, 'At least one event is required')
    .default([...VALID_EVENTS]),
})

/** GET /api/developer/webhooks — list webhook endpoints */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-webhooks:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        status: webhookEndpoints.status,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.developerId, auth.id))
      .limit(50)

    return successResponse({ endpoints })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** POST /api/developer/webhooks — create a webhook endpoint */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-webhooks:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, createWebhookSchema)

    // SSRF protection: reject internal/private URLs at registration time
    if (!isWebhookUrlSafe(body.url)) {
      return errorResponse('Webhook URL must be a public HTTPS endpoint.', 400, 'INVALID_WEBHOOK_URL')
    }

    // Limit: 5 endpoints per developer
    const existing = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.developerId, auth.id))
      .limit(6)

    if (existing.length >= 5) {
      return errorResponse('Maximum 5 webhook endpoints allowed.', 400, 'LIMIT_EXCEEDED')
    }

    // Look up developer tier for max_attempts
    const [dev] = await db
      .select({ tier: developers.tier })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`

    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        developerId: auth.id,
        url: body.url,
        secret,
        events: JSON.stringify(body.events),
        status: 'active',
      })
      .returning({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        status: webhookEndpoints.status,
        createdAt: webhookEndpoints.createdAt,
      })

    // Audit log: webhook created
    writeAuditLog({
      developerId: auth.id,
      action: 'webhook.created',
      resourceType: 'webhook',
      resourceId: endpoint.id,
      details: { url: body.url, events: body.events },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({
      endpoint: {
        ...endpoint,
        secret, // Only returned on creation
        tier: dev?.tier ?? 'standard',
      },
    }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
