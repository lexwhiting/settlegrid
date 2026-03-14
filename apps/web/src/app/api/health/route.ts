import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getHealthRedisUrl, getHealthRedisToken } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `health:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }
    const components: Record<string, { status: string; latencyMs?: number }> = {}
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check database connectivity
    const dbStart = Date.now()
    try {
      await db.execute(sql`SELECT 1`)
      components.database = { status: 'healthy', latencyMs: Date.now() - dbStart }
    } catch {
      components.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart }
      overallStatus = 'unhealthy'
    }

    // Check Redis (Upstash) connectivity
    const redisStart = Date.now()
    try {
      const redisUrl = getHealthRedisUrl()
      if (redisUrl) {
        // Simple ping via REST API (Upstash pattern)
        const res = await fetch(`${redisUrl}/ping`, {
          headers: { Authorization: `Bearer ${getHealthRedisToken()}` },
          signal: AbortSignal.timeout(3000),
        })
        components.redis = {
          status: res.ok ? 'healthy' : 'degraded',
          latencyMs: Date.now() - redisStart,
        }
        if (!res.ok && overallStatus === 'healthy') overallStatus = 'degraded'
      } else {
        components.redis = { status: 'not_configured' }
      }
    } catch {
      components.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart }
      if (overallStatus === 'healthy') overallStatus = 'degraded'
    }

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

    return successResponse({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
    }, statusCode)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
