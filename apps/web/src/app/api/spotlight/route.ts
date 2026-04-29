import { NextRequest } from 'next/server'
import { desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/** Redis key for the current spotlight tool */
const SPOTLIGHT_REDIS_KEY = 'spotlight:current'

/** Spotlight TTL: 8 days (refreshed weekly by weekly-report cron) */
const SPOTLIGHT_TTL_SECONDS = 8 * 24 * 60 * 60

interface SpotlightTool {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  toolType: string
  totalInvocations: number
}

/**
 * GET /api/spotlight — returns the current Tool of the Week.
 *
 * The spotlight tool is set by the weekly-report cron and cached in Redis.
 * If no spotlight is cached, falls back to the top tool by invocations.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `spotlight:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const redis = getRedis()

    // Try Redis cache first
    const cached = await redis.get<string>(SPOTLIGHT_REDIS_KEY)
    if (cached) {
      try {
        const parsed: SpotlightTool = typeof cached === 'string' ? JSON.parse(cached) : cached
        return successResponse({ spotlight: parsed, source: 'cache' })
      } catch {
        // Invalid cache, fall through to DB
      }
    }

    // Fallback: query top tool by invocations
    const [topTool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        toolType: tools.toolType,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(inArray(tools.status, ['active']))
      .orderBy(desc(tools.totalInvocations))
      .limit(1)

    if (!topTool) {
      return successResponse({ spotlight: null })
    }

    // Cache in Redis for next requests
    const spotlightData: SpotlightTool = {
      id: topTool.id,
      name: topTool.name,
      slug: topTool.slug,
      description: topTool.description,
      category: topTool.category,
      toolType: topTool.toolType,
      totalInvocations: topTool.totalInvocations,
    }

    await redis.set(SPOTLIGHT_REDIS_KEY, JSON.stringify(spotlightData), {
      ex: SPOTLIGHT_TTL_SECONDS,
    })

    return successResponse({ spotlight: spotlightData, source: 'db' })
  } catch (error) {
    logger.error('spotlight.error', {}, error)
    return internalErrorResponse(error)
  }
}

