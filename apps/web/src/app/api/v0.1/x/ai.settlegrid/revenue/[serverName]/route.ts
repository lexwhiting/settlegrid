import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { extractSlugFromServerName, buildServerName } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isServerNameLengthValid,
} from '@/lib/mcp-registry/helpers'
import type { RevenueResponse } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/**
 * GET /api/v0.1/x/ai.settlegrid/revenue/[serverName]
 *
 * Returns invocation and revenue stats for an MCP server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverName: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:revenue:${ip}`)
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

    const [tool] = await db
      .select({
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        verified: tools.verified,
        category: tools.category,
      })
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

    const response: RevenueResponse = {
      serverName: buildServerName(slug),
      totalInvocations: tool.totalInvocations,
      totalRevenueCents: tool.totalRevenueCents,
      verified: tool.verified,
      category: tool.category,
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.revenue_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
