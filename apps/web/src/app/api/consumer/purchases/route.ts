import { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { purchases, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

/** GET /api/consumer/purchases — list recent purchases for the authenticated consumer */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `consumer-purchases:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireConsumer(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `consumer-purchases:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const rows = await db
      .select({
        id: purchases.id,
        toolId: purchases.toolId,
        toolName: tools.name,
        amountCents: purchases.amountCents,
        stripePaymentIntentId: purchases.stripePaymentIntentId,
        status: purchases.status,
        createdAt: purchases.createdAt,
      })
      .from(purchases)
      .innerJoin(tools, eq(purchases.toolId, tools.id))
      .where(eq(purchases.consumerId, auth.id))
      .orderBy(desc(purchases.createdAt))
      .limit(50)

    return successResponse({ purchases: rows })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
