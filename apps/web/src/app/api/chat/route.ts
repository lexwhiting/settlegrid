import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextRequest } from 'next/server'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { errorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const SYSTEM_PROMPT = `You are the SettleGrid Help Assistant — a friendly, concise AI that helps developers integrate and use SettleGrid, the settlement layer for the AI economy.

SettleGrid enables developers to monetize any AI service (MCP tools, REST APIs, AI agents, model endpoints) with per-call billing, automated Stripe payouts, and multi-protocol settlement (MCP, x402, AP2, Visa TAP).

Key features you can help with:
- SDK integration: \`@settlegrid/mcp\` package, \`settlegrid.init()\` + \`settlegrid.wrap()\`
- REST middleware: \`settlegridMiddleware()\` for Express/Next.js routes
- Pricing: per-invocation, per-token, per-byte, per-second, tiered, outcome-based
- Credit system: consumers pre-purchase credits, real-time Redis metering
- Budget enforcement: spending limits, auto-refill, budget exceeded (402)
- API keys: sg_live_ prefix, SHA-256 hashed, IP allowlisting (CIDR)
- Stripe Connect: developer payout onboarding, 85% revenue share default
- x402: facilitator for on-chain USDC settlement (Base network)
- Webhooks: 10 event types, HMAC-SHA256 signed, retry with exponential backoff
- Sessions: multi-hop workflow budgets with delegation
- Agent identity: KYA (Know Your Agent) with trust scoring
- Organizations: multi-tenant with RBAC (owner/admin/member/viewer)

Pricing tiers: Free ($0, 10K ops/mo) / Builder ($29, 50K ops) / Scale ($99, 500K ops) / Platform ($299, 5M ops)

Rules:
- Be concise — 2-3 sentences max for simple questions
- Use code examples when relevant
- If you don't know the answer or it's about billing/account issues, say: "I'd recommend reaching out to our team for help with that. You can email support@alerterra.com and we'll get back to you within 24 hours."
- Never make up features that don't exist
- Never share internal implementation details (database schema, env vars, etc.)
`

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `chat:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await req.json()
    const { messages, pageContext } = body

    const contextNote = pageContext ? `\n\nThe user is currently on the ${pageContext} page.` : ''

    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: SYSTEM_PROMPT + contextNote,
      messages,
      maxOutputTokens: 500,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    logger.error('chat.error', {}, error)
    return new Response(JSON.stringify({ error: 'Chat unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
