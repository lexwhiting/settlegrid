import { NextRequest, NextResponse } from 'next/server'
import type { AP2AgentCard } from '@/lib/settlement/ap2/types'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 5

const AGENT_CARD: AP2AgentCard = {
  name: 'SettleGrid Settlement',
  description:
    'AI settlement layer -- payment method management and credential issuance for autonomous agent commerce.',
  url: 'https://api.settlegrid.ai/a2a',
  skills: [
    'get_eligible_payment_methods',
    'provision_credentials',
    'process_payment',
    'verify_intent_mandate',
    'verify_cart_mandate',
  ],
  extensions: ['https://github.com/google-agentic-commerce/ap2/tree/v0.1'],
  ap2_roles: ['credentials-provider'],
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `a2a:card:${ip}`)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  return NextResponse.json(AGENT_CARD, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
