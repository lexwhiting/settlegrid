import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, payouts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey } from '@/lib/env'

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // Get developer with balance and Stripe status
    const [developer] = await db
      .select({
        id: developers.id,
        balanceCents: developers.balanceCents,
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

    // Calculate 80/20 split: the balanceCents already represents 80% of revenue
    // The platform fee is the 20% that was never added to developer balance
    // For the payout, we transfer the full developer balance
    const payoutAmountCents = developer.balanceCents
    // Platform fee already retained (20% of gross) — calculate for record keeping
    const platformFeeCents = Math.floor(payoutAmountCents * 0.25) // 20% of gross = 25% of developer share

    const stripe = getStripe()
    const now = new Date()

    // Create Stripe transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: payoutAmountCents,
      currency: 'usd',
      destination: developer.stripeConnectId,
      metadata: {
        developerId: developer.id,
        payoutAmountCents: payoutAmountCents.toString(),
      },
    })

    // Insert payout record
    const [payout] = await db
      .insert(payouts)
      .values({
        developerId: developer.id,
        amountCents: payoutAmountCents,
        platformFeeCents,
        stripeTransferId: transfer.id,
        periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        periodEnd: now,
        status: 'completed',
      })
      .returning({
        id: payouts.id,
        amountCents: payouts.amountCents,
        platformFeeCents: payouts.platformFeeCents,
        stripeTransferId: payouts.stripeTransferId,
        status: payouts.status,
        createdAt: payouts.createdAt,
      })

    // Reset developer balance to 0
    await db
      .update(developers)
      .set({
        balanceCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, developer.id))

    return successResponse({
      payout: {
        id: payout.id,
        amountCents: payout.amountCents,
        platformFeeCents: payout.platformFeeCents,
        stripeTransferId: payout.stripeTransferId,
        status: payout.status,
        createdAt: payout.createdAt,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
