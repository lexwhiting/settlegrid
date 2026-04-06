import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

const UNSUBSCRIBE_PREFIX = 'unsub:outreach:'

/**
 * POST /api/unsubscribe
 * Records an email address in the suppression list.
 * The claim-outreach cron checks this before sending.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !email.includes('@') || email.length > 254) {
      return errorResponse('Invalid email address.', 400, 'INVALID_EMAIL')
    }

    const redis = getRedis()
    // Permanent suppression — no TTL
    await redis.set(`${UNSUBSCRIBE_PREFIX}${email}`, '1')

    logger.info('unsubscribe.recorded', { email: email.slice(0, 3) + '***' })

    return successResponse({ unsubscribed: true })
  } catch (err) {
    logger.error('unsubscribe.failed', {}, err)
    return errorResponse('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR')
  }
}

/**
 * GET /api/unsubscribe?email=...
 * Also supports GET for direct link clicks from emails.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''

    if (!email || !email.includes('@') || email.length > 254) {
      return errorResponse('Invalid email address.', 400, 'INVALID_EMAIL')
    }

    const redis = getRedis()
    await redis.set(`${UNSUBSCRIBE_PREFIX}${email}`, '1')

    logger.info('unsubscribe.recorded_via_get', { email: email.slice(0, 3) + '***' })

    return successResponse({ unsubscribed: true })
  } catch (err) {
    logger.error('unsubscribe.get_failed', {}, err)
    return errorResponse('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR')
  }
}
