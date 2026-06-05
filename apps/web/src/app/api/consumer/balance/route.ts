import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerToolBalances, consumers, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `balance:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // Fetch per-tool balances in parallel with the global balance so the
    // consumer dashboard has a complete picture without a second round-trip
    // (consumer-audit #15).
    const [balances, consumerRow] = await Promise.all([
      db
        .select({
          id: consumerToolBalances.id,
          toolId: consumerToolBalances.toolId,
          balanceCents: consumerToolBalances.balanceCents,
          autoRefill: consumerToolBalances.autoRefill,
          autoRefillAmountCents: consumerToolBalances.autoRefillAmountCents,
          autoRefillThresholdCents: consumerToolBalances.autoRefillThresholdCents,
          toolName: tools.name,
          toolSlug: tools.slug,
        })
        .from(consumerToolBalances)
        .innerJoin(tools, eq(consumerToolBalances.toolId, tools.id))
        .where(eq(consumerToolBalances.consumerId, auth.id))
        .limit(500),
      db
        .select({ globalBalanceCents: consumers.globalBalanceCents })
        .from(consumers)
        .where(eq(consumers.id, auth.id))
        .limit(1),
    ])

    const globalBalanceCents = consumerRow[0]?.globalBalanceCents ?? 0

    return successResponse({ balances, globalBalanceCents })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
