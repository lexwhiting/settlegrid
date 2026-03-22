import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `dev-me:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const [developer] = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        tier: developers.tier,
        revenueSharePct: developers.revenueSharePct,
        stripeConnectStatus: developers.stripeConnectStatus,
        balanceCents: developers.balanceCents,
        payoutSchedule: developers.payoutSchedule,
        payoutMinimumCents: developers.payoutMinimumCents,
        publicProfile: developers.publicProfile,
        publicBio: developers.publicBio,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({ developer })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
