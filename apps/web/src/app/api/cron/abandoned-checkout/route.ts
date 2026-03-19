import { NextRequest } from 'next/server'
import { eq, and, sql, isNull } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { purchases, consumers, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { sendEmail, abandonedCheckoutEmail } from '@/lib/email'
import { getCronSecret, getStripeSecretKey, getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

const MAX_REMINDERS_PER_RUN = 50

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

/**
 * Vercel Cron handler: sends abandoned checkout recovery emails.
 *
 * Finds purchases that are still 'pending' between 1 and 24 hours old
 * with no prior reminder sent, creates a fresh Stripe Checkout session,
 * and emails the consumer a link to complete their purchase.
 *
 * Only ONE reminder per purchase. Limited to 50 per run.
 * Schedule: every 15 minutes.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-abandoned-checkout:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.abandoned_checkout.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find pending purchases between 1-24 hours old with no reminder sent
    const abandonedPurchases = await db
      .select({
        id: purchases.id,
        consumerId: purchases.consumerId,
        toolId: purchases.toolId,
        amountCents: purchases.amountCents,
        consumerEmail: consumers.email,
        consumerStripeCustomerId: consumers.stripeCustomerId,
        toolName: tools.name,
        toolStatus: tools.status,
      })
      .from(purchases)
      .innerJoin(consumers, eq(purchases.consumerId, consumers.id))
      .innerJoin(tools, eq(purchases.toolId, tools.id))
      .where(
        and(
          eq(purchases.status, 'pending'),
          isNull(purchases.reminderSentAt),
          sql`${purchases.createdAt} <= ${oneHourAgo}`,
          sql`${purchases.createdAt} >= ${twentyFourHoursAgo}`
        )
      )
      .limit(MAX_REMINDERS_PER_RUN)

    if (abandonedPurchases.length === 0) {
      return successResponse({ reminded: 0 })
    }

    const stripe = getStripe()
    const appUrl = getAppUrl()
    let reminded = 0

    for (const purchase of abandonedPurchases) {
      try {
        // Skip if tool is no longer active
        if (purchase.toolStatus !== 'active') continue

        // Create a fresh Stripe Checkout session with the same parameters
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${purchase.toolName} — Credits`,
                  description: `${(purchase.amountCents / 100).toFixed(2)} USD in API credits for ${purchase.toolName}`,
                },
                unit_amount: purchase.amountCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${appUrl}/dashboard/consumer?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/dashboard/consumer?purchase=cancelled`,
          metadata: {
            purchaseId: purchase.id,
            consumerId: purchase.consumerId,
            toolId: purchase.toolId,
            amountCents: purchase.amountCents.toString(),
          },
        }

        // Attach Stripe customer if available
        if (purchase.consumerStripeCustomerId) {
          sessionParams.customer = purchase.consumerStripeCustomerId
        }

        const session = await stripe.checkout.sessions.create(sessionParams)

        // Update purchase with new Stripe session ID
        await db
          .update(purchases)
          .set({
            stripeSessionId: session.id,
            reminderSentAt: now,
          })
          .where(eq(purchases.id, purchase.id))

        // Fire-and-forget email
        sendEmail({
          to: purchase.consumerEmail,
          ...abandonedCheckoutEmail(
            purchase.consumerEmail,
            purchase.amountCents,
            purchase.toolName,
            session.url ?? `${appUrl}/dashboard/consumer`
          ),
        }).catch((err) => {
          logger.error('cron.abandoned_checkout.email_error', { purchaseId: purchase.id }, err)
        })

        reminded++
      } catch (err) {
        logger.error('cron.abandoned_checkout.purchase_error', { purchaseId: purchase.id }, err)
        // Continue processing remaining purchases
      }
    }

    logger.info('cron.abandoned_checkout.completed', {
      found: abandonedPurchases.length,
      reminded,
    })

    return successResponse({ reminded })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
