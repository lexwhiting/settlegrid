import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { purchases, tools, consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'

const PRESET_AMOUNTS = [500, 2000, 5000]
const MIN_CUSTOM_AMOUNT = 100
const MAX_CUSTOM_AMOUNT = 100000

const checkoutSchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
  amountCents: z
    .number()
    .int('Amount must be a whole number')
    .min(MIN_CUSTOM_AMOUNT, `Minimum amount is ${MIN_CUSTOM_AMOUNT} cents`)
    .max(MAX_CUSTOM_AMOUNT, `Maximum amount is ${MAX_CUSTOM_AMOUNT} cents`),
})

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

export async function POST(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, checkoutSchema)

    // Validate the amount: must be a preset OR within custom range
    if (!PRESET_AMOUNTS.includes(body.amountCents) && body.amountCents < MIN_CUSTOM_AMOUNT) {
      return errorResponse(
        `Amount must be one of ${PRESET_AMOUNTS.join(', ')} cents or at least ${MIN_CUSTOM_AMOUNT} cents.`,
        400,
        'INVALID_AMOUNT'
      )
    }

    // Verify tool exists and is active
    const [tool] = await db
      .select({ id: tools.id, name: tools.name, status: tools.status })
      .from(tools)
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (tool.status !== 'active') {
      return errorResponse('Tool is not active.', 400, 'TOOL_NOT_ACTIVE')
    }

    // Get or set Stripe customer ID
    const [consumer] = await db
      .select({ stripeCustomerId: consumers.stripeCustomerId })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    const stripe = getStripe()
    let stripeCustomerId = consumer?.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        metadata: { consumerId: auth.id },
      })
      stripeCustomerId = customer.id

      await db
        .update(consumers)
        .set({ stripeCustomerId })
        .where(eq(consumers.id, auth.id))
    }

    // Insert pending purchase record
    const [purchase] = await db
      .insert(purchases)
      .values({
        consumerId: auth.id,
        toolId: body.toolId,
        amountCents: body.amountCents,
        status: 'pending',
      })
      .returning({ id: purchases.id })

    const appUrl = getAppUrl()

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tool.name} — Credits`,
              description: `${(body.amountCents / 100).toFixed(2)} USD in API credits for ${tool.name}`,
            },
            unit_amount: body.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/dashboard/consumer?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/consumer?purchase=cancelled`,
      metadata: {
        purchaseId: purchase.id,
        consumerId: auth.id,
        toolId: body.toolId,
        amountCents: body.amountCents.toString(),
      },
    })

    // Update purchase with Stripe session ID
    await db
      .update(purchases)
      .set({ stripeSessionId: session.id })
      .where(eq(purchases.id, purchase.id))

    return successResponse({ checkoutUrl: session.url }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
