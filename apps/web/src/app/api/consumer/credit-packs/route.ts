import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody, ParseBodyError } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'
import { z } from 'zod'

export const maxDuration = 60

// ─── Credit Pack Definitions ─────────────────────────────────────────────────

interface CreditPack {
  id: string
  label: string
  creditAmountCents: number
  priceCents: number
  discountPct: number
}

const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_100',
    label: '$100 Credit Pack',
    creditAmountCents: 10000,
    priceCents: 9500,   // $95 (5% off)
    discountPct: 5,
  },
  {
    id: 'pack_500',
    label: '$500 Credit Pack',
    creditAmountCents: 50000,
    priceCents: 45000,  // $450 (10% off)
    discountPct: 10,
  },
  {
    id: 'pack_1000',
    label: '$1000 Credit Pack',
    creditAmountCents: 100000,
    priceCents: 85000,  // $850 (15% off)
    discountPct: 15,
  },
]

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey())
}

const purchaseSchema = z.object({
  packId: z.enum(['pack_100', 'pack_500', 'pack_1000']),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/consumer/credit-packs — returns available credit packs with pricing.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-credit-packs:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    return successResponse({
      packs: CREDIT_PACKS.map((pack) => ({
        id: pack.id,
        label: pack.label,
        creditAmountCents: pack.creditAmountCents,
        creditAmountDisplay: `$${(pack.creditAmountCents / 100).toFixed(2)}`,
        priceCents: pack.priceCents,
        priceDisplay: `$${(pack.priceCents / 100).toFixed(2)}`,
        discountPct: pack.discountPct,
        savingsCents: pack.creditAmountCents - pack.priceCents,
        savingsDisplay: `$${((pack.creditAmountCents - pack.priceCents) / 100).toFixed(2)}`,
      })),
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * POST /api/consumer/credit-packs — creates a Stripe checkout session for a credit pack.
 * Returns the checkout URL for redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-credit-packs-buy:${ip}`)
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

    const { packId } = parsed
    const pack = CREDIT_PACKS.find((p) => p.id === packId)
    if (!pack) {
      return errorResponse('Invalid pack ID.', 400, 'INVALID_PACK')
    }

    // Get consumer's Stripe customer ID or create one
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
        metadata: { consumerId: auth.id, source: 'credit-pack' },
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
            unit_amount: pack.priceCents,
            product_data: {
              name: pack.label,
              description: `$${(pack.creditAmountCents / 100).toFixed(2)} in SettleGrid credits (${pack.discountPct}% discount)`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'credit_pack',
        consumerId: auth.id,
        packId: pack.id,
        creditAmountCents: String(pack.creditAmountCents),
      },
      success_url: `${appUrl}/consumer?purchase=success&pack=${pack.id}`,
      cancel_url: `${appUrl}/consumer?purchase=cancelled`,
    })

    logger.info('consumer.credit_pack.checkout_created', {
      consumerId: auth.id,
      packId: pack.id,
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
