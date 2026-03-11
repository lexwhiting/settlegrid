import { NextRequest } from 'next/server'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const CATEGORY_DEFINITIONS = [
  { slug: 'data', name: 'Data & APIs' },
  { slug: 'nlp', name: 'Natural Language Processing' },
  { slug: 'image', name: 'Image & Vision' },
  { slug: 'code', name: 'Code & Development' },
  { slug: 'search', name: 'Search & Discovery' },
  { slug: 'finance', name: 'Finance & Payments' },
  { slug: 'productivity', name: 'Productivity' },
  { slug: 'analytics', name: 'Analytics & BI' },
  { slug: 'security', name: 'Security & Compliance' },
  { slug: 'other', name: 'Other' },
] as const

/** GET /api/tools/categories — list all tool categories with active tool counts */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tools-categories:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Count active tools per category
    const counts = await db
      .select({
        category: tools.category,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(and(eq(tools.status, 'active'), sql`${tools.category} IS NOT NULL`))
      .groupBy(tools.category)

    const countMap = new Map(counts.map((c) => [c.category, c.count]))

    const categories = CATEGORY_DEFINITIONS.map((def) => ({
      slug: def.slug,
      name: def.name,
      count: countMap.get(def.slug) ?? 0,
    }))

    return successResponse({ categories })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
