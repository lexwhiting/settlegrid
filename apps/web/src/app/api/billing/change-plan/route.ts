import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { developers, webhookEndpoints } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import { planChangedEmail } from '@/lib/email'
import { sendNotificationEmail } from '@/lib/notifications'
import { getTierConfig } from '@/lib/tier-config'

export const maxDuration = 30

// ── Plan → Stripe Price ID mapping ──────────────────────────────────────────

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  builder: (process.env.STRIPE_PRICE_BUILDER ?? process.env.STRIPE_PRICE_STARTER)?.trim(),
  scale: process.env.STRIPE_PRICE_SCALE?.trim(),
}

const PLAN_ORDER = ['free', 'builder', 'scale'] as const

const changePlanSchema = z.object({
  plan: z.enum(['builder', 'scale']),
})

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey())
}

/** POST /api/billing/change-plan — switch an existing subscription to a different plan */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `billing-change-plan:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, changePlanSchema)

    const newPriceId = PLAN_PRICE_IDS[body.plan]
    if (!newPriceId) {
      return errorResponse(
        `Price not configured for plan "${body.plan}". Contact support.`,
        400,
        'PRICE_NOT_CONFIGURED'
      )
    }

    // Fetch developer record
    const [developer] = await db
      .select({
        tier: developers.tier,
        stripeCustomerId: developers.stripeCustomerId,
        stripeSubscriptionId: developers.stripeSubscriptionId,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    if (!developer.stripeSubscriptionId) {
      return errorResponse(
        'No active subscription found. Subscribe to a plan first.',
        400,
        'NO_SUBSCRIPTION'
      )
    }

    // Prevent no-op changes
    if (developer.tier === body.plan) {
      return errorResponse(
        `You are already on the ${body.plan} plan.`,
        400,
        'ALREADY_ON_PLAN'
      )
    }

    const stripe = getStripe()

    // Retrieve the current subscription to get the subscription item ID
    const subscription = await stripe.subscriptions.retrieve(developer.stripeSubscriptionId)

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return errorResponse(
        'Your subscription is not active. Please subscribe to a new plan.',
        400,
        'SUBSCRIPTION_NOT_ACTIVE'
      )
    }

    const subscriptionItemId = subscription.items.data[0]?.id
    if (!subscriptionItemId) {
      return errorResponse(
        'Unable to find subscription item. Contact support.',
        500,
        'NO_SUBSCRIPTION_ITEM'
      )
    }

    // Normalize legacy tiers for comparison
    const normalizedCurrentTier = (developer.tier === 'starter' || developer.tier === 'growth') ? 'builder' : developer.tier
    // Determine if this is an upgrade or downgrade
    const currentIndex = PLAN_ORDER.indexOf(normalizedCurrentTier as typeof PLAN_ORDER[number])
    const newIndex = PLAN_ORDER.indexOf(body.plan)
    const isUpgrade = newIndex > currentIndex

    // Update the subscription: swap the price on the existing subscription item.
    // Upgrades: prorate immediately (customer pays the difference now).
    // Downgrades: take effect at the next billing period (credit issued).
    await stripe.subscriptions.update(developer.stripeSubscriptionId, {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        developerId: auth.id,
        plan: body.plan,
      },
    })

    // Update the developer tier in the database immediately.
    // The webhook (customer.subscription.updated) will also fire and confirm this,
    // but we update eagerly so the UI reflects the change instantly.
    const newTierConfig = getTierConfig(body.plan)
    await db
      .update(developers)
      .set({
        tier: body.plan,
        logRetentionDays: newTierConfig.logRetentionDays,
        // Progressive take rate — calculated dynamically at payout time. See lib/pricing.ts
        updatedAt: new Date(),
      })
      .where(eq(developers.id, auth.id))

    // ── Downgrade: disable excess webhook endpoints ────────────────────
    if (!isUpgrade) {
      const maxEndpoints = newTierConfig.maxWebhookEndpoints
      const allEndpoints = await db
        .select({ id: webhookEndpoints.id, createdAt: webhookEndpoints.createdAt })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, auth.id))
        .orderBy(webhookEndpoints.createdAt)
        .limit(100)

      if (allEndpoints.length > maxEndpoints) {
        // Keep the oldest N endpoints active, disable the rest
        const toDisable = allEndpoints.slice(maxEndpoints).map((e) => e.id)
        for (const epId of toDisable) {
          await db
            .update(webhookEndpoints)
            .set({ status: 'disabled', updatedAt: new Date() })
            .where(eq(webhookEndpoints.id, epId))
        }
        logger.info('billing.downgrade.webhooks_disabled', {
          developerId: auth.id,
          disabledCount: toDisable.length,
          maxEndpoints,
        })
      }
    }

    logger.info('billing.change_plan.success', {
      developerId: auth.id,
      from: developer.tier,
      to: body.plan,
      isUpgrade,
      subscriptionId: developer.stripeSubscriptionId,
    })

    // Fire-and-forget audit log
    writeAuditLog({
      developerId: auth.id,
      action: 'billing.plan_changed',
      resourceType: 'subscription',
      resourceId: developer.stripeSubscriptionId ?? undefined,
      details: { oldPlan: developer.tier, newPlan: body.plan, proration: true },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {})

    // Fire-and-forget plan change email
    const template = planChangedEmail(auth.email, developer.tier, body.plan)
    sendNotificationEmail({
      developerId: auth.id,
      eventKey: 'plan_changed',
      email: auth.email,
      subject: template.subject,
      html: template.html,
    }).catch(() => {})

    return successResponse({
      plan: body.plan,
      isUpgrade,
      message: isUpgrade
        ? `Upgraded to ${body.plan}. Prorated charges applied.`
        : `Switched to ${body.plan}. Prorated credit applied.`,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
