import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, processedWebhookEvents } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getStripeConnectWebhookSecret } from '@/lib/env'
import { sdkLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getStripeClient } from '@/lib/rails'

export const maxDuration = 60

/**
 * Connect-mode Stripe webhook — separate endpoint from the platform-mode
 * /api/billing/webhook because Stripe issues per-endpoint signing secrets
 * and the Connect-events toggle was not available on the existing
 * platform endpoint at the time this was provisioned.
 *
 * Subscribed events (configured in Stripe Dashboard for this endpoint):
 *   - payout.failed (connected account) — connected developer's bank
 *     rejected the deposit Stripe sent. Flip stripeConnectStatus to
 *     'needs_reconnect' so the cron stops sending transfers and the
 *     dashboard surfaces a reconnect CTA.
 *
 * Idempotency uses the same processedWebhookEvents table as the platform
 * endpoint — Stripe event IDs are globally unique across endpoints so
 * one ledger covers both.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(sdkLimiter, `billing-webhook-connect:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const webhookSecret = getStripeConnectWebhookSecret()?.trim()
    if (!webhookSecret) {
      logger.error('stripe.connect_webhook.not_configured', {
        message:
          'STRIPE_CONNECT_WEBHOOK_SECRET is not set. Configure it in your environment to enable Connect-mode billing webhooks.',
      })
      return errorResponse(
        'Connect webhooks are not configured. Set STRIPE_CONNECT_WEBHOOK_SECRET in your environment.',
        503,
        'NOT_CONFIGURED',
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
      logger.error('stripe.connect_webhook.signature_failed', { reason: message })
      return errorResponse('Invalid webhook signature.', 400, 'INVALID_SIGNATURE')
    }

    // Idempotency gate — same pattern + same table as the platform
    // endpoint. ON CONFLICT DO NOTHING + RETURNING gives an atomic
    // claim: rows.length === 0 means the event was already processed.
    try {
      const insertedRows = await db
        .insert(processedWebhookEvents)
        .values({ eventId: event.id, source: 'stripe-connect', eventType: event.type })
        .onConflictDoNothing({ target: processedWebhookEvents.eventId })
        .returning({ eventId: processedWebhookEvents.eventId })

      if (insertedRows.length === 0) {
        logger.info('stripe.connect_webhook.duplicate_event_skipped', {
          eventId: event.id,
          eventType: event.type,
        })
        return successResponse({ received: true, duplicate: true })
      }
    } catch (err) {
      logger.error(
        'stripe.connect_webhook.idempotency_ledger_failed',
        { eventId: event.id, eventType: event.type },
        err,
      )
      return errorResponse('Idempotency ledger unavailable.', 503, 'IDEMPOTENCY_UNAVAILABLE')
    }

    switch (event.type) {
      case 'payout.failed': {
        // Connected-account payout.failed: Stripe successfully sent
        // funds to the developer's Stripe balance, then the developer's
        // BANK rejected the subsequent payout from Stripe → bank.
        // Surface this immediately so the cron stops trying and the
        // dashboard prompts the developer to update bank details.
        //
        // Retry-safety: the global event-id idempotency gate above
        // commits BEFORE this handler runs. If the handler throws, the
        // dedup row is deleted in the catch so Stripe's retry replays.
        try {
          const payout = event.data.object as Stripe.Payout
          const accountId = event.account
          if (!accountId) {
            logger.warn('stripe.connect_webhook.payout_failed_no_account', {
              eventId: event.id,
              payoutId: payout.id,
            })
            break
          }
          await db.transaction(async (tx) => {
            const [dev] = await tx
              .select({
                id: developers.id,
                email: developers.email,
                stripeConnectStatus: developers.stripeConnectStatus,
              })
              .from(developers)
              .where(eq(developers.stripeConnectId, accountId))
              .for('update')
              .limit(1)

            if (!dev) {
              logger.warn('stripe.connect_webhook.payout_failed_unknown_account', {
                eventId: event.id,
                accountId,
                payoutId: payout.id,
              })
              return
            }

            if (dev.stripeConnectStatus === 'needs_reconnect') {
              logger.info('stripe.connect_webhook.payout_failed_already_flagged', {
                developerId: dev.id,
                accountId,
                payoutId: payout.id,
              })
              return
            }

            await tx
              .update(developers)
              .set({
                stripeConnectStatus: 'needs_reconnect',
                updatedAt: new Date(),
              })
              .where(eq(developers.id, dev.id))

            logger.error('stripe.connect_webhook.payout_failed', {
              developerId: dev.id,
              email: dev.email,
              accountId,
              payoutId: payout.id,
              failureCode: payout.failure_code,
              failureMessage: payout.failure_message,
              amount: payout.amount,
              currency: payout.currency,
            })
          })
        } catch (handlerErr) {
          await db
            .delete(processedWebhookEvents)
            .where(eq(processedWebhookEvents.eventId, event.id))
            .catch((delErr) => {
              logger.error(
                'stripe.connect_webhook.dedup_delete_failed',
                { eventId: event.id, eventType: event.type },
                delErr as Error,
              )
            })
          throw handlerErr
        }
        break
      }

      default:
        // Unhandled event type — Connect endpoints can be subscribed to
        // a wider event surface than we currently process. ACK + log so
        // we have visibility into what Stripe is sending.
        logger.info('stripe.connect_webhook.unhandled_event', {
          type: event.type,
          eventId: event.id,
          accountId: event.account,
        })
    }

    return successResponse({ received: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
