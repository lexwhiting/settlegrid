import { NextRequest } from 'next/server'
import { eq, and, gt, desc, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolChangelogs } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { extractSlugFromServerName, mapVersionRow } from '@/lib/mcp-registry/mapper'
import { RATE_LIMIT_PREFIX } from '@/lib/mcp-registry/constants'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  mcpSuccessResponse,
  mcpErrorResponse,
  mcpOptionsResponse,
  isServerNameLengthValid,
} from '@/lib/mcp-registry/helpers'
import type { VersionListResponse } from '@/lib/mcp-registry/types'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * GET /api/v0.1/servers/[serverName]/versions
 *
 * List all versions for an MCP server with cursor pagination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverName: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `${RATE_LIMIT_PREFIX}:versions:${ip}`)
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

    // Guard against excessively long server names
    if (!isServerNameLengthValid(serverName)) {
      return mcpErrorResponse('Server name exceeds maximum length', 400, 'INVALID_SERVER_NAME')
    }

    // Validate server name
    const slug = extractSlugFromServerName(serverName)
    if (!slug) {
      return mcpErrorResponse(
        'Invalid server name format. Expected "ai.settlegrid/{slug}".',
        400,
        'INVALID_SERVER_NAME',
      )
    }

    const { searchParams } = new URL(request.url)
    const cursorRaw = searchParams.get('cursor')?.trim() ?? null
    const limit = clampLimit(searchParams.get('limit'))

    // Validate cursor
    let cursorId: string | null = null
    if (cursorRaw) {
      cursorId = decodeCursor(cursorRaw)
      if (!cursorId) {
        return mcpErrorResponse('Invalid cursor format', 400, 'INVALID_CURSOR')
      }
    }

    // Resolve the tool first
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

    // Build changelog query conditions
    const conditions: SQL[] = [eq(toolChangelogs.toolId, tool.id)]
    if (cursorId) {
      conditions.push(gt(toolChangelogs.id, cursorId))
    }

    const fetchLimit = limit + 1
    const rows = await db
      .select({
        id: toolChangelogs.id,
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        details: toolChangelogs.details,
        createdAt: toolChangelogs.createdAt,
      })
      .from(toolChangelogs)
      .where(and(...conditions))
      .orderBy(desc(toolChangelogs.createdAt))
      .limit(fetchLimit)

    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    const lastRow = pageRows[pageRows.length - 1]

    const versions = pageRows.map((row) => mapVersionRow({
      version: row.version,
      changeType: row.changeType,
      summary: row.summary,
      details: row.details,
      createdAt: row.createdAt,
    }))

    const response: VersionListResponse = {
      versions,
      metadata: {
        nextCursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
        count: versions.length,
      },
    }

    return mcpSuccessResponse(response)
  } catch (error) {
    logger.error('mcp_registry.versions_list_error', {}, error)
    return mcpErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
