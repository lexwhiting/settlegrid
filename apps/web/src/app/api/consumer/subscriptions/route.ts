import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerToolBalances, tools, invocations, purchases } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/consumer/subscriptions — aggregated subscription hub */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-subs:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // All tool balances with tool info
    const toolBalances = await db
      .select({
        toolId: consumerToolBalances.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        balanceCents: consumerToolBalances.balanceCents,
        autoRefill: consumerToolBalances.autoRefill,
        spendingLimitCents: consumerToolBalances.spendingLimitCents,
        currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
      })
      .from(consumerToolBalances)
      .innerJoin(tools, eq(consumerToolBalances.toolId, tools.id))
      .where(eq(consumerToolBalances.consumerId, auth.id))
      .limit(200)

    // Total balance across all tools
    const totalBalanceCents = toolBalances.reduce((sum, t) => sum + t.balanceCents, 0)

    // Total spend (all-time purchases)
    const [spendStats] = await db
      .select({
        totalSpendCents: sql<number>`coalesce(sum(${purchases.amountCents}), 0)::int`,
      })
      .from(purchases)
      .where(sql`${purchases.consumerId} = ${auth.id} AND ${purchases.status} = 'completed'`)

    // Monthly spend trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlySpendTrend = await db
      .select({
        month: sql<string>`to_char(${invocations.createdAt}, 'YYYY-MM')`,
        spendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        invocationCount: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(
        sql`${invocations.consumerId} = ${auth.id} AND ${invocations.createdAt} >= ${sixMonthsAgo}`
      )
      .groupBy(sql`to_char(${invocations.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${invocations.createdAt}, 'YYYY-MM')`)
      .limit(6)

    return successResponse({
      tools: toolBalances,
      totalBalanceCents,
      totalSpendCents: spendStats?.totalSpendCents ?? 0,
      monthlySpendTrend,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
