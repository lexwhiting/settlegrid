import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `stripe-connect:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const stripe = getStripe()
    const appUrl = getAppUrl()

    // Get developer's current Stripe Connect status
    const [developer] = await db
      .select({
        stripeConnectId: developers.stripeConnectId,
        stripeConnectStatus: developers.stripeConnectStatus,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    let accountId = developer.stripeConnectId

    // Create Stripe Connect Express account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: auth.email,
        metadata: { developerId: auth.id },
        capabilities: {
          transfers: { requested: true },
        },
      })

      accountId = account.id

      await db
        .update(developers)
        .set({
          stripeConnectId: accountId,
          stripeConnectStatus: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(developers.id, auth.id))
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/developer/settings?stripe=refresh`,
      return_url: `${appUrl}/api/stripe/connect/callback?account_id=${accountId}`,
      type: 'account_onboarding',
    })

    return successResponse({ url: accountLink.url })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
