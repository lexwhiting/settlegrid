import { NextRequest } from 'next/server'
import { eq, and, desc, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const VALID_TOOL_TYPES = [
  'mcp-server',
  'ai-model',
  'rest-api',
  'agent-tool',
  'automation',
  'extension',
  'dataset',
  'sdk-package',
] as const

const VALID_ECOSYSTEMS = [
  'mcp-registry',
  'pulsemcp',
  'smithery',
  'npm',
  'pypi',
  'huggingface',
  'replicate',
  'apify',
  'openrouter',
  'github',
] as const

const VALID_SORTS = ['popular', 'newest', 'revenue'] as const

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 24

/** GET /api/marketplace — public marketplace listing with filtering, search, and pagination */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `marketplace:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)

    // Parse query params
    const typeParam = searchParams.get('type')
    const categoryParam = searchParams.get('category')
    const ecosystemParam = searchParams.get('ecosystem')
    const statusParam = searchParams.get('status')
    const searchQuery = searchParams.get('q')
    const sortParam = searchParams.get('sort') ?? 'popular'
    const pageParam = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1)
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    )

    // Validate type
    if (typeParam && !VALID_TOOL_TYPES.includes(typeParam as (typeof VALID_TOOL_TYPES)[number])) {
      return errorResponse(
        `Invalid type. Must be one of: ${VALID_TOOL_TYPES.join(', ')}`,
        400,
        'INVALID_TYPE'
      )
    }

    // Validate ecosystem
    if (ecosystemParam && !VALID_ECOSYSTEMS.includes(ecosystemParam as (typeof VALID_ECOSYSTEMS)[number])) {
      return errorResponse(
        `Invalid ecosystem. Must be one of: ${VALID_ECOSYSTEMS.join(', ')}`,
        400,
        'INVALID_ECOSYSTEM'
      )
    }

    // Validate sort
    if (!VALID_SORTS.includes(sortParam as (typeof VALID_SORTS)[number])) {
      return errorResponse(
        `Invalid sort. Must be one of: ${VALID_SORTS.join(', ')}`,
        400,
        'INVALID_SORT'
      )
    }

    // Build where conditions — default to active tools only
    const conditions: SQL[] = [eq(tools.status, 'active')]

    if (typeParam) {
      conditions.push(eq(tools.toolType, typeParam))
    }

    if (categoryParam) {
      conditions.push(eq(tools.category, categoryParam))
    }

    if (ecosystemParam) {
      conditions.push(eq(tools.sourceEcosystem, ecosystemParam))
    }

    if (statusParam === 'claimed') {
      conditions.push(sql`${tools.developerId} IS NOT NULL`)
      conditions.push(sql`${tools.claimToken} IS NULL`)
    } else if (statusParam === 'unclaimed') {
      conditions.push(sql`${tools.claimToken} IS NOT NULL`)
    }

    if (searchQuery) {
      const pattern = `%${searchQuery}%`
      conditions.push(
        or(
          ilike(tools.name, pattern),
          ilike(tools.description, pattern)
        )!
      )
    }

    const whereClause = and(...conditions)

    // Count total matching tools
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(whereClause)

    const total = countRow?.count ?? 0
    const totalPages = Math.max(Math.ceil(total / limitParam), 1)
    const offset = (pageParam - 1) * limitParam

    // Determine sort order
    let orderBy
    switch (sortParam) {
      case 'newest':
        orderBy = desc(tools.createdAt)
        break
      case 'revenue':
        orderBy = desc(tools.totalRevenueCents)
        break
      case 'popular':
      default:
        orderBy = desc(tools.totalInvocations)
        break
    }

    // Fetch tools
    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
        category: tools.category,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        verified: tools.verified,
        createdAt: tools.createdAt,
      })
      .from(tools)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limitParam)
      .offset(offset)

    // Build facets for filtering UI and third-party integrations
    const facetConditions: SQL[] = [eq(tools.status, 'active')]
    const facetWhere = and(...facetConditions)

    const [typeFacets, ecosystemFacets, categoryFacets] = await Promise.all([
      db
        .select({ value: tools.toolType, count: sql<number>`count(*)::int` })
        .from(tools)
        .where(facetWhere)
        .groupBy(tools.toolType),
      db
        .select({ value: tools.sourceEcosystem, count: sql<number>`count(*)::int` })
        .from(tools)
        .where(and(facetWhere, sql`${tools.sourceEcosystem} IS NOT NULL`))
        .groupBy(tools.sourceEcosystem),
      db
        .select({ value: tools.category, count: sql<number>`count(*)::int` })
        .from(tools)
        .where(and(facetWhere, sql`${tools.category} IS NOT NULL`))
        .groupBy(tools.category),
    ])

    return successResponse({
      tools: results,
      total,
      page: pageParam,
      totalPages,
      // Facets enable third-party integrations to build filter UIs
      facets: {
        types: typeFacets.map((f) => ({ value: f.value, count: f.count })),
        ecosystems: ecosystemFacets.map((f) => ({ value: f.value ?? 'unknown', count: f.count })),
        categories: categoryFacets.map((f) => ({ value: f.value ?? 'uncategorized', count: f.count })),
      },
      // API metadata for third-party consumers
      _meta: {
        version: 'v1',
        filterable: ['type', 'category', 'ecosystem', 'status', 'q'],
        sortable: ['popular', 'newest', 'revenue'],
        maxLimit: MAX_LIMIT,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
