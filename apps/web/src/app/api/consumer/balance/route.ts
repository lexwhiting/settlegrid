import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerToolBalances, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'

export async function GET(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const balances = await db
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
      .limit(500)

    return successResponse({ balances })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
