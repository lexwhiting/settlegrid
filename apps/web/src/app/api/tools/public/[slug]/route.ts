import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, toolReviews, toolChangelogs } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `public-tool:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params

    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        currentVersion: tools.currentVersion,
        pricingConfig: tools.pricingConfig,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (results.length === 0) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    const tool = results[0]

    // Fetch reviews
    let reviews: { id: string; rating: number; comment: string | null; createdAt: Date; consumerName: string }[] = []
    let averageRating = 0
    let reviewCount = 0
    try {
      const reviewRows = await db
        .select({
          id: toolReviews.id,
          rating: toolReviews.rating,
          comment: toolReviews.comment,
          createdAt: toolReviews.createdAt,
        })
        .from(toolReviews)
        .where(eq(toolReviews.toolId, tool.id))
        .orderBy(desc(toolReviews.createdAt))
        .limit(20)

      reviews = reviewRows.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        consumerName: 'Verified User',
      }))
      reviewCount = reviews.length

      if (reviewCount > 0) {
        averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      }
    } catch { /* reviews table may not exist yet */ }

    // Fetch changelog
    let changelog: { version: string; changeType: string; summary: string; releasedAt: Date }[] = []
    try {
      changelog = await db
        .select({
          version: toolChangelogs.version,
          changeType: toolChangelogs.changeType,
          summary: toolChangelogs.summary,
          releasedAt: toolChangelogs.releasedAt,
        })
        .from(toolChangelogs)
        .where(eq(toolChangelogs.toolId, tool.id))
        .orderBy(desc(toolChangelogs.releasedAt))
        .limit(10)
    } catch { /* changelog table may not exist yet */ }

    return successResponse({
      data: {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        description: tool.description ?? '',
        category: tool.category ?? 'other',
        currentVersion: tool.currentVersion,
        pricingConfig: tool.pricingConfig ?? { defaultCostCents: 0 },
        developerName: tool.developerName ?? 'Anonymous',
        reviews,
        changelog,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
