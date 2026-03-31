import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'
import type { NotificationWebhooks } from '@/lib/notifications'

export const maxDuration = 10

const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\//
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\//

const configureSchema = z.object({
  slack: z.string().url('Must be a valid URL').regex(
    SLACK_WEBHOOK_PATTERN,
    'Slack webhook must start with https://hooks.slack.com/'
  ).nullable().optional(),
  discord: z.string().url('Must be a valid URL').regex(
    DISCORD_WEBHOOK_PATTERN,
    'Discord webhook must start with https://discord.com/api/webhooks/'
  ).nullable().optional(),
})

/** POST /api/developer/notifications/configure — set Slack/Discord webhook URLs */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-notif-configure:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: slack_notifications requires Builder+ ──────────────
    const [developer] = await db
      .select({
        tier: developers.tier,
        isFoundingMember: developers.isFoundingMember,
        notificationWebhooks: developers.notificationWebhooks,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'slack_notifications', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Builder plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'builder', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    const body = await parseBody(request, configureSchema)

    // Merge with existing webhooks (only update provided fields)
    const existing = (developer.notificationWebhooks ?? {}) as NotificationWebhooks
    const updated: NotificationWebhooks = { ...existing }

    if (body.slack !== undefined) {
      if (body.slack === null) {
        delete updated.slack
      } else {
        updated.slack = body.slack
      }
    }

    if (body.discord !== undefined) {
      if (body.discord === null) {
        delete updated.discord
      } else {
        updated.discord = body.discord
      }
    }

    await db
      .update(developers)
      .set({
        notificationWebhooks: updated,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, auth.id))

    return successResponse({
      notificationWebhooks: updated,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
