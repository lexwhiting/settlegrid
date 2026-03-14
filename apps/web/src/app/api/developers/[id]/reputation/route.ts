import { NextRequest } from 'next/server'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, developerReputation, tools, toolReviews, toolHealthChecks, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developers/[id]/reputation — public developer reputation score */
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

    // Verify developer exists
    const [developer] = await db
      .select({ id: developers.id, name: developers.name, publicProfile: developers.publicProfile })
      .from(developers)
      .where(eq(developers.id, id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    // Check for cached reputation score
    const [cached] = await db
      .select({
        score: developerReputation.score,
        responseTimePct: developerReputation.responseTimePct,
        uptimePct: developerReputation.uptimePct,
        reviewAvg: developerReputation.reviewAvg,
        totalTools: developerReputation.totalTools,
        totalConsumers: developerReputation.totalConsumers,
        calculatedAt: developerReputation.calculatedAt,
      })
      .from(developerReputation)
      .where(eq(developerReputation.developerId, id))
      .orderBy(desc(developerReputation.calculatedAt))
      .limit(1)

    // If we have a recent score (less than 1 hour old), return it
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
            reviewAvg: cached.reviewAvg / 100, // convert back to float (e.g. 4.50)
            totalTools: cached.totalTools,
            totalConsumers: cached.totalConsumers,
          },
          calculatedAt: cached.calculatedAt,
        })
      }
    }

    // Compute fresh score

    // 1. Total active tools
    const [toolStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(sql`${tools.developerId} = ${id} AND ${tools.status} = 'active'`)

    const totalTools = toolStats?.count ?? 0

    // 2. Average review rating
    const [reviewStats] = await db
      .select({
        avg: sql<number>`coalesce(avg(${toolReviews.rating}), 0)::numeric(3,2)`,
      })
      .from(toolReviews)
      .innerJoin(tools, eq(toolReviews.toolId, tools.id))
      .where(eq(tools.developerId, id))

    const reviewAvg = Number(reviewStats?.avg ?? 0)

    // 3. Uptime percentage (across all developer tools, last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [uptimeData] = await db
      .select({
        total: sql<number>`count(*)::int`,
        upCount: sql<number>`count(*) filter (where ${toolHealthChecks.status} = 'up')::int`,
      })
      .from(toolHealthChecks)
      .innerJoin(tools, eq(toolHealthChecks.toolId, tools.id))
      .where(sql`${tools.developerId} = ${id} AND ${toolHealthChecks.checkedAt} >= ${thirtyDaysAgo}`)

    const uptimePct = uptimeData && uptimeData.total > 0
      ? Math.round((uptimeData.upCount / uptimeData.total) * 100)
      : 100

    // 4. Response time percentile (median latency across tools)
    const [latencyData] = await db
      .select({
        medianMs: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.latencyMs}), 0)::int`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(sql`${tools.developerId} = ${id} AND ${invocations.latencyMs} IS NOT NULL AND ${invocations.createdAt} >= ${thirtyDaysAgo}`)

    // Lower latency = higher percentile score (inverse scoring)
    const medianMs = latencyData?.medianMs ?? 500
    const responseTimePct = Math.max(0, Math.min(100, Math.round(100 - (medianMs / 10))))

    // 5. Total unique consumers
    const [consumerStats] = await db
      .select({
        count: sql<number>`count(distinct ${invocations.consumerId})::int`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(eq(tools.developerId, id))

    const totalConsumers = consumerStats?.count ?? 0

    // Compute composite score (weighted)
    // Uptime: 30%, Reviews: 25%, Response time: 20%, Tools: 10%, Consumers: 15%
    const score = Math.min(100, Math.max(0, Math.round(
      (uptimePct * 0.30) +
      (Math.min(reviewAvg / 5, 1) * 100 * 0.25) +
      (responseTimePct * 0.20) +
      (Math.min(totalTools / 10, 1) * 100 * 0.10) +
      (Math.min(totalConsumers / 100, 1) * 100 * 0.15)
    )))

    // Store computed score
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
    return internalErrorResponse(error)
  }
}
