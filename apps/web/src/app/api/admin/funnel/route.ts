/**
 * P5.1 — Admin GET /api/admin/funnel.
 *
 * Thin wrapper around `runFunnelQueries()`. Same auth pattern as
 * `/api/admin/launch-metrics`: rate-limited by IP, then
 * `requireDeveloper`, then ADMIN_EMAILS allowlist. Returns 403 to
 * non-admins.
 *
 * ## Cache
 *
 * `revalidate = 300` — one fresh PostHog round-trip every 5 minutes
 * at most. The dashboard polls less frequently than 5 minutes by
 * default (the funnel doesn't move minute-to-minute), so this is
 * mostly a guard against scripted spam.
 *
 * ## Empty / unconfigured state
 *
 * `runFunnelQueries()` returns `null` when `POSTHOG_PERSONAL_API_KEY`
 * or `POSTHOG_PROJECT_ID` isn't set. The route returns 200 with
 * `{ data: null, reason: 'not_configured' }` so the dashboard can
 * render "PostHog read keys not configured" rather than crashing.
 *
 * @packageDocumentation
 */
import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { runFunnelQueries, type FunnelData } from '@/lib/funnel-queries'

export const maxDuration = 30
/**
 * Cache for 5 minutes. Funnel numbers don't move minute-to-minute
 * and PostHog query cost adds up; the spec asked for 5min explicitly.
 */
export const revalidate = 300

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

interface FunnelResponse {
  data: FunnelData | null
  reason?: 'not_configured' | 'upstream_error'
  generatedAt: string
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `admin-funnel:${ip}`)
    if (!rateLimit.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      return errorResponse('Forbidden. Admin access required.', 403, 'FORBIDDEN')
    }

    let data: FunnelData | null = null
    let reason: FunnelResponse['reason']
    try {
      data = await runFunnelQueries({ days: 30 })
      if (data === null) reason = 'not_configured'
    } catch (err) {
      logger.warn('admin.funnel.upstream_failed', { error: String(err) })
      reason = 'upstream_error'
    }

    const payload: FunnelResponse = {
      data,
      reason,
      generatedAt: new Date().toISOString(),
    }
    logger.info('admin.funnel_accessed', { email: auth.email, hasData: !!data })
    return successResponse(payload)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
