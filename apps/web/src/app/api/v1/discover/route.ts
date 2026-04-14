import { NextRequest } from 'next/server'
import { eq, and, desc, asc, ilike, or, sql, inArray, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tools, developers, toolReviews } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getEffectiveCostCents } from '@/lib/pricing-utils'
import { logger } from '@/lib/logger'

export const maxDuration = 60

// ─── Parameter Validation ─────────────────────────────────────────────────────

const SORT_VALUES = ['popular', 'newest', 'name', 'price', 'price_desc', 'rating'] as const

const discoverParamsSchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(SORT_VALUES).default('popular'),
  max_cost: z.coerce.number().int().min(0).optional(),
  min_rating: z.coerce.number().min(1).max(5).optional(),
  verified_only: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

/**
 * GET /api/v1/discover — Public tool discovery API
 *
 * Query params:
 *   q             — search query (name, description, slug)
 *   category      — filter by category slug
 *   limit         — results per page (1-100, default 20)
 *   offset        — pagination offset (default 0)
 *   sort          — 'popular' | 'newest' | 'name' | 'price' | 'price_desc' | 'rating'
 *   max_cost      — maximum cost in cents per call (filters out unpriced tools)
 *   min_rating    — minimum average rating (1-5)
 *   verified_only — 'true' to only return verified tools
 *
 * No auth required. Rate limited by IP.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const rawParams: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      rawParams[key] = value
    }

    const parsed = discoverParamsSchema.safeParse(rawParams)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : ''
        return `${path}${e.message}`
      })
      return errorResponse(`Invalid parameters: ${messages.join('; ')}`, 400, 'VALIDATION_ERROR')
    }

    const { q, category, limit, offset, sort, max_cost, min_rating, verified_only } = parsed.data

    // ─── Build WHERE conditions ─────────────────────────────────────────────
    // P2.INTL2 marketplace inclusion rule (kept in sync with the marketplace
    // UI at apps/web/src/app/marketplace/marketplace-content.tsx so the public
    // discovery API and the marketplace UI never disagree about which tools
    // are "discoverable"):
    //   - 'active'   (live, callable)         — always included
    //   - 'unclaimed' (indexed, discoverable) — always included
    //   - 'draft'    (claimed, not yet monetized) — included only if the
    //     developer opted in via tools.listedInMarketplace=true. Set true
    //     by the claim flow; pre-P2.INTL2 drafts default to false via the
    //     0001_listed_in_marketplace migration backfill.
    // Canonical pure-function mirror: lib/marketplace-visibility.ts
    const conditions: SQL[] = [
      or(
        inArray(tools.status, ['active', 'unclaimed']),
        and(eq(tools.status, 'draft'), eq(tools.listedInMarketplace, true)),
      )!,
    ]

    if (category) {
      conditions.push(eq(tools.category, category))
    }

    if (q) {
      const pattern = `%${q}%`
      conditions.push(
        or(
          ilike(tools.name, pattern),
          ilike(tools.description, pattern),
          ilike(tools.slug, pattern),
        )!,
      )
    }

    if (verified_only) {
      conditions.push(eq(tools.verified, true))
    }

    // ─── Subquery for average rating ────────────────────────────────────────
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

    // ─── Determine sort order ───────────────────────────────────────────────
    const orderBy =
      sort === 'newest'
        ? desc(tools.createdAt)
        : sort === 'name'
          ? asc(tools.name)
          : sort === 'price'
            ? sql`(${tools.pricingConfig}->>'defaultCostCents')::int ASC NULLS LAST`
            : sort === 'price_desc'
              ? sql`(${tools.pricingConfig}->>'defaultCostCents')::int DESC NULLS LAST`
              : sort === 'rating'
                ? sql`coalesce((
                    select avg(${toolReviews.rating})::numeric(2,1)
                    from ${toolReviews}
                    where ${toolReviews.toolId} = ${tools.id}
                  ), 0) DESC`
                : desc(tools.totalInvocations) // 'popular' (default)

    // ─── Execute query ──────────────────────────────────────────────────────
    const results = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        tags: tools.tags,
        status: tools.status,
        version: tools.currentVersion,
        pricing: tools.pricingConfig,
        invocations: tools.totalInvocations,
        verified: tools.verified,
        developer: developers.name,
        developerSlug: developers.slug,
        createdAt: tools.createdAt,
        averageRating: avgRatingSql,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(and(...conditions))

    // ─── Post-query: apply max_cost filter ──────────────────────────────────
    // We filter in-app rather than SQL because pricing extraction requires
    // parsing the jsonb pricingConfig through our 6-model logic.
    let filtered = results.map((t) => {
      const costCents = getEffectiveCostCents(t.pricing)
      return {
        name: t.name,
        slug: t.slug,
        description: t.description,
        category: t.category,
        tags: t.tags,
        status: t.status,
        version: t.version,
        pricing: t.status === 'active' ? t.pricing : null,
        costCents: t.status === 'active' ? costCents : null,
        invocations: t.invocations,
        verified: t.verified,
        averageRating: Number(t.averageRating),
        developer: t.developer,
        developerSlug: t.developerSlug,
        url: `https://settlegrid.ai/tools/${t.slug}`,
        developerUrl: t.developerSlug ? `https://settlegrid.ai/dev/${t.developerSlug}` : null,
      }
    })

    let costFilteredCount = 0
    if (max_cost !== undefined) {
      const before = filtered.length
      filtered = filtered.filter((t) => t.costCents !== null && t.costCents <= max_cost)
      costFilteredCount = before - filtered.length
    }

    const adjustedTotal = max_cost !== undefined ? count - costFilteredCount : count

    logger.info('discover.query', {
      q: q ?? null,
      category: category ?? null,
      sort,
      max_cost: max_cost ?? null,
      min_rating: min_rating ?? null,
      verified_only: verified_only ?? false,
      resultCount: filtered.length,
      totalCount: adjustedTotal,
    })

    return successResponse({
      tools: filtered,
      total: adjustedTotal,
      limit,
      offset,
      hasMore: offset + limit < adjustedTotal,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
