import { NextRequest } from 'next/server'
import { eq, and, sql, inArray, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  TOOL_BUNDLES,
  getBundlesForCategory,
  getBundlesForEcosystem,
  scoreBundleMatch,
  type ToolBundle,
} from '@/lib/tool-bundles'

export const maxDuration = 30

interface BundleToolPreview {
  id: string
  name: string
  slug: string
  description: string | null
  toolType: string
  category: string | null
  sourceEcosystem: string | null
  totalInvocations: number
}

interface BundleWithTools {
  slug: string
  title: string
  description: string
  suggestedDiscountPct: number
  tools: BundleToolPreview[]
  matchScore?: number
}

/**
 * GET /api/marketplace/bundles - Returns tool bundles with matching tools.
 *
 * Query params:
 *   - category: filter bundles by category affinity
 *   - ecosystem: filter bundles by ecosystem affinity
 *   - slug: get a specific bundle by slug
 *   - limit: max tools per bundle (default 6, max 20)
 *
 * Creates network effects by showing developers what tools complement theirs.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `bundles:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get('category')
    const ecosystemParam = searchParams.get('ecosystem')
    const slugParam = searchParams.get('slug')
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '6', 10) || 6, 1),
      20,
    )

    // Determine which bundles to return
    let bundlesToReturn: ReadonlyArray<ToolBundle>

    if (slugParam) {
      const bundle = TOOL_BUNDLES.find((b) => b.slug === slugParam)
      if (!bundle) {
        return errorResponse('Bundle not found.', 404, 'BUNDLE_NOT_FOUND')
      }
      bundlesToReturn = [bundle]
    } else if (categoryParam) {
      bundlesToReturn = getBundlesForCategory(categoryParam)
    } else if (ecosystemParam) {
      bundlesToReturn = getBundlesForEcosystem(ecosystemParam)
    } else {
      bundlesToReturn = TOOL_BUNDLES
    }

    // For each bundle, fetch matching tools from the database
    const results: BundleWithTools[] = []

    for (const bundle of bundlesToReturn) {
      const conditions: SQL[] = [eq(tools.status, 'active')]

      // Match by category affinities
      if (bundle.categoryAffinities.length > 0) {
        conditions.push(inArray(tools.category, [...bundle.categoryAffinities]))
      }

      const whereClause = and(...conditions)

      const matchingTools = await db
        .select({
          id: tools.id,
          name: tools.name,
          slug: tools.slug,
          description: tools.description,
          toolType: tools.toolType,
          category: tools.category,
          sourceEcosystem: tools.sourceEcosystem,
          totalInvocations: tools.totalInvocations,
        })
        .from(tools)
        .where(whereClause)
        .orderBy(sql`${tools.totalInvocations} DESC`)
        .limit(limitParam)

      // Score each tool against the bundle for relevance
      const scoredTools = matchingTools
        .map((tool) => ({
          ...tool,
          _score: scoreBundleMatch(tool.description ?? '', bundle),
        }))
        .sort((a, b) => b._score - a._score)

      const toolPreviews: BundleToolPreview[] = scoredTools.map(
        ({ _score: _, ...tool }) => tool,
      )

      results.push({
        slug: bundle.slug,
        title: bundle.title,
        description: bundle.description,
        suggestedDiscountPct: bundle.suggestedDiscountPct,
        tools: toolPreviews,
      })
    }

    return successResponse({
      bundles: results,
      total: results.length,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
