import { NextRequest } from 'next/server'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, toolReviews } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developers/[id]/profile — public developer profile */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-profile:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid developer ID.', 400, 'INVALID_ID')
    }

    // Fetch developer — only if public profile is enabled
    const [developer] = await db
      .select({
        id: developers.id,
        name: developers.name,
        publicBio: developers.publicBio,
        avatarUrl: developers.avatarUrl,
        publicProfile: developers.publicProfile,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .where(eq(developers.id, id))
      .limit(1)

    if (!developer || !developer.publicProfile) {
      return errorResponse('Developer profile not found.', 404, 'NOT_FOUND')
    }

    // Fetch active tools with average ratings
    const devTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        category: tools.category,
        totalInvocations: tools.totalInvocations,
        averageRating: sql<number>`coalesce((
          select avg(${toolReviews.rating})::numeric(2,1)
          from ${toolReviews}
          where ${toolReviews.toolId} = ${tools.id}
        ), 0)`,
      })
      .from(tools)
      .where(and(eq(tools.developerId, id), eq(tools.status, 'active')))
      .orderBy(desc(tools.totalInvocations))
      .limit(20)

    return successResponse({
      name: developer.name,
      bio: developer.publicBio,
      avatarUrl: developer.avatarUrl,
      joinedAt: developer.createdAt,
      tools: devTools.map((t) => ({
        name: t.name,
        slug: t.slug,
        category: t.category,
        totalInvocations: t.totalInvocations,
        averageRating: Number(t.averageRating),
      })),
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
