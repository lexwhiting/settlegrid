import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse } from '@/lib/api'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

// ── Plan → Stripe Price ID mapping (configure in env or replace with real IDs) ──

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER?.trim(),
  growth: process.env.STRIPE_PRICE_GROWTH?.trim(),
  scale: process.env.STRIPE_PRICE_SCALE?.trim(),
}

const subscribeSchema = z.object({
  plan: z.enum(['starter', 'growth', 'scale']),
})

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey())
}

/** POST /api/billing/subscribe — create a Stripe Checkout session for plan subscription */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `billing-subscribe:${ip}`)
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

    const body = await parseBody(request, subscribeSchema)

    const priceId = PLAN_PRICE_IDS[body.plan]
    if (!priceId) {
      return errorResponse('Invalid plan.', 400, 'INVALID_PLAN')
    }

    // Fetch developer record to check for existing customer/subscription
    const [developer] = await db
      .select({
        stripeCustomerId: developers.stripeCustomerId,
        stripeSubscriptionId: developers.stripeSubscriptionId,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    // If developer already has an active subscription, direct them to manage portal instead
    if (developer.stripeSubscriptionId) {
      return errorResponse(
        'You already have an active subscription. Use the Manage Subscription option to change plans.',
        400,
        'EXISTING_SUBSCRIPTION'
      )
    }

    const stripe = getStripe()
    let stripeCustomerId = developer.stripeCustomerId

    // Create or reuse Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        metadata: { developerId: auth.id },
      })
      stripeCustomerId = customer.id

      await db
        .update(developers)
        .set({ stripeCustomerId })
        .where(eq(developers.id, auth.id))
    }

    const appUrl = getAppUrl()

    // Create Stripe Checkout Session in subscription mode
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/settings?subscription=cancelled`,
      metadata: {
        developerId: auth.id,
        plan: body.plan,
      },
      subscription_data: {
        metadata: {
          developerId: auth.id,
          plan: body.plan,
        },
      },
    })

    logger.info('billing.subscribe.checkout_created', {
      developerId: auth.id,
      plan: body.plan,
      sessionId: session.id,
    })

    return successResponse({ checkoutUrl: session.url }, 201)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error('billing.subscribe.error', { message: msg, stack })
    // Return the actual error message in development/test to aid debugging
    return errorResponse(msg, 500, 'SUBSCRIBE_ERROR')
  }
}
