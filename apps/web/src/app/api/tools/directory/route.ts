import { NextRequest } from 'next/server'
import { eq, and, desc, ilike, or, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const VALID_CATEGORIES = [
  'data', 'nlp', 'image', 'code', 'search',
  'finance', 'productivity', 'analytics', 'security', 'other',
] as const

/** GET /api/tools/directory — public tool directory with search & filtering */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tools-directory:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limitParam = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 50)
    const offsetParam = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return errorResponse(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        400,
        'INVALID_CATEGORY'
      )
    }

    // Build where conditions
    const conditions: SQL[] = [eq(tools.status, 'active')]

    if (category) {
      conditions.push(eq(tools.category, category))
    }

    if (search) {
      const pattern = `%${search}%`
      conditions.push(
        or(
          ilike(tools.name, pattern),
          ilike(tools.description, pattern)
        )!
      )
    }

    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        tags: tools.tags,
        currentVersion: tools.currentVersion,
        totalInvocations: tools.totalInvocations,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(...conditions))
      .orderBy(desc(tools.totalInvocations))
      .limit(limitParam)
      .offset(offsetParam)

    return successResponse({ tools: results })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
