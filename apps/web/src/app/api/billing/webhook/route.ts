import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { purchases, consumerToolBalances } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey, getStripeWebhookSecret } from '@/lib/env'

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return errorResponse('Missing Stripe signature.', 400, 'MISSING_SIGNATURE')
    }

    const stripe = getStripe()
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature'
      console.error('[Stripe Webhook] Signature verification failed:', message)
      return errorResponse('Invalid webhook signature.', 400, 'INVALID_SIGNATURE')
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const purchaseId = session.metadata?.purchaseId
        const consumerId = session.metadata?.consumerId
        const toolId = session.metadata?.toolId
        const amountCents = parseInt(session.metadata?.amountCents ?? '0', 10)

        if (!purchaseId || !consumerId || !toolId || !amountCents) {
          console.error('[Stripe Webhook] Missing metadata in checkout session:', session.id)
          return successResponse({ received: true })
        }

        // Update purchase status to completed
        await db
          .update(purchases)
          .set({
            status: 'completed',
            stripePaymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          })
          .where(eq(purchases.id, purchaseId))

        // Upsert consumer tool balance: add credits
        const [existingBalance] = await db
          .select({ id: consumerToolBalances.id })
          .from(consumerToolBalances)
          .where(
            and(
              eq(consumerToolBalances.consumerId, consumerId),
              eq(consumerToolBalances.toolId, toolId)
            )
          )
          .limit(1)

        if (existingBalance) {
          // Increment existing balance
          await db
            .update(consumerToolBalances)
            .set({
              balanceCents: sql`${consumerToolBalances.balanceCents} + ${amountCents}`,
            })
            .where(eq(consumerToolBalances.id, existingBalance.id))
        } else {
          // Create new balance record
          await db
            .insert(consumerToolBalances)
            .values({
              consumerId,
              toolId,
              balanceCents: amountCents,
            })
        }

        console.log(
          `[Stripe Webhook] Checkout completed: purchase=${purchaseId}, consumer=${consumerId}, tool=${toolId}, amount=${amountCents}c`
        )
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Find purchase by payment intent ID and mark as failed
        const [purchase] = await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(eq(purchases.stripePaymentIntentId, paymentIntent.id))
          .limit(1)

        if (purchase) {
          await db
            .update(purchases)
            .set({ status: 'failed' })
            .where(eq(purchases.id, purchase.id))

          console.log(`[Stripe Webhook] Payment failed: purchase=${purchase.id}`)
        } else {
          console.warn(
            `[Stripe Webhook] Payment failed but no matching purchase found for intent: ${paymentIntent.id}`
          )
        }
        break
      }

      default:
        // Unhandled event type — acknowledge receipt
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return successResponse({ received: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
