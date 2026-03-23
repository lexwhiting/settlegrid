import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, purchases, consumerToolBalances, consumers, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getStripeSecretKey, getStripeWebhookSecret } from '@/lib/env'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  creditPurchaseConfirmationEmail,
  autoRefillConfirmationEmail,
  paymentFailedEmail,
  sendEmail,
} from '@/lib/email'

/** Valid paid plan tiers that map from Stripe subscription metadata */
const VALID_PAID_TIERS = ['starter', 'growth', 'scale'] as const
type PaidTier = typeof VALID_PAID_TIERS[number]

function isValidPaidTier(plan: string | undefined): plan is PaidTier {
  return VALID_PAID_TIERS.includes(plan as PaidTier)
}

export const maxDuration = 60


function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey())
}

/**
 * Look up consumer email and tool name for sending transactional emails.
 * Returns null if the records can't be found (non-blocking).
 */
async function lookupConsumerAndTool(
  consumerId: string,
  toolId: string
): Promise<{ email: string; toolName: string } | null> {
  try {
    const [consumer] = await db
      .select({ email: consumers.email })
      .from(consumers)
      .where(eq(consumers.id, consumerId))
      .limit(1)

    const [tool] = await db
      .select({ name: tools.name })
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1)

    if (consumer && tool) {
      return { email: consumer.email, toolName: tool.name }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Light rate limiting to prevent DoS (high limit since Stripe sends bursts)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `billing-webhook:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const webhookSecret = getStripeWebhookSecret()?.trim()
    if (!webhookSecret) {
      logger.error('stripe.webhook.not_configured', {
        message: 'STRIPE_WEBHOOK_SECRET is not set. Configure it in your environment to enable billing webhooks.',
      })
      return errorResponse(
        'Billing webhooks are not configured. Set STRIPE_WEBHOOK_SECRET in your environment.',
        503,
        'NOT_CONFIGURED'
      )
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return errorResponse('Missing Stripe signature.', 400, 'MISSING_SIGNATURE')
    }

    const stripe = getStripe()
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature'
      logger.error('stripe.webhook.signature_failed', { reason: message })
      return errorResponse('Invalid webhook signature.', 400, 'INVALID_SIGNATURE')
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // ── Developer subscription checkout ────────────────────────────
        if (session.mode === 'subscription' && session.metadata?.developerId) {
          const developerId = session.metadata.developerId
          const plan = session.metadata.plan
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.toString() ?? null

          if (isValidPaidTier(plan) && subscriptionId) {
            await db
              .update(developers)
              .set({
                tier: plan,
                stripeSubscriptionId: subscriptionId,
                revenueSharePct: 95, // Paid tiers: 5% platform fee
                updatedAt: new Date(),
              })
              .where(eq(developers.id, developerId))

            logger.info('stripe.webhook.subscription_activated', {
              developerId,
              plan,
              subscriptionId,
            })
          } else {
            logger.error('stripe.webhook.subscription_invalid_metadata', {
              sessionId: session.id,
              developerId,
              plan,
              subscriptionId,
            })
          }
          break
        }

        // ── Consumer credit purchase checkout ──────────────────────────
        const purchaseId = session.metadata?.purchaseId
        const consumerId = session.metadata?.consumerId
        const toolId = session.metadata?.toolId
        const amountCents = parseInt(session.metadata?.amountCents ?? '0', 10)

        if (!purchaseId || !consumerId || !toolId || !amountCents) {
          logger.error('stripe.webhook.missing_metadata', { sessionId: session.id })
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

        logger.info('stripe.webhook.checkout_completed', {
          purchaseId,
          consumerId,
          toolId,
          amountCents,
        })

        // Fire-and-forget credit purchase confirmation email
        lookupConsumerAndTool(consumerId, toolId).then((info) => {
          if (info) {
            const template = creditPurchaseConfirmationEmail(info.email, amountCents, info.toolName)
            sendEmail({ to: info.email, subject: template.subject, html: template.html }).catch(
              (err) => logger.error('stripe.webhook.email_failed', { consumerId, type: 'credit_purchase' }, err)
            )
          }
        })

        break
      }

      case 'payment_intent.succeeded': {
        const succeededIntent = event.data.object as Stripe.PaymentIntent

        // Check if this is an auto-refill payment
        if (succeededIntent.metadata?.type === 'auto_refill') {
          const consumerId = succeededIntent.metadata.consumerId
          const toolId = succeededIntent.metadata.toolId
          const amountCents = parseInt(succeededIntent.metadata.amountCents ?? '0', 10)

          if (consumerId && toolId && amountCents > 0) {
            // Credit the balance
            const [existingBalance] = await db
              .select({ id: consumerToolBalances.id, balanceCents: consumerToolBalances.balanceCents })
              .from(consumerToolBalances)
              .where(
                and(
                  eq(consumerToolBalances.consumerId, consumerId),
                  eq(consumerToolBalances.toolId, toolId)
                )
              )
              .limit(1)

            let newBalanceCents = amountCents

            if (existingBalance) {
              await db
                .update(consumerToolBalances)
                .set({
                  balanceCents: sql`${consumerToolBalances.balanceCents} + ${amountCents}`,
                })
                .where(eq(consumerToolBalances.id, existingBalance.id))

              newBalanceCents = existingBalance.balanceCents + amountCents
            }

            // Update purchase status
            const [purchase] = await db
              .select({ id: purchases.id })
              .from(purchases)
              .where(eq(purchases.stripePaymentIntentId, succeededIntent.id))
              .limit(1)

            if (purchase) {
              await db
                .update(purchases)
                .set({ status: 'completed' })
                .where(eq(purchases.id, purchase.id))
            }

            // Invalidate Redis balance cache
            try {
              const { invalidateBalanceCache } = await import('@/lib/metering')
              await invalidateBalanceCache(consumerId, toolId)
            } catch {
              // metering module may not be available in all contexts
            }

            logger.info('stripe.webhook.auto_refill_completed', {
              consumerId,
              toolId,
              amountCents,
              paymentIntentId: succeededIntent.id,
            })

            // Fire-and-forget auto-refill confirmation email
            lookupConsumerAndTool(consumerId, toolId).then((info) => {
              if (info) {
                const template = autoRefillConfirmationEmail(info.email, amountCents, info.toolName, newBalanceCents)
                sendEmail({ to: info.email, subject: template.subject, html: template.html }).catch(
                  (err) => logger.error('stripe.webhook.email_failed', { consumerId, type: 'auto_refill' }, err)
                )
              }
            })
          }
        }
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

          logger.warn('stripe.webhook.payment_failed', {
            purchaseId: purchase.id,
            paymentIntentId: paymentIntent.id,
          })
        } else {
          logger.warn('stripe.webhook.payment_failed_no_purchase', {
            paymentIntentId: paymentIntent.id,
          })
        }

        // Fire-and-forget payment failed email
        const consumerId = paymentIntent.metadata?.consumerId
        const toolId = paymentIntent.metadata?.toolId
        const failedAmountCents = paymentIntent.amount ?? 0
        const failureReason =
          paymentIntent.last_payment_error?.message ?? 'Payment could not be processed'

        if (consumerId && toolId) {
          lookupConsumerAndTool(consumerId, toolId).then((info) => {
            if (info) {
              const template = paymentFailedEmail(info.email, failedAmountCents, failureReason, info.toolName)
              sendEmail({ to: info.email, subject: template.subject, html: template.html }).catch(
                (err) => logger.error('stripe.webhook.email_failed', { consumerId, type: 'payment_failed' }, err)
              )
            }
          })
        }

        break
      }

      // ── Developer subscription lifecycle events ─────────────────────

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const developerId = subscription.metadata?.developerId
        const plan = subscription.metadata?.plan

        if (developerId && isValidPaidTier(plan)) {
          await db
            .update(developers)
            .set({
              tier: plan,
              revenueSharePct: 95,
              updatedAt: new Date(),
            })
            .where(eq(developers.id, developerId))

          logger.info('stripe.webhook.subscription_updated', {
            developerId,
            plan,
            subscriptionId: subscription.id,
            status: subscription.status,
          })
        } else {
          logger.info('stripe.webhook.subscription_updated_no_action', {
            subscriptionId: subscription.id,
            status: subscription.status,
            hasDeveloperId: !!developerId,
            plan,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const developerId = subscription.metadata?.developerId

        if (developerId) {
          // Only revert if this is the developer's CURRENT subscription
          const [dev] = await db
            .select({ stripeSubscriptionId: developers.stripeSubscriptionId })
            .from(developers)
            .where(eq(developers.id, developerId))
            .limit(1)

          if (dev?.stripeSubscriptionId === subscription.id) {
            // This IS their active subscription — revert to free
            await db
              .update(developers)
              .set({
                tier: 'standard',
                stripeSubscriptionId: null,
                revenueSharePct: 100, // Free tier: 0% platform fee
                updatedAt: new Date(),
              })
              .where(eq(developers.id, developerId))

            logger.info('stripe.webhook.subscription_cancelled', {
              developerId,
              subscriptionId: subscription.id,
            })
          } else {
            logger.info('stripe.webhook.subscription_deleted_ignored', {
              developerId,
              deletedSubId: subscription.id,
              activeSubId: dev?.stripeSubscriptionId,
            })
          }
        } else {
          logger.info('stripe.webhook.subscription_deleted_no_developer', {
            subscriptionId: subscription.id,
          })
        }
        break
      }

      default:
        // Unhandled event type — acknowledge receipt
        logger.info('stripe.webhook.unhandled_event', { type: event.type })
    }

    return successResponse({ received: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
