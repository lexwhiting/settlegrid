import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, payouts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `payout-trigger:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // Get developer with balance, Stripe status, and revenue share
    const [developer] = await db
      .select({
        id: developers.id,
        balanceCents: developers.balanceCents,
        revenueSharePct: developers.revenueSharePct,
        stripeConnectId: developers.stripeConnectId,
        stripeConnectStatus: developers.stripeConnectStatus,
        payoutMinimumCents: developers.payoutMinimumCents,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    if (developer.stripeConnectStatus !== 'active') {
      return errorResponse(
        'Stripe Connect account must be active to trigger payouts. Complete onboarding first.',
        400,
        'STRIPE_NOT_ACTIVE'
      )
    }

    if (!developer.stripeConnectId) {
      return errorResponse(
        'No Stripe Connect account found. Complete onboarding first.',
        400,
        'NO_STRIPE_ACCOUNT'
      )
    }

    if (developer.balanceCents < developer.payoutMinimumCents) {
      return errorResponse(
        `Balance ($${(developer.balanceCents / 100).toFixed(2)}) is below the minimum payout threshold ($${(developer.payoutMinimumCents / 100).toFixed(2)}).`,
        400,
        'BELOW_MINIMUM'
      )
    }

    // The balanceCents already represents the developer's share (e.g. 85% or 90% of revenue)
    const payoutAmountCents = developer.balanceCents
    // Platform fee already retained — calculate for record keeping
    const sharePct = developer.revenueSharePct ?? 85
    const platformPct = 100 - sharePct
    const platformFeeCents = Math.floor(payoutAmountCents * (platformPct / sharePct))

    const now = new Date()

    // ── Step 1: Insert payout record with status='processing' ─────────────────
    const [payoutRecord] = await db
      .insert(payouts)
      .values({
        developerId: developer.id,
        amountCents: payoutAmountCents,
        platformFeeCents,
        periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: now,
        status: 'processing',
      })
      .returning({
        id: payouts.id,
        amountCents: payouts.amountCents,
        platformFeeCents: payouts.platformFeeCents,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })

    // ── Step 2: Attempt Stripe transfer ───────────────────────────────────────
    let transfer: Stripe.Transfer
    try {
      const stripe = getStripe()
      transfer = await stripe.transfers.create({
        amount: payoutAmountCents,
        currency: 'usd',
        destination: developer.stripeConnectId,
        metadata: {
          developerId: developer.id,
          payoutId: payoutRecord.id,
          payoutAmountCents: payoutAmountCents.toString(),
        },
      })
    } catch (stripeError) {
      // ── Step 4 (failure): Mark payout as 'failed', do NOT touch balance ───
      const errorMsg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'

      await db
        .update(payouts)
        .set({
          status: 'failed',
          errorMessage: errorMsg,
        })
        .where(eq(payouts.id, payoutRecord.id))

      logger.error('payout.stripe_transfer_failed', {
        developerId: developer.id,
        payoutId: payoutRecord.id,
        amountCents: payoutAmountCents,
      }, stripeError)

      return errorResponse(
        `Payout failed: ${errorMsg}`,
        502,
        'STRIPE_TRANSFER_FAILED'
      )
    }

    // ── Step 3: Success — update payout to 'completed' + reset balance ────────
    await db
      .update(payouts)
      .set({
        status: 'completed',
        stripeTransferId: transfer.id,
      })
      .where(eq(payouts.id, payoutRecord.id))

    // Reset developer balance to 0
    await db
      .update(developers)
      .set({
        balanceCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, developer.id))

    // Audit log: payout triggered
    writeAuditLog({
      developerId: auth.id,
      action: 'payout.triggered',
      resourceType: 'payout',
      resourceId: payoutRecord.id,
      details: { amountCents: payoutAmountCents, stripeTransferId: transfer.id },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({
      payout: {
        id: payoutRecord.id,
        amountCents: payoutRecord.amountCents,
        platformFeeCents: payoutRecord.platformFeeCents,
        stripeTransferId: transfer.id,
        status: 'completed',
        createdAt: payoutRecord.createdAt,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
