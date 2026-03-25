import { NextRequest } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, toolReviews, toolChangelogs } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * GET /api/v1/discover/:slug — Get full details for a specific tool
 *
 * No auth required. Rate limited by IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover-tool:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params

    const [tool] = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        tags: tools.tags,
        version: tools.currentVersion,
        pricing: tools.pricingConfig,
        invocations: tools.totalInvocations,
        developer: developers.name,
        developerSlug: developers.slug,
        developerBio: developers.publicBio,
        createdAt: tools.createdAt,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found', 404, 'NOT_FOUND')
    }

    // Fetch recent reviews (only visible)
    const reviews = await db
      .select({
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(and(eq(tools.slug, slug), eq(toolReviews.status, 'visible')))
      .orderBy(desc(toolReviews.createdAt))
      .limit(10)

    // Fetch recent changelog
    const changelog = await db
      .select({
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        createdAt: toolChangelogs.createdAt,
      })
      .from(toolChangelogs)
      .innerJoin(tools, eq(toolChangelogs.toolId, tools.id))
      .where(eq(tools.slug, slug))
      .orderBy(desc(toolChangelogs.createdAt))
      .limit(5)

    return successResponse({
      tool: {
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        category: tool.category,
        tags: tool.tags,
        version: tool.version,
        pricing: tool.pricing,
        invocations: tool.invocations,
        developer: tool.developer,
        developerSlug: tool.developerSlug,
        developerBio: tool.developerBio,
        url: `https://settlegrid.ai/tools/${tool.slug}`,
        developerUrl: tool.developerSlug ? `https://settlegrid.ai/dev/${tool.developerSlug}` : null,
        reviews,
        changelog,
        quickStart: {
          install: 'npm install @settlegrid/mcp',
          usage: `import SettleGrid from '@settlegrid/mcp'\nconst sg = SettleGrid.init({ apiKey: 'YOUR_KEY' })\nconst result = await sg.call('${tool.slug}', 'method_name', { ...params })`,
        },
        createdAt: tool.createdAt,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
