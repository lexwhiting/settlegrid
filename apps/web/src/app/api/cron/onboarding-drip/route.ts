import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { developers, tools } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { sendNotificationEmail } from '@/lib/notifications'
import {
  onboardingNudgeToolEmail,
  onboardingNudgePricingEmail,
  onboardingNudgeStripeEmail,
  onboardingStuckEmail,
  onboardingDraftToolEmail,
  onboardingStripeIncompleteEmail,
} from '@/lib/email'

export const maxDuration = 60

/**
 * Vercel Cron handler: sends onboarding drip emails based on developer activation state.
 * Runs every hour.
 *
 * Drip sequence:
 *   D2: +24h after signup, no tool created — "Your first tool takes 2 minutes"
 *   D3: +2h after tool creation, no pricing — "Set your pricing"
 *   D4: +24h after tool creation, no Stripe — "Connect Stripe to get paid"
 *   D8: +7 days after signup, no tool — "Need help getting started?"
 *   R4: +7 days after tool creation, tool in draft — "Your tool is almost ready"
 *   R7: +48h after Stripe started but not completed — "Finish connecting Stripe"
 *
 * Uses Redis to track which drip emails have been sent: drip:{developerId}:{emailKey}
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-onboarding-drip:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.onboarding_drip.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const emailsSent = { D2: 0, D3: 0, D4: 0, D8: 0, R4: 0, R7: 0 }

    // Only process developers created in the last 30 days (drip window)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const recentDevs = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        stripeConnectStatus: developers.stripeConnectStatus,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .where(sql`${developers.createdAt} >= ${thirtyDaysAgo}`)
      .limit(1000)

    const redis = getRedis()

    for (const dev of recentDevs) {
      try {
        const devName = dev.name ?? 'Developer'
        const devAge = now.getTime() - new Date(dev.createdAt).getTime()
        const hoursOld = devAge / (60 * 60 * 1000)

        // Get developer's tools
        const devTools = await db
          .select({
            id: tools.id,
            name: tools.name,
            status: tools.status,
            pricingConfig: tools.pricingConfig,
            createdAt: tools.createdAt,
          })
          .from(tools)
          .where(eq(tools.developerId, dev.id))
          .limit(50)

        const hasTools = devTools.length > 0
        const hasStripe = dev.stripeConnectStatus === 'active'
        const stripeStarted = dev.stripeConnectStatus === 'pending' || dev.stripeConnectStatus === 'incomplete'

        // ─── D2: +24h, no tool ────────────────────────────────────────
        if (!hasTools && hoursOld >= 24 && hoursOld < 168) {
          await sendDripIfNew(redis, dev.id, 'D2', async () => {
            const tpl = onboardingNudgeToolEmail(devName)
            await sendNotificationEmail({
              developerId: dev.id,
              eventKey: 'onboarding_drip',
              email: dev.email,
              subject: tpl.subject,
              html: tpl.html,
            })
            emailsSent.D2++
          })
        }

        // ─── D8: +7 days, no tool ────────────────────────────────────
        if (!hasTools && hoursOld >= 168) {
          await sendDripIfNew(redis, dev.id, 'D8', async () => {
            const tpl = onboardingStuckEmail(devName)
            await sendNotificationEmail({
              developerId: dev.id,
              eventKey: 'onboarding_drip',
              email: dev.email,
              subject: tpl.subject,
              html: tpl.html,
            })
            emailsSent.D8++
          })
        }

        // Tool-specific drips
        for (const tool of devTools) {
          const toolAge = now.getTime() - new Date(tool.createdAt).getTime()
          const toolHoursOld = toolAge / (60 * 60 * 1000)

          // ─── D3: +2h after tool, no pricing ───────────────────────
          const hasPricing = tool.pricingConfig !== null && tool.pricingConfig !== undefined
          if (!hasPricing && toolHoursOld >= 2 && toolHoursOld < 168) {
            await sendDripIfNew(redis, dev.id, `D3:${tool.id}`, async () => {
              const tpl = onboardingNudgePricingEmail(devName, tool.name)
              await sendNotificationEmail({
                developerId: dev.id,
                eventKey: 'onboarding_drip',
                email: dev.email,
                subject: tpl.subject,
                html: tpl.html,
              })
              emailsSent.D3++
            })
          }

          // ─── D4: +24h after tool, no Stripe ──────────────────────
          if (!hasStripe && !stripeStarted && toolHoursOld >= 24 && toolHoursOld < 336) {
            await sendDripIfNew(redis, dev.id, 'D4', async () => {
              const tpl = onboardingNudgeStripeEmail(devName)
              await sendNotificationEmail({
                developerId: dev.id,
                eventKey: 'onboarding_drip',
                email: dev.email,
                subject: tpl.subject,
                html: tpl.html,
              })
              emailsSent.D4++
            })
          }

          // ─── R4: +7 days, tool still in draft ────────────────────
          if (tool.status === 'draft' && toolHoursOld >= 168) {
            await sendDripIfNew(redis, dev.id, `R4:${tool.id}`, async () => {
              const missing: string[] = []
              if (!hasPricing) missing.push('Set pricing for your tool')
              if (!hasStripe) missing.push('Connect your Stripe account')
              if (!tool.name || tool.name.length < 3) missing.push('Add a descriptive tool name')
              if (missing.length === 0) missing.push('Publish your tool (change status from draft to active)')

              const tpl = onboardingDraftToolEmail(devName, tool.name, missing)
              await sendNotificationEmail({
                developerId: dev.id,
                eventKey: 'onboarding_drip',
                email: dev.email,
                subject: tpl.subject,
                html: tpl.html,
              })
              emailsSent.R4++
            })
          }
        }

        // ─── R7: +48h, Stripe started but not completed ────────────
        if (stripeStarted) {
          const devCreatedMs = new Date(dev.createdAt).getTime()
          // Use dev creation as proxy since we don't track Stripe start time
          if (now.getTime() - devCreatedMs >= 48 * 60 * 60 * 1000) {
            await sendDripIfNew(redis, dev.id, 'R7', async () => {
              const tpl = onboardingStripeIncompleteEmail(devName)
              await sendNotificationEmail({
                developerId: dev.id,
                eventKey: 'onboarding_drip',
                email: dev.email,
                subject: tpl.subject,
                html: tpl.html,
              })
              emailsSent.R7++
            })
          }
        }
      } catch (devErr) {
        logger.error('cron.onboarding_drip.dev_failed', { developerId: dev.id }, devErr)
      }
    }

    const totalSent = Object.values(emailsSent).reduce((a, b) => a + b, 0)

    logger.info('cron.onboarding_drip.completed', {
      devsProcessed: recentDevs.length,
      totalSent,
      ...emailsSent,
    })

    return successResponse({
      devsProcessed: recentDevs.length,
      totalSent,
      breakdown: emailsSent,
    })
  } catch (error) {
    logger.error('cron.onboarding_drip.failed', {}, error)
    return internalErrorResponse(error)
  }
}

/**
 * Send a drip email only if it has not been sent before.
 * Uses Redis key `drip:{developerId}:{emailKey}` with 90-day expiry.
 */
async function sendDripIfNew(
  redis: ReturnType<typeof getRedis>,
  developerId: string,
  emailKey: string,
  sendFn: () => Promise<void>
): Promise<void> {
  const redisKey = `drip:${developerId}:${emailKey}`
  const alreadySent = await redis.get<string>(redisKey)
  if (alreadySent) return

  await sendFn()

  // Mark as sent with 90-day TTL (covers the entire drip window and then some)
  await redis.set(redisKey, '1', { ex: 90 * 24 * 60 * 60 })
}
