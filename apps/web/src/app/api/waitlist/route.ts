import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { waitlistSignups } from '@/lib/db/schema'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const waitlistSchema = z.object({
  email: z.string().email('Invalid email address').max(320),
  feature: z.string().min(1).max(100).default('marketplace'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `waitlist:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, waitlistSchema)

    await db
      .insert(waitlistSignups)
      .values({
        email: body.email.toLowerCase().trim(),
        feature: body.feature,
      })
      .onConflictDoNothing({
        target: [waitlistSignups.email, waitlistSignups.feature],
      })

    return successResponse({ success: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
