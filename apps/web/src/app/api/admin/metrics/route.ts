import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  getToolsWithOrganicInvocations,
  getConsumerAccountsWithActivity,
  getSignupsByDay,
  getMRR,
  getReferralStats,
  getInvocationsThisMonth,
  getPaidSubscribers,
  getActiveTools,
  getTotalDevelopers,
} from '@/lib/analytics'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/**
 * GET /api/admin/metrics
 *
 * Returns the nuclear-expansion KPIs: MRR, organic traction,
 * referral funnel, signups-per-day, and leading indicators.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `admin-metrics:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      return errorResponse('Forbidden.', 403, 'FORBIDDEN')
    }

    // Run all analytics queries in parallel
    const [
      totalDevelopers,
      activeTools,
      paidSubscribers,
      mrr,
      invocationsThisMonth,
      organicTools7d,
      activeConsumers,
      referralStats,
      signupsByDay,
    ] = await Promise.all([
      getTotalDevelopers(),
      getActiveTools(),
      getPaidSubscribers(),
      getMRR(),
      getInvocationsThisMonth(),
      getToolsWithOrganicInvocations(7),
      getConsumerAccountsWithActivity(),
      getReferralStats(),
      getSignupsByDay(30),
    ])

    logger.info('admin.metrics_accessed', { email: auth.email })

    return successResponse({
      statsCards: {
        totalDevelopers,
        activeTools,
        paidSubscribers,
        mrrCents: mrr,
        invocationsThisMonth,
        organicToolsThisWeek: organicTools7d,
      },
      leadingIndicators: {
        activeConsumers,
        referralInvitesSent: referralStats.sent,
        referralConversions: referralStats.converted,
        referralConversionRate: referralStats.rate,
        badgeImpressions: null, // tracking coming soon
      },
      signupsByDay,
    })
  } catch (error) {
    logger.error('admin.metrics_failed', {}, error)
    return internalErrorResponse(error)
  }
}
