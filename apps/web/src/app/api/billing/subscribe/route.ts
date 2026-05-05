import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, ParseBodyError } from '@/lib/api'
import { getAppUrl } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getStripeClient } from '@/lib/rails'
import { withAutomaticTax } from '@/lib/stripe-tax'

export const maxDuration = 30

// ── Plan → Stripe Price ID mapping ──────────────────────────────────────────
// No fallback to legacy STRIPE_PRICE_STARTER — that footgun (silently
// charging $9 instead of $19 when STRIPE_PRICE_BUILDER was unset) shipped
// once and we don't want it to ship again. If BUILDER isn't set, the
// route returns INVALID_PLAN loudly.

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  builder: process.env.STRIPE_PRICE_BUILDER?.trim(),
  scale: process.env.STRIPE_PRICE_SCALE?.trim(),
}

/**
 * P2.TAX1 — billing-address collected BEFORE Checkout so Stripe Tax
 * has the address on the Stripe Customer record at rate-calculation
 * time (and so reconciliation can attribute the charge to a
 * jurisdiction even if Stripe's hosted UI later lets the customer
 * override it). All fields except country are optional to stay
 * backwards-compatible with the pre-TAX1 signup UI; when the whole
 * address is missing the route still works via
 * `billing_address_collection: 'required'` on the Checkout Session
 * (Stripe's hosted form collects it). The TWO paths are intentional:
 *
 *   - UI-collected path (preferred): the signup form POSTs the
 *     full address; we update the Stripe Customer before creating
 *     the Checkout Session. Rate is known BEFORE the customer sees
 *     Stripe's hosted page.
 *
 *   - Fallback path (backstop): no address in the body; Stripe's
 *     hosted form collects it; Stripe Tax calculates at checkout.
 *
 * Either way, no charge is ever created without an address — the
 * Checkout Session ALWAYS has billing_address_collection: required.
 */
const billingAddressSchema = z
  .object({
    // ISO-3166 alpha-2 country code. Required because Stripe Tax
    // needs at least the country to calculate the rate.
    country: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, 'country must be a 2-letter ISO-3166 alpha-2 code'),
    line1: z.string().trim().max(200).optional(),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postal_code: z.string().trim().max(20).optional(),
  })
  .optional()

const subscribeSchema = z.object({
  plan: z.enum(['builder', 'scale']),
  billing_address: billingAddressSchema,
})

/** POST /api/billing/subscribe — create a Stripe Checkout session for plan subscription */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `billing-subscribe:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, subscribeSchema)

    const priceId = PLAN_PRICE_IDS[body.plan]
    if (!priceId) {
      return errorResponse('Invalid plan.', 400, 'INVALID_PLAN')
    }

    // Fetch developer record to check for existing customer/subscription
    const [developer] = await db
      .select({
        stripeCustomerId: developers.stripeCustomerId,
        stripeSubscriptionId: developers.stripeSubscriptionId,
        isFoundingMember: developers.isFoundingMember,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    // Founding Members get Scale-tier features for free — no subscription needed
    if (developer.isFoundingMember) {
      return successResponse({
        message: 'You are a Founding Member with lifetime free access to all features. No subscription needed.',
        foundingMember: true,
      })
    }

    // If developer already has an active subscription, direct them to manage portal instead
    if (developer.stripeSubscriptionId) {
      return errorResponse(
        'You already have an active subscription. Use the Manage Subscription option to change plans.',
        400,
        'EXISTING_SUBSCRIPTION'
      )
    }

    const stripe = getStripeClient()
    let stripeCustomerId = developer.stripeCustomerId

    // Create or reuse Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        metadata: { developerId: auth.id },
        // P2.TAX1 — stamp the billing address on the Stripe Customer
        // at creation time so Stripe Tax has it available BEFORE the
        // Checkout Session is rendered. Omitted when the signup UI
        // didn't collect it (backwards-compat path).
        ...(body.billing_address
          ? {
              address: {
                country: body.billing_address.country,
                line1: body.billing_address.line1,
                line2: body.billing_address.line2,
                city: body.billing_address.city,
                state: body.billing_address.state,
                postal_code: body.billing_address.postal_code,
              },
            }
          : {}),
      })
      stripeCustomerId = customer.id

      await db
        .update(developers)
        .set({ stripeCustomerId })
        .where(eq(developers.id, auth.id))
    } else if (body.billing_address) {
      // Re-using an existing Stripe Customer — update its address so
      // Stripe Tax uses the freshly-collected value. A customer who
      // moves jurisdictions between plan attempts sees the new rate
      // immediately. No-op when body.billing_address is absent.
      await stripe.customers.update(stripeCustomerId, {
        address: {
          country: body.billing_address.country,
          line1: body.billing_address.line1,
          line2: body.billing_address.line2,
          city: body.billing_address.city,
          state: body.billing_address.state,
          postal_code: body.billing_address.postal_code,
        },
      })
    }

    const appUrl = getAppUrl()

    // P2.TAX1 — wrap checkout params with withAutomaticTax() so the
    // session enables Stripe Tax, requires a billing address (so
    // Stripe can pick the right rate), and enables tax_id_collection
    // for EU B2B reverse-charge. ALL subscription checkout paths
    // MUST go through this helper — creating a session without it
    // is a compliance bug (SettleGrid would charge Builder/Scale at
    // the gross amount without remitting VAT).
    const session = await stripe.checkout.sessions.create(
      withAutomaticTax({
        customer: stripeCustomerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${appUrl}/dashboard/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/dashboard/settings?subscription=cancelled`,
        metadata: {
          developerId: auth.id,
          plan: body.plan,
        },
        subscription_data: {
          metadata: {
            developerId: auth.id,
            plan: body.plan,
          },
        },
      }),
    )

    logger.info('billing.subscribe.checkout_created', {
      developerId: auth.id,
      plan: body.plan,
      sessionId: session.id,
    })

    return successResponse({ checkoutUrl: session.url }, 201)
  } catch (error) {
    // P2.TAX1 — surface validation errors (bad billing_address, bad
    // plan, malformed body) as 400 instead of 500. ParseBodyError
    // carries its own statusCode and a 'VALIDATION_ERROR' tag.
    if (error instanceof ParseBodyError) {
      return errorResponse(error.message, error.statusCode, 'VALIDATION_ERROR')
    }
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error('billing.subscribe.error', { message: msg, stack })
    // Return the actual error message in development/test to aid debugging
    return errorResponse(msg, 500, 'SUBSCRIBE_ERROR')
  }
}
