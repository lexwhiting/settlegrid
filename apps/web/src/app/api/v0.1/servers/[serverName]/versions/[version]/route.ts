import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, toolReviews, toolChangelogs, developerReputation } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { mapToolToServerDetail, mapChangelogRow, extractSlugFromServerName } from '@/lib/mcp-registry/mapper'
import type { ReviewAggregateRow, ReputationRow } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isValidVersion,
  isServerNameLengthValid,
} from '@/lib/mcp-registry/helpers'
import type { ServerResponse } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * GET /api/v0.1/servers/[serverName]/versions/[version]
 *
 * Fetch a specific version of an MCP server detail.
 * serverName is URL-encoded `ai.settlegrid/{slug}`.
 * version can be "latest" or a specific semver string.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverName: string; version: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:server-detail:${ip}`)
    if (!rl.success) {
      return mcpErrorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { serverName: rawServerName, version: rawVersion } = await params

    let serverName: string
    let version: string
    try {
      serverName = decodeURIComponent(rawServerName)
      version = decodeURIComponent(rawVersion)
    } catch {
      return mcpErrorResponse('Malformed URL encoding in server name or version', 400, 'INVALID_ENCODING')
    }

    // Guard against excessively long server names
    if (!isServerNameLengthValid(serverName)) {
      return mcpErrorResponse('Server name exceeds maximum length', 400, 'INVALID_SERVER_NAME')
    }

    // Validate server name format
    const slug = extractSlugFromServerName(serverName)
    if (!slug) {
      return mcpErrorResponse(
        'Invalid server name format. Expected "ai.settlegrid/{slug}".',
        400,
        'INVALID_SERVER_NAME',
      )
    }

    // Validate version format
    if (!isValidVersion(version)) {
      return mcpErrorResponse(
        'Invalid version format. Expected "latest" or a semver string (e.g. "1.0.0").',
        400,
        'INVALID_VERSION',
      )
    }

    // Fetch tool with developer join
    const conditions = [eq(tools.slug, slug), eq(tools.status, 'active')]

    // If not "latest", filter by specific version
    if (version !== 'latest') {
      conditions.push(eq(tools.currentVersion, version))
    }

    const [toolRow] = await db
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
        developerId: tools.developerId,
        developerName: developers.name,
        developerSlug: developers.slug,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(...conditions))
      .limit(1)

    if (!toolRow) {
      const versionHint = version === 'latest' ? '' : ` at version ${version}`
      return mcpErrorResponse(
        `Server "${serverName}" not found${versionHint}`,
        404,
        'NOT_FOUND',
      )
    }

    // Fetch review aggregates
    const [reviewAgg] = await db
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
      .where(and(eq(toolReviews.toolId, toolRow.id), eq(toolReviews.status, 'visible')))

    const reviews: ReviewAggregateRow = {
      averageRating: Number(reviewAgg?.avgRating ?? 0),
      totalReviews: reviewAgg?.totalReviews ?? 0,
      ratingDistribution: {
        '1': reviewAgg?.rating1 ?? 0,
        '2': reviewAgg?.rating2 ?? 0,
        '3': reviewAgg?.rating3 ?? 0,
        '4': reviewAgg?.rating4 ?? 0,
        '5': reviewAgg?.rating5 ?? 0,
      },
    }

    // Fetch developer reputation
    let reputation: ReputationRow | null = null
    const [repRow] = await db
      .select({
        score: developerReputation.score,
        uptimePct: developerReputation.uptimePct,
        reviewAvg: developerReputation.reviewAvg,
        totalTools: developerReputation.totalTools,
        totalConsumers: developerReputation.totalConsumers,
      })
      .from(developerReputation)
      .where(eq(developerReputation.developerId, toolRow.developerId))
      .limit(1)

    if (repRow) {
      reputation = repRow
    }

    // Fetch changelogs
    const changelogRows = await db
      .select({
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        details: toolChangelogs.details,
        createdAt: toolChangelogs.createdAt,
      })
      .from(toolChangelogs)
      .where(eq(toolChangelogs.toolId, toolRow.id))
      .orderBy(desc(toolChangelogs.createdAt))
      .limit(50)

    const server = mapToolToServerDetail(
      {
        id: toolRow.id,
        slug: toolRow.slug,
        name: toolRow.name,
        description: toolRow.description,
        currentVersion: toolRow.currentVersion,
        pricingConfig: toolRow.pricingConfig,
        category: toolRow.category,
        tags: toolRow.tags,
        status: toolRow.status,
        totalInvocations: toolRow.totalInvocations,
        totalRevenueCents: toolRow.totalRevenueCents,
        verified: toolRow.verified,
        healthEndpoint: toolRow.healthEndpoint,
        createdAt: toolRow.createdAt,
        updatedAt: toolRow.updatedAt,
      },
      {
        name: toolRow.developerName,
        slug: toolRow.developerSlug,
      },
      reviews,
      reputation,
    )

    const changelog = changelogRows.map(mapChangelogRow)

    const response: ServerResponse = {
      server,
      changelog,
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.server_detail_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
