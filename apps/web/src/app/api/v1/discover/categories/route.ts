import { NextRequest } from 'next/server'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const CATEGORY_LABELS: Record<string, string> = {
  data: 'Data & APIs',
  nlp: 'Natural Language Processing',
  image: 'Image & Vision',
  code: 'Code & Development',
  search: 'Search & Discovery',
  finance: 'Finance & Payments',
  productivity: 'Productivity',
  analytics: 'Analytics & BI',
  security: 'Security & Compliance',
  other: 'Other',
}

/**
 * GET /api/v1/discover/categories — List all tool categories with counts
 *
 * No auth required. Rate limited by IP.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover-cats:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const counts = await db
      .select({
        category: tools.category,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(and(eq(tools.status, 'active'), sql`${tools.category} IS NOT NULL`))
      .groupBy(tools.category)

    const categories = counts
      .map((c) => ({
        slug: c.category,
        name: CATEGORY_LABELS[c.category ?? ''] ?? c.category,
        count: c.count,
      }))
      .sort((a, b) => b.count - a.count)

    return successResponse({ categories })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
