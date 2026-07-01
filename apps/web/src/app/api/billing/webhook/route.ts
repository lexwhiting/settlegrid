import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, purchases, consumerToolBalances, consumers, tools, processedWebhookEvents, payouts } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getStripeWebhookSecret } from '@/lib/env'
import { sdkLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  creditPurchaseConfirmationEmail,
  autoRefillConfirmationEmail,
  paymentFailedEmail,
  sendEmail,
} from '@/lib/email'
import { getStripeClient } from '@/lib/rails'

/** Valid paid plan tiers that map from Stripe subscription metadata.
 * 'starter' and 'growth' are legacy tiers — mapped to 'builder' internally. */
const VALID_PAID_TIERS = ['builder', 'scale', 'starter', 'growth'] as const
type PaidTier = typeof VALID_PAID_TIERS[number]

function isValidPaidTier(plan: string | undefined): plan is PaidTier {
  return VALID_PAID_TIERS.includes(plan as PaidTier)
}

/** Normalize legacy tier names to current tier names */
function normalizeTier(plan: string): string {
  if (plan === 'starter' || plan === 'growth') return 'builder'
  return plan
}

export const maxDuration = 60


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
    const ip = getClientIp(request.headers)
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

    const stripe = getStripeClient()
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature'
      logger.error('stripe.webhook.signature_failed', { reason: message })
      return errorResponse('Invalid webhook signature.', 400, 'INVALID_SIGNATURE')
    }

    // Consumer-audit #1 — idempotency gate. Stripe retries on any HTTP
    // error or slow ACK. Without this check, a retried
    // checkout.session.completed would credit the consumer twice.
    //
    // Pattern: try to record the event ID first; if the PK unique
    // constraint on event_id rejects the insert, the event has already
    // been processed — ACK 200 and skip. ON CONFLICT DO NOTHING makes
    // the check atomic (no SELECT-then-INSERT race).
    try {
      const insertedRows = await db
        .insert(processedWebhookEvents)
        .values({ eventId: event.id, source: 'stripe', eventType: event.type })
        .onConflictDoNothing({ target: processedWebhookEvents.eventId })
        .returning({ eventId: processedWebhookEvents.eventId })

      if (insertedRows.length === 0) {
        logger.info('stripe.webhook.duplicate_event_skipped', {
          eventId: event.id,
          eventType: event.type,
        })
        return successResponse({ received: true, duplicate: true })
      }
    } catch (err) {
      // If the idempotency ledger is unreachable, do NOT proceed —
      // processing without the guard could double-credit on Stripe retries.
      // Return 503 so Stripe retries after the DB recovers.
      logger.error('stripe.webhook.idempotency_ledger_failed', {
        eventId: event.id,
        eventType: event.type,
      }, err)
      return errorResponse('Idempotency ledger unavailable.', 503, 'IDEMPOTENCY_UNAVAILABLE')
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
            const normalizedTier = normalizeTier(plan)
            // Retry-safety (G3-5): wrap the write + its success log in a
            // single tx and delete the dedup marker on failure so Stripe's
            // 500-triggered retry can replay. The tx makes delete-on-failure
            // atomic-safe (a throw commits nothing → no double-write on
            // retry); the logger.info goes INSIDE so a throwing log-meta
            // rolls the write back instead of deleting-after-commit (DC-06).
            try {
              await db.transaction(async (tx) => {
                await tx
                  .update(developers)
                  .set({
                    tier: normalizedTier,
                    stripeSubscriptionId: subscriptionId,
                    // Progressive take rate — calculated dynamically at payout time. See lib/pricing.ts
                    updatedAt: new Date(),
                  })
                  .where(eq(developers.id, developerId))

                logger.info('stripe.webhook.subscription_activated', {
                  developerId,
                  plan: normalizedTier,
                  subscriptionId,
                })
              })
            } catch (handlerErr) {
              await db
                .delete(processedWebhookEvents)
                .where(eq(processedWebhookEvents.eventId, event.id))
                .catch((delErr) => {
                  logger.error(
                    'stripe.webhook.dedup_delete_failed',
                    { eventId: event.id, eventType: event.type },
                    delErr as Error,
                  )
                })
              throw handlerErr
            }
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

        // ── Consumer credit pack purchase ──────────────────────────────
        if (session.metadata?.type === 'credit_pack') {
          const cpConsumerId = session.metadata.consumerId
          const packId = session.metadata.packId
          const creditAmountCents = parseInt(session.metadata.creditAmountCents ?? '0', 10)

          // Server-side validation: verify the actual amount paid matches expected pack price.
          // This prevents manipulation of the checkout session metadata.
          const PACK_PRICES: Record<string, { priceCents: number; creditCents: number }> = {
            pack_100: { priceCents: 9500, creditCents: 10000 },
            pack_500: { priceCents: 45000, creditCents: 50000 },
            pack_1000: { priceCents: 85000, creditCents: 100000 },
          }

          const expectedPack = packId ? PACK_PRICES[packId] : null
          const amountPaid = session.amount_total ?? 0

          if (expectedPack && amountPaid !== expectedPack.priceCents) {
            logger.error('stripe.webhook.credit_pack_amount_mismatch', {
              sessionId: session.id,
              packId,
              expectedPriceCents: expectedPack.priceCents,
              actualAmountCents: amountPaid,
            })
            // Do NOT credit — potential manipulation attempt
            return successResponse({ received: true })
          }

          // Also verify creditAmountCents matches the expected pack
          if (expectedPack && creditAmountCents !== expectedPack.creditCents) {
            logger.error('stripe.webhook.credit_pack_credit_mismatch', {
              sessionId: session.id,
              packId,
              expectedCreditCents: expectedPack.creditCents,
              metadataCreditCents: creditAmountCents,
            })
            return successResponse({ received: true })
          }

          if (cpConsumerId && creditAmountCents > 0) {
            // Retry-safety (G3-5): see the subscription path above — tx-wrap
            // the credit + its log, delete the dedup marker on failure, and
            // re-throw so Stripe's retry re-credits (exactly once).
            try {
              await db.transaction(async (tx) => {
                await tx
                  .update(consumers)
                  .set({
                    globalBalanceCents: sql`${consumers.globalBalanceCents} + ${creditAmountCents}`,
                  })
                  .where(eq(consumers.id, cpConsumerId))

                logger.info('stripe.webhook.credit_pack_completed', {
                  consumerId: cpConsumerId,
                  packId,
                  creditAmountCents,
                  sessionId: session.id,
                })
              })
            } catch (handlerErr) {
              await db
                .delete(processedWebhookEvents)
                .where(eq(processedWebhookEvents.eventId, event.id))
                .catch((delErr) => {
                  logger.error(
                    'stripe.webhook.dedup_delete_failed',
                    { eventId: event.id, eventType: event.type },
                    delErr as Error,
                  )
                })
              throw handlerErr
            }
          } else {
            logger.error('stripe.webhook.credit_pack_missing_metadata', {
              sessionId: session.id,
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
          // Consumer-audit #3 — if metadata is missing the session was
          // created malformed (checkout route should have required it).
          // We can't process the credit. Log loud so ops gets alerted
          // and returns 200 so Stripe doesn't retry an event that will
          // keep failing. The idempotency ledger still records the
          // event ID, so a replay after a checkout-route fix is a no-op.
          logger.error('stripe.webhook.missing_metadata_session', {
            sessionId: session.id,
            eventId: event.id,
            hasPurchaseId: !!purchaseId,
            hasConsumerId: !!consumerId,
            hasToolId: !!toolId,
            hasAmountCents: !!amountCents,
            message: 'credit pack session completed but metadata was malformed — consumer paid but received no credit. Investigate via Stripe dashboard and reconcile manually.',
          })
          return successResponse({ received: true })
        }

        // Retry-safety (G3-5): wrap the purchase-status update + the credit
        // upsert (and its success log) in ONE tx, then delete the dedup
        // marker on failure and re-throw so Stripe's retry re-credits. The
        // tx also NARROWS DC-01: the purchases + balance writes become
        // atomic. The credit is the last write, but the logger.info goes
        // INSIDE the tx so a throwing log-meta rolls the credit back instead
        // of deleting-the-marker-after-commit → double-credit (DC-06).
        try {
          await db.transaction(async (tx) => {
            // Update purchase status to completed
            await tx
              .update(purchases)
              .set({
                status: 'completed',
                stripePaymentIntentId: typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null,
              })
              .where(eq(purchases.id, purchaseId))

            // Upsert consumer tool balance: add credits
            const [existingBalance] = await tx
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
              await tx
                .update(consumerToolBalances)
                .set({
                  balanceCents: sql`${consumerToolBalances.balanceCents} + ${amountCents}`,
                })
                .where(eq(consumerToolBalances.id, existingBalance.id))
            } else {
              // Create new balance record
              await tx
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
          })
        } catch (handlerErr) {
          await db
            .delete(processedWebhookEvents)
            .where(eq(processedWebhookEvents.eventId, event.id))
            .catch((delErr) => {
              logger.error(
                'stripe.webhook.dedup_delete_failed',
                { eventId: event.id, eventType: event.type },
                delErr as Error,
              )
            })
          throw handlerErr
        }

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
          const normalizedTier = normalizeTier(plan)
          await db
            .update(developers)
            .set({
              tier: normalizedTier,
              // Progressive take rate — calculated dynamically at payout time. See lib/pricing.ts
              updatedAt: new Date(),
            })
            .where(eq(developers.id, developerId))

          logger.info('stripe.webhook.subscription_updated', {
            developerId,
            plan: normalizedTier,
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
                // Progressive take rate — calculated dynamically at payout time. See lib/pricing.ts
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

      // ── Transfer reconciliation events (P5.PAYOUTS-CLEANUP-3) ─────
      //
      // We send transfers to connected accounts via stripe.transfers.create
      // in lib/payouts/process.ts. These webhooks are the "Stripe says
      // it really did happen" / "Stripe reversed it" signals that close
      // the network-timeout double-pay loophole introduced when we
      // started writing 'unknown' status on indeterminate Stripe errors.
      //
      // metadata.payoutId is the join key (set in processPayout). Empty
      // metadata means the transfer was created elsewhere (operator in
      // Stripe Dashboard, third-party tooling, etc.) — ack and ignore.
      //
      // Each handler wraps state changes in a single tx with FOR UPDATE
      // on the payout row. State transitions are idempotent (replays
      // see the row already in target state and no-op naturally).
      //
      // Critical retry-safety mechanism: the global event-id idempotency
      // gate at the top of this route (line ~115) commits BEFORE the
      // switch runs. If a handler tx throws AFTER the eventId is
      // recorded, Stripe's retry would hit the dedup gate and skip the
      // handler permanently — state lost. Each transfer.* handler wraps
      // its work in try/catch and deletes the eventId on failure so
      // retries can replay.

      case 'transfer.created': {
        try {
          const transfer = event.data.object as Stripe.Transfer
          const payoutId = transfer.metadata?.payoutId
          if (!payoutId) {
            logger.info('stripe.webhook.transfer_created_no_payout_id', {
              transferId: transfer.id,
            })
            break
          }
          await db.transaction(async (tx) => {
            const [row] = await tx
              .select({
                id: payouts.id,
                status: payouts.status,
                developerId: payouts.developerId,
                amountCents: payouts.amountCents,
                platformFeeCents: payouts.platformFeeCents,
                stripeTransferId: payouts.stripeTransferId,
              })
              .from(payouts)
              .where(eq(payouts.id, payoutId))
              .for('update')
              .limit(1)
            if (!row) {
              logger.warn('stripe.webhook.transfer_created_unknown_payout_id', {
                transferId: transfer.id,
                payoutId,
              })
              return
            }
            switch (row.status) {
              case 'completed':
              case 'reconciled':
                // Idempotent replay — the row already reflects this
                // transfer, no-op.
                logger.info('stripe.webhook.transfer_created_idempotent', {
                  payoutId,
                  transferId: transfer.id,
                  status: row.status,
                })
                return
              case 'unknown':
              case 'processing':
                // Stripe is confirming the transfer. Promote to
                // 'completed' and record the transfer id (in case the
                // 'unknown' write happened before the Stripe call
                // resolved with the id).
                await tx
                  .update(payouts)
                  .set({
                    status: 'completed',
                    stripeTransferId: transfer.id,
                  })
                  .where(eq(payouts.id, payoutId))
                logger.info('stripe.webhook.transfer_created_reconciled', {
                  payoutId,
                  transferId: transfer.id,
                  fromStatus: row.status,
                })
                return
              case 'failed': {
                // Critical: we previously rolled back believing the
                // transfer failed, but Stripe is now confirming it
                // happened. Re-debit balance and mark 'reconciled'.
                //
                // Overdraw guard: read current balance INSIDE the tx
                // (FOR UPDATE), compute the underflow delta if any,
                // then UPDATE with GREATEST(... - grossCents, 0)
                // clamp. Surface the underflow in the log so ops can
                // record the platform's receivable claim. Without
                // logging the delta, money loss is silent.
                const grossCents = row.amountCents + row.platformFeeCents
                const [currentDev] = await tx
                  .select({ balanceCents: developers.balanceCents })
                  .from(developers)
                  .where(eq(developers.id, row.developerId))
                  .for('update')
                  .limit(1)
                const currentBalanceCents = currentDev?.balanceCents ?? 0
                const underflowCents = Math.max(0, grossCents - currentBalanceCents)
                await tx
                  .update(developers)
                  .set({
                    balanceCents: sql`GREATEST(${developers.balanceCents} - ${grossCents}, 0)`,
                    updatedAt: new Date(),
                  })
                  .where(eq(developers.id, row.developerId))
                await tx
                  .update(payouts)
                  .set({
                    status: 'reconciled',
                    stripeTransferId: transfer.id,
                    errorMessage:
                      'reconciled: rollback was incorrect; transfer.created webhook confirmed transfer succeeded',
                  })
                  .where(eq(payouts.id, payoutId))
                logger.error(
                  'stripe.webhook.transfer_created_after_failed_rollback',
                  {
                    payoutId,
                    transferId: transfer.id,
                    grossCents,
                    currentBalanceCents,
                    underflowCents,
                    developerId: row.developerId,
                    message:
                      underflowCents > 0
                        ? `rollback was wrong; balance underflowed by ${underflowCents}c (clamped to 0; platform-side receivable)`
                        : 'rollback was wrong; balance re-debited cleanly',
                  },
                )
                return
              }
              default:
                logger.warn('stripe.webhook.transfer_created_unexpected_state', {
                  payoutId,
                  transferId: transfer.id,
                  status: row.status,
                })
            }
          })
        } catch (handlerErr) {
          // Clear the dedup marker so Stripe's retry can replay this
          // event — otherwise the global gate would skip it.
          await db
            .delete(processedWebhookEvents)
            .where(eq(processedWebhookEvents.eventId, event.id))
            .catch((delErr) => {
              logger.error(
                'stripe.webhook.dedup_delete_failed',
                { eventId: event.id, eventType: event.type },
                delErr as Error,
              )
            })
          throw handlerErr
        }
        break
      }

      case 'transfer.reversed': {
        try {
          const transfer = event.data.object as Stripe.Transfer
          const payoutId = transfer.metadata?.payoutId
          if (!payoutId) {
            logger.info('stripe.webhook.transfer_reversed_no_payout_id', {
              transferId: transfer.id,
            })
            break
          }
          await db.transaction(async (tx) => {
            const [row] = await tx
              .select({
                id: payouts.id,
                status: payouts.status,
                developerId: payouts.developerId,
                amountCents: payouts.amountCents,
                platformFeeCents: payouts.platformFeeCents,
              })
              .from(payouts)
              .where(eq(payouts.id, payoutId))
              .for('update')
              .limit(1)
            if (!row) {
              logger.warn('stripe.webhook.transfer_reversed_unknown_payout_id', {
                transferId: transfer.id,
                payoutId,
              })
              return
            }
            // Refund applies whenever balance is currently considered
            // debited (i.e., we previously took it out of the dev's
            // pool to pay them via Stripe). That covers:
            //   - 'completed' / 'reconciled': dev was paid, balance
            //      stays at 0; reversal returns it to the dev
            //   - 'unknown': we MARKED 'unknown' WITHOUT refund (the
            //      whole point of 'unknown' is "Stripe may have paid;
            //      don't refund yet"). The reversal confirms Stripe
            //      DID pay AND then reversed — so we now know the dev
            //      was paid then unpaid, net zero. Refund balance.
            //   - 'processing': in-flight; refund balance defensively.
            // 'failed' or other: no-op, the rollback already refunded.
            const refundableStatuses = ['completed', 'reconciled', 'unknown', 'processing']
            if (refundableStatuses.includes(row.status)) {
              const grossCents = row.amountCents + row.platformFeeCents
              await tx
                .update(developers)
                .set({
                  balanceCents: sql`${developers.balanceCents} + ${grossCents}`,
                  updatedAt: new Date(),
                })
                .where(eq(developers.id, row.developerId))
              await tx
                .update(payouts)
                .set({
                  status: 'failed',
                  errorMessage: `reversed: stripe transfer ${transfer.id} reversed`,
                })
                .where(eq(payouts.id, payoutId))
              logger.warn('stripe.webhook.transfer_reversed_handled', {
                payoutId,
                transferId: transfer.id,
                refundedCents: grossCents,
                fromStatus: row.status,
              })
            } else {
              logger.info('stripe.webhook.transfer_reversed_no_op', {
                payoutId,
                transferId: transfer.id,
                status: row.status,
              })
            }
          })
        } catch (handlerErr) {
          await db
            .delete(processedWebhookEvents)
            .where(eq(processedWebhookEvents.eventId, event.id))
            .catch((delErr) => {
              logger.error(
                'stripe.webhook.dedup_delete_failed',
                { eventId: event.id, eventType: event.type },
                delErr as Error,
              )
            })
          throw handlerErr
        }
        break
      }

      case 'transfer.updated': {
        // Observability only — Stripe may emit this for fee/metadata
        // changes. No DB state change required; just log so the event
        // shows up in our dashboards.
        const transfer = event.data.object as Stripe.Transfer
        logger.info('stripe.webhook.transfer_updated', {
          transferId: transfer.id,
          payoutId: transfer.metadata?.payoutId,
          amount: transfer.amount,
        })
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
