import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 10

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `con-me:${ip}`)
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

    const [consumer] = await db
      .select({
        id: consumers.id,
        email: consumers.email,
        stripeCustomerId: consumers.stripeCustomerId,
        createdAt: consumers.createdAt,
      })
      .from(consumers)
      .where(eq(consumers.id, auth.id))
      .limit(1)

    if (!consumer) {
      return errorResponse('Consumer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({ consumer })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
