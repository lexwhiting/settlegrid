import { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { purchases, tools } from '@/lib/db/schema'
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

    const purchaseRecords = await db
      .select({
        id: purchases.id,
        toolId: purchases.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        amountCents: purchases.amountCents,
        stripeSessionId: purchases.stripeSessionId,
        status: purchases.status,
        createdAt: purchases.createdAt,
      })
      .from(purchases)
      .innerJoin(tools, eq(purchases.toolId, tools.id))
      .where(eq(purchases.consumerId, auth.id))
      .orderBy(desc(purchases.createdAt))
      .limit(100)

    return successResponse({ purchases: purchaseRecords })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
