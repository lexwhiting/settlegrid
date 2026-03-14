import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `stripe-callback:${ip}`)
    if (!rateLimit.success) {
      const appUrl = getAppUrl()
      return NextResponse.redirect(`${appUrl}/dashboard/developer/settings?stripe=error&reason=rate_limited`)
    }

    const url = new URL(request.url)
    const accountId = url.searchParams.get('account_id')
    const appUrl = getAppUrl()

    if (!accountId) {
      return NextResponse.redirect(`${appUrl}/dashboard/developer/settings?stripe=error&reason=missing_account`)
    }

    const stripe = getStripe()

    // Verify the account status with Stripe
    const account = await stripe.accounts.retrieve(accountId)

    // Determine connect status based on account details
    let connectStatus: string
    if (account.charges_enabled && account.payouts_enabled) {
      connectStatus = 'active'
    } else if (account.details_submitted) {
      connectStatus = 'pending'
    } else {
      connectStatus = 'incomplete'
    }

    // Update developer with new status
    await db
      .update(developers)
      .set({
        stripeConnectStatus: connectStatus,
        updatedAt: new Date(),
      })
      .where(eq(developers.stripeConnectId, accountId))

    return NextResponse.redirect(
      `${appUrl}/dashboard/developer/settings?stripe=${connectStatus}`
    )
  } catch (error) {
    const appUrl = getAppUrl()
    logger.error('stripe.connect.callback_failed', {}, error)
    return NextResponse.redirect(`${appUrl}/dashboard/developer/settings?stripe=error`)
  }
}
