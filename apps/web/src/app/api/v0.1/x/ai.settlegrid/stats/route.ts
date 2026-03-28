import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolChangelogs } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
} from '@/lib/mcp-registry/helpers'
import type { RegistryStatsResponse } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/**
 * GET /api/v0.1/x/ai.settlegrid/stats
 *
 * Returns aggregate statistics for the SettleGrid MCP sub-registry.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:stats:${ip}`)
    if (!rl.success) {
      return mcpErrorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Run aggregate queries in parallel
    const [serversResult, versionsResult, developersResult, invocationsResult] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(tools)
          .where(eq(tools.status, 'active')),
        db.select({ count: sql<number>`count(*)::int` }).from(toolChangelogs),
        db
          .select({ count: sql<number>`count(distinct ${tools.developerId})::int` })
          .from(tools)
          .where(eq(tools.status, 'active')),
        db
          .select({ total: sql<number>`coalesce(sum(${tools.totalInvocations}), 0)::int` })
          .from(tools)
          .where(eq(tools.status, 'active')),
      ])

    const response: RegistryStatsResponse = {
      totalServers: serversResult[0]?.count ?? 0,
      totalVersions: versionsResult[0]?.count ?? 0,
      totalDevelopers: developersResult[0]?.count ?? 0,
      totalInvocations: invocationsResult[0]?.total ?? 0,
      lastUpdated: new Date().toISOString(),
      _links: {
        servers: 'https://settlegrid.ai/api/v0.1/servers',
        categories: 'https://settlegrid.ai/api/v1/discover/categories',
        docs: 'https://settlegrid.ai/docs',
      },
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.stats_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
