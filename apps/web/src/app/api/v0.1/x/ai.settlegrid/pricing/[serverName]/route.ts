import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { extractSlugFromServerName, buildServerName, extractPricingTiers } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isServerNameLengthValid,
} from '@/lib/mcp-registry/helpers'
import type { PricingResponse, PricingMeta } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/**
 * GET /api/v0.1/x/ai.settlegrid/pricing/[serverName]
 *
 * Returns the full pricing configuration for an MCP server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverName: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:pricing:${ip}`)
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
        pricingConfig: tools.pricingConfig,
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

    const config = tool.pricingConfig
    let model: string | null = null
    if (config && typeof config === 'object' && 'model' in config) {
      const m = (config as Record<string, unknown>).model
      if (typeof m === 'string') model = m
    }

    const pricing: PricingMeta = {
      config,
      model,
      currency: 'USD',
    }

    const tiers = extractPricingTiers(config)

    const response: PricingResponse = {
      serverName: buildServerName(slug),
      pricing,
      tiers,
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.pricing_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
