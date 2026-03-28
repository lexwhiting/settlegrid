import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, ilike, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tools, developers, toolReviews } from '@/lib/db/schema'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getEffectiveCostCents } from '@/lib/pricing-utils'
import { logger } from '@/lib/logger'

export const maxDuration = 60

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 60
const MAX_ALTERNATIVES = 3
const MAX_FALLBACK_CHAIN = 10

// ─── Parameter Validation ─────────────────────────────────────────────────────

const routeParamsSchema = z.object({
  q: z.string().trim().min(1, 'Search query is required'),
  max_cost: z.coerce.number().int().min(0).optional(),
  min_rating: z.coerce.number().min(1).max(5).optional(),
  category: z.string().trim().optional(),
  verified_only: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  fallback: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

// ─── In-memory response cache ─────────────────────────────────────────────────

interface CacheEntry {
  response: Record<string, unknown>
  expiresAt: number
}

const routeCache = new Map<string, CacheEntry>()
const MAX_CACHE_ENTRIES = 500

function getCacheKey(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return `route:${sorted}`
}

function getFromCache(key: string): Record<string, unknown> | null {
  const entry = routeCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    routeCache.delete(key)
    return null
  }
  return entry.response
}

function setCache(key: string, response: Record<string, unknown>): void {
  // Evict oldest entries if cache is full
  if (routeCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = routeCache.keys().next().value
    if (firstKey) routeCache.delete(firstKey)
  }
  routeCache.set(key, {
    response,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  })
}

// ─── Tool Result Type ─────────────────────────────────────────────────────────

interface ToolResult {
  name: string
  slug: string
  description: string | null
  category: string | null
  tags: unknown
  version: string
  pricing: unknown
  costCents: number | null
  invocations: number
  verified: boolean
  averageRating: number
  developer: string | null
  developerSlug: string | null
  url: string
  developerUrl: string | null
}

/**
 * GET /api/v1/discover/route — Cost-based tool routing endpoint
 *
 * Returns the SINGLE best tool for a query, optimizing for lowest cost
 * above quality thresholds. This is SettleGrid's core moat: routing
 * agents to the cheapest tool that meets their requirements.
 *
 * Query params:
 *   q             — search query (required)
 *   max_cost      — maximum cost in cents per call
 *   min_rating    — minimum average rating (1-5)
 *   category      — filter by category slug
 *   verified_only — 'true' to only consider verified tools
 *   fallback      — 'true' to return ordered fallback chain
 *
 * Selection logic:
 *   1. Filter by query match (name, description, slug)
 *   2. Filter by max_cost and min_rating
 *   3. Select cheapest among remaining
 *   4. Break ties by highest rating
 *   5. Return winner + top 3 alternatives
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover-route:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const rawParams: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      rawParams[key] = value
    }

    const parsed = routeParamsSchema.safeParse(rawParams)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : ''
        return `${path}${e.message}`
      })
      return errorResponse(`Invalid parameters: ${messages.join('; ')}`, 400, 'VALIDATION_ERROR')
    }

    const { q, max_cost, min_rating, category, verified_only, fallback } = parsed.data

    // ─── Check cache ────────────────────────────────────────────────────────
    const cacheKey = getCacheKey(rawParams)
    const cached = getFromCache(cacheKey)
    if (cached) {
      logger.info('discover.route.cache_hit', { q, cacheKey })
      return NextResponse.json(cached, {
        status: 200,
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      })
    }

    // ─── Build WHERE conditions ─────────────────────────────────────────────
    const conditions: SQL[] = [eq(tools.status, 'active')]

    if (category) {
      conditions.push(eq(tools.category, category))
    }

    const pattern = `%${q}%`
    conditions.push(
      or(
        ilike(tools.name, pattern),
        ilike(tools.description, pattern),
        ilike(tools.slug, pattern),
      )!,
    )

    if (verified_only) {
      conditions.push(eq(tools.verified, true))
    }

    // Subquery for average rating
    const avgRatingSql = sql<number>`coalesce((
      select avg(${toolReviews.rating})::numeric(2,1)
      from ${toolReviews}
      where ${toolReviews.toolId} = ${tools.id}
    ), 0)`

    // Apply min_rating filter via correlated subquery
    if (min_rating !== undefined) {
      conditions.push(
        sql`coalesce((
          select avg(${toolReviews.rating})::numeric(2,1)
          from ${toolReviews}
          where ${toolReviews.toolId} = ${tools.id}
        ), 0) >= ${min_rating}`,
      )
    }

    // ─── Fetch candidates ───────────────────────────────────────────────────
    // Fetch a generous batch (up to 100) so we can apply cost filtering in-app.
    const CANDIDATE_LIMIT = 100

    const results = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        tags: tools.tags,
        version: tools.currentVersion,
        pricing: tools.pricingConfig,
        invocations: tools.totalInvocations,
        verified: tools.verified,
        developer: developers.name,
        developerSlug: developers.slug,
        averageRating: avgRatingSql,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(...conditions))
      .orderBy(desc(tools.totalInvocations))
      .limit(CANDIDATE_LIMIT)

    // ─── Extract costs and filter ───────────────────────────────────────────
    let candidates: ToolResult[] = results.map((t) => {
      const costCents = getEffectiveCostCents(t.pricing)
      return {
        name: t.name,
        slug: t.slug,
        description: t.description,
        category: t.category,
        tags: t.tags,
        version: t.version,
        pricing: t.pricing,
        costCents,
        invocations: t.invocations,
        verified: t.verified,
        averageRating: Number(t.averageRating),
        developer: t.developer,
        developerSlug: t.developerSlug,
        url: `https://settlegrid.ai/tools/${t.slug}`,
        developerUrl: t.developerSlug ? `https://settlegrid.ai/dev/${t.developerSlug}` : null,
      }
    })

    // Filter by max_cost: exclude tools with unknown pricing or cost above threshold
    if (max_cost !== undefined) {
      candidates = candidates.filter((t) => t.costCents !== null && t.costCents <= max_cost)
    }

    // ─── No matches ─────────────────────────────────────────────────────────
    if (candidates.length === 0) {
      const emptyResponse: Record<string, unknown> = fallback
        ? {
            chain: [],
            message: 'No tools match the specified criteria. Try broadening your search, increasing max_cost, or lowering min_rating.',
          }
        : {
            tool: null,
            alternatives: [],
            routing: {
              selectedBy: 'no_match',
              costCents: null,
              rating: null,
              alternativeCount: 0,
            },
            message: 'No tools match the specified criteria. Try broadening your search, increasing max_cost, or lowering min_rating.',
          }

      logger.info('discover.route.no_match', {
        q,
        max_cost: max_cost ?? null,
        min_rating: min_rating ?? null,
        candidatesBeforeFilter: results.length,
      })

      setCache(cacheKey, emptyResponse)
      return NextResponse.json(emptyResponse, {
        status: 200,
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      })
    }

    // ─── Sort: cheapest first, break ties by highest rating ─────────────────
    candidates.sort((a, b) => {
      // Tools with known cost first, unknown cost last
      if (a.costCents === null && b.costCents === null) return 0
      if (a.costCents === null) return 1
      if (b.costCents === null) return -1
      // Cheapest first
      if (a.costCents !== b.costCents) return a.costCents - b.costCents
      // Tie-break: highest rated first
      return b.averageRating - a.averageRating
    })

    // ─── Fallback chain mode ────────────────────────────────────────────────
    if (fallback) {
      const chain = candidates.slice(0, MAX_FALLBACK_CHAIN).map((t, i) => ({
        tool: t,
        costCents: t.costCents,
        priority: i + 1,
      }))

      const chainResponse: Record<string, unknown> = { chain }

      logger.info('discover.route.fallback', {
        q,
        max_cost: max_cost ?? null,
        min_rating: min_rating ?? null,
        chainLength: chain.length,
      })

      setCache(cacheKey, chainResponse)
      return NextResponse.json(chainResponse, {
        status: 200,
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      })
    }

    // ─── Single-best mode ───────────────────────────────────────────────────
    const winner = candidates[0]
    const alternatives = candidates.slice(1, 1 + MAX_ALTERNATIVES)

    const selectedBy =
      max_cost !== undefined && min_rating !== undefined
        ? 'cheapest_above_rating_threshold'
        : max_cost !== undefined
          ? 'cheapest_under_budget'
          : min_rating !== undefined
            ? 'cheapest_above_rating'
            : 'cheapest_overall'

    const routingResponse: Record<string, unknown> = {
      tool: winner,
      alternatives,
      routing: {
        selectedBy,
        costCents: winner.costCents,
        rating: winner.averageRating,
        alternativeCount: alternatives.length,
      },
    }

    logger.info('discover.route.routed', {
      q,
      max_cost: max_cost ?? null,
      min_rating: min_rating ?? null,
      selectedBy,
      winnerSlug: winner.slug,
      winnerCost: winner.costCents,
      winnerRating: winner.averageRating,
      alternativeCount: alternatives.length,
      totalCandidates: candidates.length,
    })

    setCache(cacheKey, routingResponse)
    return NextResponse.json(routingResponse, {
      status: 200,
      headers: { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
