import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, developerReputation, tools, toolReviews } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-reputation:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid developer ID.', 400, 'INVALID_ID')
    }

    const [developer] = await db
      .select({ id: developers.id, name: developers.name })
      .from(developers)
      .where(eq(developers.id, id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    // Check for cached reputation
    const [cached] = await db
      .select()
      .from(developerReputation)
      .where(eq(developerReputation.developerId, id))
      .limit(1)

    if (cached) {
      const age = Date.now() - new Date(cached.calculatedAt).getTime()
      if (age < 3600000) {
        return successResponse({
          developerId: developer.id,
          name: developer.name,
          score: cached.score,
          breakdown: {
            responseTimePct: cached.responseTimePct,
            uptimePct: cached.uptimePct,
            reviewAvg: cached.reviewAvg / 100,
            totalTools: cached.totalTools,
            totalConsumers: cached.totalConsumers,
          },
          calculatedAt: cached.calculatedAt,
        })
      }
    }

    // Compute fresh — use simple queries that won't fail on empty tables
    let totalTools = 0
    let reviewAvg = 0
    let totalConsumers = 0

    try {
      const [ts] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(sql`${tools.developerId} = ${id} AND ${tools.status} = 'active'`)
      totalTools = ts?.count ?? 0
    } catch { /* empty */ }

    try {
      const [rs] = await db
        .select({ avg: sql<number>`coalesce(avg(${toolReviews.rating}), 0)` })
        .from(toolReviews)
        .innerJoin(tools, eq(toolReviews.toolId, tools.id))
        .where(eq(tools.developerId, id))
      reviewAvg = Number(rs?.avg ?? 0)
    } catch { /* empty */ }

    // Simplified scoring: tools (25%), reviews (25%), base (50%)
    const score = Math.min(100, Math.max(0, Math.round(
      50 +
      (Math.min(totalTools / 5, 1) * 25) +
      (Math.min(reviewAvg / 5, 1) * 25)
    )))

    const uptimePct = 100
    const responseTimePct = 100

    // Upsert reputation
    try {
      await db
        .insert(developerReputation)
        .values({
          developerId: id,
          score,
          responseTimePct,
          uptimePct,
          reviewAvg: Math.round(reviewAvg * 100),
          totalTools,
          totalConsumers,
        })
        .onConflictDoUpdate({
          target: developerReputation.developerId,
          set: {
            score,
            responseTimePct,
            uptimePct,
            reviewAvg: Math.round(reviewAvg * 100),
            totalTools,
            totalConsumers,
            calculatedAt: new Date(),
          },
        })
    } catch (e) {
      logger.error('reputation.upsert_failed', { developerId: id }, e as Error)
    }

    return successResponse({
      developerId: developer.id,
      name: developer.name,
      score,
      breakdown: {
        responseTimePct,
        uptimePct,
        reviewAvg,
        totalTools,
        totalConsumers,
      },
      calculatedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('reputation.compute_failed', {}, error as Error)
    return internalErrorResponse(error)
  }
}
