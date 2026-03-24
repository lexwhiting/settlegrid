import { NextRequest } from 'next/server'
import { eq, and, desc, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * GET /api/v1/discover — Public tool discovery API
 *
 * Query params:
 *   q        — search query (name, description, slug)
 *   category — filter by category slug
 *   limit    — results per page (1-100, default 20)
 *   offset   — pagination offset (default 0)
 *   sort     — 'popular' (default) | 'newest' | 'name'
 *
 * No auth required. Rate limited by IP.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const category = searchParams.get('category')?.trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
    const sort = searchParams.get('sort') ?? 'popular'

    const conditions: SQL[] = [eq(tools.status, 'active')]

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

    const orderBy =
      sort === 'newest' ? desc(tools.createdAt)
        : sort === 'name' ? tools.name
          : desc(tools.totalInvocations)

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
        developer: developers.name,
        developerSlug: developers.slug,
        createdAt: tools.createdAt,
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

    const formatted = results.map((t) => ({
      name: t.name,
      slug: t.slug,
      description: t.description,
      category: t.category,
      tags: t.tags,
      version: t.version,
      pricing: t.pricing,
      invocations: t.invocations,
      developer: t.developer,
      developerSlug: t.developerSlug,
      url: `https://settlegrid.ai/tools/${t.slug}`,
      developerUrl: t.developerSlug ? `https://settlegrid.ai/dev/${t.developerSlug}` : null,
    }))

    return successResponse({
      tools: formatted,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
