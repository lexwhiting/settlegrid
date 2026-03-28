import { NextRequest } from 'next/server'
import { eq, and, gt, gte, ilike, or, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { mapToolToServerDetail } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  parseUpdatedSince,
  escapeLikePattern,
  sanitizeSearch,
  validateCategory,
  sanitizeTag,
} from '@/lib/mcp-registry/helpers'
import type { ServerListResponse } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * GET /api/v0.1/servers — List MCP servers (paginated)
 *
 * Query params:
 *   cursor        — opaque base64 cursor (from previous response)
 *   limit         — results per page (1-100, default 20)
 *   search        — substring match on name, description, slug
 *   category      — filter by category slug
 *   tag           — filter by tag (exact match within tags array)
 *   verified      — filter by verification status ('true'/'false')
 *   updated_since — ISO 8601 datetime filter
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:servers:${ip}`)
    if (!rl.success) {
      return mcpErrorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const cursorRaw = searchParams.get('cursor')?.trim() ?? null
    const limit = clampLimit(searchParams.get('limit'))
    const search = sanitizeSearch(searchParams.get('search'))
    const categoryRaw = searchParams.get('category')?.trim() ?? null
    const tag = sanitizeTag(searchParams.get('tag'))
    const verifiedParam = searchParams.get('verified')?.trim() ?? null
    const updatedSinceRaw = searchParams.get('updated_since')?.trim() ?? null

    // Validate cursor
    let cursorId: string | null = null
    if (cursorRaw) {
      cursorId = decodeCursor(cursorRaw)
      if (!cursorId) {
        return mcpErrorResponse('Invalid cursor format', 400, 'INVALID_CURSOR')
      }
    }

    // Validate updated_since
    const updatedSince = parseUpdatedSince(updatedSinceRaw)
    if (updatedSinceRaw && !updatedSince) {
      return mcpErrorResponse(
        'Invalid updated_since format. Use ISO 8601 (e.g. 2025-01-01T00:00:00Z)',
        400,
        'INVALID_DATE',
      )
    }

    // Build conditions
    const conditions: SQL[] = [eq(tools.status, 'active')]

    if (cursorId) {
      conditions.push(gt(tools.id, cursorId))
    }

    if (search) {
      const escaped = escapeLikePattern(search)
      const pattern = `%${escaped}%`
      conditions.push(
        or(
          ilike(tools.name, pattern),
          ilike(tools.description, pattern),
          ilike(tools.slug, pattern),
        )!,
      )
    }

    // Validate category
    if (categoryRaw) {
      const catResult = validateCategory(categoryRaw)
      if (catResult && !catResult.valid) {
        return mcpErrorResponse(catResult.error, 400, 'INVALID_CATEGORY')
      }
      if (catResult?.valid) {
        conditions.push(eq(tools.category, catResult.value))
      }
    }

    if (tag) {
      // Filter tools whose tags jsonb array contains the given tag
      conditions.push(sql`${tools.tags}::jsonb ? ${tag}`)
    }

    if (verifiedParam === 'true') {
      conditions.push(eq(tools.verified, true))
    } else if (verifiedParam === 'false') {
      conditions.push(eq(tools.verified, false))
    }

    if (updatedSince) {
      conditions.push(gte(tools.updatedAt, updatedSince))
    }

    // Fetch limit + 1 to detect if there are more results
    const fetchLimit = limit + 1
    const results = await db
      .select({
        id: tools.id,
        slug: tools.slug,
        name: tools.name,
        description: tools.description,
        currentVersion: tools.currentVersion,
        pricingConfig: tools.pricingConfig,
        category: tools.category,
        tags: tools.tags,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        verified: tools.verified,
        healthEndpoint: tools.healthEndpoint,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
        developerName: developers.name,
        developerSlug: developers.slug,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(...conditions))
      .orderBy(desc(tools.updatedAt), tools.id)
      .limit(fetchLimit)

    const hasMore = results.length > limit
    const pageResults = hasMore ? results.slice(0, limit) : results
    const lastResult = pageResults[pageResults.length - 1]

    const servers = pageResults.map((row) =>
      mapToolToServerDetail(
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          currentVersion: row.currentVersion,
          pricingConfig: row.pricingConfig,
          category: row.category,
          tags: row.tags,
          status: row.status,
          totalInvocations: row.totalInvocations,
          totalRevenueCents: row.totalRevenueCents,
          verified: row.verified,
          healthEndpoint: row.healthEndpoint,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
        {
          name: row.developerName,
          slug: row.developerSlug,
        },
      ),
    )

    const response: ServerListResponse = {
      servers,
      metadata: {
        nextCursor: hasMore && lastResult ? encodeCursor(lastResult.id) : null,
        count: servers.length,
      },
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.servers_list_error', { endpoint: '/api/v0.1/servers' }, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
