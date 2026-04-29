import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { stripeConnectCompleteEmail, sendEmail } from '@/lib/email'
import { createStripeRailAdapter } from '@settlegrid/mcp'
import type { StripeClient, OnboardingStatusCode } from '@settlegrid/mcp'
import { getStripeClient } from '@/lib/rails'

export const maxDuration = 60

/**
 * P2.RAIL1 — Status check goes through adapter.syncOnboardingStatus
 * instead of inlining stripe.accounts.retrieve + the three-way
 * active/pending/incomplete ladder. The ladder now lives in the
 * adapter so ALL rails map to the same normalized
 * OnboardingStatusCode enum.
 */

// Keep the DB value a string to preserve the existing schema; map
// OnboardingStatusCode → the legacy string the column historically
// stored. Expanding this mapping when P3 adds 'restricted' / 'rejected'
// variants is a one-line change here.
function toLegacyStatus(code: OnboardingStatusCode): string {
  switch (code) {
    case 'active':
      return 'active'
    case 'pending':
      return 'pending'
    case 'incomplete':
      return 'incomplete'
    case 'restricted':
    case 'rejected':
      return 'incomplete'
    case 'not_started':
      return 'pending'
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `stripe-callback:${ip}`)
    if (!rateLimit.success) {
      const appUrl = getAppUrl()
      return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe=error&reason=rate_limited`)
    }

    const url = new URL(request.url)
    const accountId = url.searchParams.get('account_id')
    const appUrl = getAppUrl()

    if (!accountId) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe=error&reason=missing_account`)
    }

    const adapter = createStripeRailAdapter({
      stripe: getStripeClient() as unknown as StripeClient,
      appUrl,
    })

    const status = await adapter.syncOnboardingStatus(accountId)
    const connectStatus = toLegacyStatus(status.code)

    await db
      .update(developers)
      .set({
        stripeConnectStatus: connectStatus,
        updatedAt: new Date(),
      })
      .where(eq(developers.stripeConnectId, accountId))

    // Send Stripe Connect completion email when account becomes active
    if (connectStatus === 'active') {
      const [developer] = await db
        .select({ email: developers.email, name: developers.name })
        .from(developers)
        .where(eq(developers.stripeConnectId, accountId))
        .limit(1)

      if (developer) {
        const displayName = developer.name ?? developer.email
        const template = stripeConnectCompleteEmail(displayName)
        sendEmail({ to: developer.email, subject: template.subject, html: template.html }).catch(
          (err) => logger.error('stripe.connect.email_failed', { accountId }, err)
        )
      }
    }

    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?stripe=${connectStatus}`
    )
  } catch (error) {
    const appUrl = getAppUrl()
    logger.error('stripe.connect.callback_failed', {}, error)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe=error`)
  }
}
