import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getEligiblePaymentMethods,
  provisionCredentials,
  verifyIntentMandate,
  verifyCartMandate,
  processPayment,
} from '@/lib/settlement/ap2/credentials'
import type { IntentMandate, CartMandate, PaymentMandate } from '@/lib/settlement/ap2/types'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 15

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-settlegrid-protocol, x-ap2-mandate, x-ap2-consumer-id, x-request-id',
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const skillRequestSchema = z.object({
  skill: z.enum([
    'get_eligible_payment_methods',
    'provision_credentials',
    'process_payment',
    'verify_intent_mandate',
    'verify_cart_mandate',
  ]),
  params: z.record(z.unknown()),
  mandateRef: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `a2a:skills:${ip}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const parsed = skillRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { skill, params } = parsed.data

    switch (skill) {
      case 'get_eligible_payment_methods': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const balanceCents = typeof params.balanceCents === 'number' ? params.balanceCents : 0
        const hasStripeCard = typeof params.hasStripeCard === 'boolean' ? params.hasStripeCard : false
        const methods = getEligiblePaymentMethods(consumerId, balanceCents, hasStripeCard)
        return NextResponse.json({ success: true, data: { methods } }, { headers: CORS_HEADERS })
      }

      case 'provision_credentials': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const paymentMethodType = z
          .enum(['settlegrid_balance', 'stripe_card', 'usdc'])
          .parse(params.paymentMethodType)
        const amountCents = z.number().int().min(1).parse(params.amountCents)
        const currency = z.string().length(3).parse(params.currency ?? 'USD')
        const merchantId = z.string().parse(params.merchantId)

        const result = provisionCredentials(
          consumerId,
          paymentMethodType,
          amountCents,
          currency,
          merchantId
        )
        return NextResponse.json({ success: true, data: result }, { headers: CORS_HEADERS })
      }

      case 'verify_intent_mandate': {
        const mandate = params.mandate as IntentMandate
        const result = verifyIntentMandate(mandate)
        return NextResponse.json({ success: true, data: result }, { headers: CORS_HEADERS })
      }

      case 'verify_cart_mandate': {
        const mandate = params.mandate as CartMandate
        const result = verifyCartMandate(mandate)
        return NextResponse.json({ success: true, data: result }, { headers: CORS_HEADERS })
      }

      case 'process_payment': {
        const consumerId = z.string().uuid().parse(params.consumerId)
        const mandate = params.mandate as PaymentMandate
        const result = processPayment(consumerId, mandate)
        return NextResponse.json({ success: true, data: result }, { headers: CORS_HEADERS })
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown skill' }, { status: 400, headers: CORS_HEADERS })
    }
  } catch (err) {
    logger.error('a2a.skill_execution_failed', {}, err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
