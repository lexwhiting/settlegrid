import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, consumers, purchases } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { z } from 'zod'

export const maxDuration = 60

const purchaseSchema = z.object({
  slug: z.string().min(1).max(200),
})

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey())
}

/**
 * POST /api/templates/purchase — creates a Stripe checkout session for a premium template.
 * On successful payment, the consumer gets download access.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `template-purchase:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    let parsed: z.infer<typeof purchaseSchema>
    try {
      parsed = await parseBody(request, purchaseSchema)
    } catch (err) {
      if (err instanceof ParseBodyError) {
        return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
      }
      return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
    }

    const { slug } = parsed

    // Find the template
    const [template] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        isPremium: tools.isPremium,
        premiumPriceCents: tools.premiumPriceCents,
        status: tools.status,
      })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'template')))
      .limit(1)

    if (!template) {
      return errorResponse('Template not found.', 404, 'NOT_FOUND')
    }

    if (!template.isPremium || !template.premiumPriceCents || template.premiumPriceCents <= 0) {
      return errorResponse('This template is free and does not require purchase.', 400, 'NOT_PREMIUM')
    }

    // Check if already purchased
    const [existing] = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.consumerId, auth.id),
          eq(purchases.toolId, template.id),
          eq(purchases.status, 'completed'),
        ),
      )
      .limit(1)

    if (existing) {
      return errorResponse('You have already purchased this template.', 409, 'ALREADY_PURCHASED')
    }

    // Get or create Stripe customer
    const [consumer] = await db
      .select({
        stripeCustomerId: consumers.stripeCustomerId,
        email: consumers.email,
      })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    if (!consumer) {
      return errorResponse('Consumer not found.', 404, 'NOT_FOUND')
    }

    const stripe = getStripe()
    const appUrl = getAppUrl()

    let customerId = consumer.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: consumer.email,
        metadata: { consumerId: auth.id, source: 'template-purchase' },
      })
      customerId = customer.id

      await db
        .update(consumers)
        .set({ stripeCustomerId: customerId })
        .where(eq(consumers.id, auth.id))
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: template.premiumPriceCents,
            product_data: {
              name: `Premium Template: ${template.name}`,
              description: `One-time purchase for the ${template.name} template on SettleGrid.`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'template_purchase',
        consumerId: auth.id,
        toolId: template.id,
        templateSlug: template.slug,
      },
      success_url: `${appUrl}/templates?purchase=success&template=${template.slug}`,
      cancel_url: `${appUrl}/templates?purchase=cancelled`,
    })

    logger.info('templates.purchase.checkout_created', {
      consumerId: auth.id,
      templateSlug: template.slug,
      sessionId: session.id,
    })

    return successResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
