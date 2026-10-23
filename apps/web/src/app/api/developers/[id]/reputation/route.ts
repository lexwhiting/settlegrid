import { NextRequest } from 'next/server'
import { eq, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, developerReputation, tools, toolReviews, toolHealthChecks, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// Weighted scoring: uptime 30%, reviews 25%, response time 20%, consumers 15%, tools 10%.
// Dimensions with no data (null) are left out and the remaining weights renormalised.
function computeReputationScore(d: {
  uptimePct: number | null
  responseTimePct: number | null
  reviewAvg: number
  totalConsumers: number
  totalTools: number
}): number {
  const parts: Array<[number | null, number]> = [
    [d.uptimePct, 0.30],
    [Math.min(d.reviewAvg / 5, 1) * 100, 0.25],
    [d.responseTimePct, 0.20],
    [Math.min(d.totalConsumers / 20, 1) * 100, 0.15],
    [Math.min(d.totalTools / 5, 1) * 100, 0.10],
  ]
  let weighted = 0
  let weight = 0
  for (const [value, w] of parts) {
    if (value === null) continue
    weighted += value * w
    weight += w
  }
  if (weight === 0) return 0
  return Math.min(100, Math.max(0, Math.round(weighted / weight)))
}

/** GET /api/developers/[id]/reputation — developer reputation (resolves by UUID or slug) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers)
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
        // The cache columns are NOT NULL, so whether uptime / response time had
        // any data is re-checked here (cheap EXISTS queries).
        let hasChecks = true
        let hasInvocations = true
        try {
          const since = new Date(Date.now() - WINDOW_MS).toISOString()
          const [presence] = await db
            .select({
              hasChecks: sql<boolean>`exists(select 1 from ${toolHealthChecks} inner join ${tools} on ${tools.id} = ${toolHealthChecks.toolId} where ${tools.developerId} = ${developerId} and ${tools.status} = 'active' and ${toolHealthChecks.checkedAt} >= ${since}::timestamptz)`,
              hasInvocations: sql<boolean>`exists(select 1 from ${invocations} inner join ${tools} on ${tools.id} = ${invocations.toolId} where ${tools.developerId} = ${developerId} and ${tools.status} = 'active' and ${invocations.createdAt} >= ${since}::timestamptz)`,
            })
            .from(developers)
            .where(eq(developers.id, developerId))
            .limit(1)
          if (presence) {
            hasChecks = Boolean(presence.hasChecks)
            hasInvocations = Boolean(presence.hasInvocations)
          }
        } catch {
          // Fall back to the cached values
        }
        return successResponse({
          developerId: developer.id,
          name: developer.name,
          score: cached.score,
          breakdown: {
            responseTimePct: hasInvocations ? cached.responseTimePct : null,
            uptimePct: hasChecks ? cached.uptimePct : null,
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

    // uptimePct: share of 'up' health checks in the last 30 days (null = no checks)
    let uptimePct: number | null = null
    if (toolIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - WINDOW_MS)
      uptimePct = await db
        .select({
          total: sql<number>`count(*)::int`,
          pct: sql<number>`round(100.0 * count(*) filter (where ${toolHealthChecks.status} = 'up') / greatest(count(*), 1))::int`,
        })
        .from(toolHealthChecks)
        .where(sql`${inArray(toolHealthChecks.toolId, toolIds)} AND ${toolHealthChecks.checkedAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
        .then(r => (r[0] && Number(r[0].total) > 0 ? Number(r[0].pct) : null))
        .catch(() => null)
    }

    // responseTimePct: score from median latency (null = no invocations)
    let responseTimePct: number | null = null
    if (toolIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - WINDOW_MS)
      const medianLatency = await db
        .select({
          total: sql<number>`count(*)::int`,
          median: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.latencyMs}), 0)::int`,
        })
        .from(invocations)
        .where(sql`${inArray(invocations.toolId, toolIds)} AND ${invocations.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
        .then(r => (r[0] && Number(r[0].total) > 0 ? Number(r[0].median ?? 0) : null))
        .catch(() => null)

      responseTimePct = medianLatency === null
        ? null
        : Math.max(0, Math.min(100, Math.round(100 - (medianLatency / 5))))
    }

    const score = computeReputationScore({ uptimePct, responseTimePct, reviewAvg, totalConsumers, totalTools })

    // Upsert reputation
    try {
      await db
        .insert(developerReputation)
        .values({
          developerId,
          score,
          // NOT NULL columns: 0 when there is no data (the cache read re-checks presence)
          responseTimePct: responseTimePct ?? 0,
          uptimePct: uptimePct ?? 0,
          reviewAvg: Math.round(reviewAvg * 100),
          totalTools,
          totalConsumers,
        })
        .onConflictDoUpdate({
          target: developerReputation.developerId,
          set: {
            score,
            responseTimePct: responseTimePct ?? 0,
            uptimePct: uptimePct ?? 0,
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
