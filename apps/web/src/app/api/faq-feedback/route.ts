import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 5

const feedbackSchema = z.object({
  question: z.string().min(1).max(500),
  helpful: z.boolean(),
  pageUrl: z.string().url().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `faq-feedback:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, feedbackSchema)

    logger.info('faq.feedback', {
      question: body.question,
      helpful: body.helpful,
      pageUrl: body.pageUrl,
    })

    return successResponse({ success: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
