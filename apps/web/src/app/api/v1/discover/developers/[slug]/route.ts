import { NextRequest } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, developerReputation } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * GET /api/v1/discover/developers/:slug — Get public developer profile + tools
 *
 * No auth required. Rate limited by IP.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `v1-discover-dev:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params

    const [developer] = await db
      .select({
        id: developers.id,
        name: developers.name,
        slug: developers.slug,
        bio: developers.publicBio,
        avatarUrl: developers.avatarUrl,
        publicProfile: developers.publicProfile,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .where(eq(developers.slug, slug))
      .limit(1)

    if (!developer || !developer.publicProfile) {
      return errorResponse('Developer not found', 404, 'NOT_FOUND')
    }

    // Get reputation
    const [reputation] = await db
      .select({
        score: developerReputation.score,
        uptimePct: developerReputation.uptimePct,
        reviewAvg: developerReputation.reviewAvg,
        totalTools: developerReputation.totalTools,
        totalConsumers: developerReputation.totalConsumers,
      })
      .from(developerReputation)
      .where(eq(developerReputation.developerId, developer.id))
      .limit(1)

    // Get active tools
    const devTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        version: tools.currentVersion,
        invocations: tools.totalInvocations,
      })
      .from(tools)
      .where(and(eq(tools.developerId, developer.id), eq(tools.status, 'active')))
      .orderBy(desc(tools.totalInvocations))

    const tier =
      (reputation?.score ?? 0) >= 80 ? 'Platinum'
        : (reputation?.score ?? 0) >= 60 ? 'Gold'
          : (reputation?.score ?? 0) >= 40 ? 'Silver'
            : 'Bronze'

    return successResponse({
      developer: {
        name: developer.name,
        slug: developer.slug,
        bio: developer.bio,
        avatarUrl: developer.avatarUrl,
        memberSince: developer.createdAt,
        profileUrl: `https://settlegrid.ai/dev/${developer.slug}`,
        reputation: reputation
          ? {
            score: reputation.score,
            tier,
            uptimePct: reputation.uptimePct,
            reviewAvg: reputation.reviewAvg / 100,
            totalTools: reputation.totalTools,
            totalConsumers: reputation.totalConsumers,
          }
          : null,
        tools: devTools.map((t) => ({
          ...t,
          url: `https://settlegrid.ai/tools/${t.slug}`,
        })),
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
