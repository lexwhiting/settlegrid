import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { writeAuditLog } from '@/lib/audit'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * POST /api/auth/developer/login-event
 *
 * Records an `auth.login` audit entry for a password sign-in. OAuth and email
 * link sign-ins are recorded in auth/callback; signInWithPassword runs in the
 * browser and never reaches the callback, so the login page calls this right
 * after a successful sign-in.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-login-event:${ip}`)
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

    const userRl = await checkRateLimit(apiLimiter, `dev-login-event:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    await writeAuditLog({
      developerId: auth.id,
      action: 'auth.login',
      resourceType: 'session',
      details: { provider: 'email', method: 'password' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return successResponse({ recorded: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
