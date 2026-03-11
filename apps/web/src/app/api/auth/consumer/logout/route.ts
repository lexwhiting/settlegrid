import { NextRequest } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 10

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `con-logout:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const response = successResponse({ message: 'Logged out successfully.' })
    return clearSessionCookie(response)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
