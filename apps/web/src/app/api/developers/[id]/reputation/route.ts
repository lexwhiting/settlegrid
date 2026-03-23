import { NextRequest } from 'next/server'
import { eq, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, developerReputation, tools, toolReviews, toolHealthChecks, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developers/[id]/reputation — developer reputation (resolves by UUID or slug) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-reputation:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { id } = await params
    const isUuid = UUID_RE.test(id)

    // Resolve by UUID or slug (case-insensitive)
    const whereClause = isUuid
      ? eq(developers.id, id)
      : eq(developers.slug, id.toLowerCase())

    const [developer] = await db
      .select({ id: developers.id, name: developers.name })
      .from(developers)
      .where(whereClause)
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    const developerId = developer.id

    // Check for cached reputation
    const [cached] = await db
      .select()
      .from(developerReputation)
      .where(eq(developerReputation.developerId, developerId))
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
    const totalTools = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(sql`${tools.developerId} = ${developerId} AND ${tools.status} = 'active'`)
      .then(r => r[0]?.count ?? 0)
      .catch(() => 0)

    const reviewAvg = await db
      .select({ avg: sql<number>`coalesce(avg(${toolReviews.rating}), 0)` })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(eq(tools.developerId, developerId))
      .then(r => Number(r[0]?.avg ?? 0))
      .catch(() => 0)

    // Gather tool IDs for aggregate queries
    const toolRows = await db
      .select({ id: tools.id })
      .from(tools)
      .where(sql`${tools.developerId} = ${developerId} AND ${tools.status} = 'active'`)
      .catch(() => [] as { id: string }[])
    const toolIds = toolRows.map(t => t.id)

    // totalConsumers: count unique consumers across all tools
    let totalConsumers = 0
    if (toolIds.length > 0) {
      totalConsumers = await db
        .select({ count: sql<number>`count(distinct ${invocations.consumerId})::int` })
        .from(invocations)
        .where(inArray(invocations.toolId, toolIds))
        .then(r => r[0]?.count ?? 0)
        .catch(() => 0)
    }

    // uptimePct: compute from toolHealthChecks in the last 30 days
    let uptimePct = 100
    if (toolIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      uptimePct = await db
        .select({
          pct: sql<number>`round(100.0 * count(*) filter (where ${toolHealthChecks.status} = 'up') / greatest(count(*), 1))::int`,
        })
        .from(toolHealthChecks)
        .where(sql`${inArray(toolHealthChecks.toolId, toolIds)} AND ${toolHealthChecks.checkedAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
        .then(r => r[0]?.pct ?? 100)
        .catch(() => 100)
    }

    // responseTimePct: compute median latency and convert to a score
    let responseTimePct = 100
    if (toolIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const medianLatency = await db
        .select({
          median: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.latencyMs}), 0)::int`,
        })
        .from(invocations)
        .where(sql`${inArray(invocations.toolId, toolIds)} AND ${invocations.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
        .then(r => r[0]?.median ?? 0)
        .catch(() => 0)

      responseTimePct = medianLatency > 0
        ? Math.max(0, Math.min(100, Math.round(100 - (medianLatency / 5))))
        : 100
    }

    // Weighted scoring: uptime 30%, reviews 25%, response time 20%, consumers 15%, tools 10%
    const score = Math.min(100, Math.max(0, Math.round(
      (uptimePct * 0.30) +
      (Math.min(reviewAvg / 5, 1) * 100 * 0.25) +
      (responseTimePct * 0.20) +
      (Math.min(totalConsumers / 20, 1) * 100 * 0.15) +
      (Math.min(totalTools / 5, 1) * 100 * 0.10)
    )))

    // Upsert reputation
    try {
      await db
        .insert(developerReputation)
        .values({
          developerId,
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
      logger.error('reputation.upsert_failed', { developerId }, e as Error)
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
