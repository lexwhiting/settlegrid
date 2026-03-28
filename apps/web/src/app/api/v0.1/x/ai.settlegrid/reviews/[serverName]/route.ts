import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolReviews } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { extractSlugFromServerName, buildServerName } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX, MAX_RECENT_REVIEWS } from '@/lib/mcp-registry/constants'
import {
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isServerNameLengthValid,
} from '@/lib/mcp-registry/helpers'
import type { ReviewsResponse, ReviewEntry } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/**
 * GET /api/v0.1/x/ai.settlegrid/reviews/[serverName]
 *
 * Returns review aggregates and recent reviews for an MCP server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverName: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:reviews:${ip}`)
    if (!rl.success) {
      return mcpErrorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { serverName: rawServerName } = await params

    let serverName: string
    try {
      serverName = decodeURIComponent(rawServerName)
    } catch {
      return mcpErrorResponse('Malformed URL encoding in server name', 400, 'INVALID_ENCODING')
    }

    if (!isServerNameLengthValid(serverName)) {
      return mcpErrorResponse('Server name exceeds maximum length', 400, 'INVALID_SERVER_NAME')
    }

    const slug = extractSlugFromServerName(serverName)
    if (!slug) {
      return mcpErrorResponse(
        'Invalid server name format. Expected "ai.settlegrid/{slug}".',
        400,
        'INVALID_SERVER_NAME',
      )
    }

    // Resolve tool
    const [tool] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return mcpErrorResponse(
        `Server "${serverName}" not found`,
        404,
        'NOT_FOUND',
      )
    }

    // Aggregates
    const [agg] = await db
      .select({
        avgRating: sql<number>`coalesce(avg(${toolReviews.rating})::numeric(3,2), 0)`,
        totalReviews: sql<number>`count(*)::int`,
        rating1: sql<number>`count(*) filter (where ${toolReviews.rating} = 1)::int`,
        rating2: sql<number>`count(*) filter (where ${toolReviews.rating} = 2)::int`,
        rating3: sql<number>`count(*) filter (where ${toolReviews.rating} = 3)::int`,
        rating4: sql<number>`count(*) filter (where ${toolReviews.rating} = 4)::int`,
        rating5: sql<number>`count(*) filter (where ${toolReviews.rating} = 5)::int`,
      })
      .from(toolReviews)
      .where(and(eq(toolReviews.toolId, tool.id), eq(toolReviews.status, 'visible')))

    // Recent reviews
    const recentRows = await db
      .select({
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        developerResponse: toolReviews.developerResponse,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .where(and(eq(toolReviews.toolId, tool.id), eq(toolReviews.status, 'visible')))
      .orderBy(desc(toolReviews.createdAt))
      .limit(MAX_RECENT_REVIEWS)

    const recentReviews: readonly ReviewEntry[] = recentRows.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      developerResponse: r.developerResponse,
      createdAt: r.createdAt.toISOString(),
    }))

    const response: ReviewsResponse = {
      serverName: buildServerName(slug),
      averageRating: Number(agg?.avgRating ?? 0),
      totalReviews: agg?.totalReviews ?? 0,
      ratingDistribution: {
        '1': agg?.rating1 ?? 0,
        '2': agg?.rating2 ?? 0,
        '3': agg?.rating3 ?? 0,
        '4': agg?.rating4 ?? 0,
        '5': agg?.rating5 ?? 0,
      },
      recentReviews,
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.reviews_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
