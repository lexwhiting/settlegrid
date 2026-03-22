import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

/** POST /api/billing/manage — create a Stripe Billing Portal session */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `billing-manage:${ip}`)
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

    // Fetch developer Stripe customer ID
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

    if (!developer.stripeCustomerId) {
      return errorResponse(
        'No billing account found. Please subscribe to a plan first.',
        400,
        'NO_BILLING_ACCOUNT'
      )
    }

    const stripe = getStripe()
    const appUrl = getAppUrl()

    // Create Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: developer.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings`,
    })

    logger.info('billing.manage.portal_created', {
      developerId: auth.id,
      portalSessionId: portalSession.id,
    })

    return successResponse({ portalUrl: portalSession.url })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
