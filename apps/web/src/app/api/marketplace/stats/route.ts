import { NextRequest } from 'next/server'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, internalErrorResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { TOOL_BUNDLES } from '@/lib/tool-bundles'

export const maxDuration = 30

/**
 * GET /api/marketplace/stats - Public marketplace statistics.
 *
 * Returns aggregate statistics that make SettleGrid's marketplace
 * more valuable for third-party integrations and AI agents that
 * want to discover and compare tools programmatically.
 *
 * This endpoint is a competitive moat: the more data SettleGrid
 * aggregates, the harder it is for competitors to replicate.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `marketplace-stats:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // All queries in parallel for speed
    const [
      totalToolsResult,
      activeToolsResult,
      claimedToolsResult,
      totalDevelopersResult,
      totalInvocationsResult,
      topCategoriesResult,
      topEcosystemsResult,
      topTypeResult,
      recentToolsResult,
      growthResult,
    ] = await Promise.all([
      // Total tools
      db.select({ count: sql<number>`count(*)::int` }).from(tools),
      // Active tools
      db.select({ count: sql<number>`count(*)::int` }).from(tools).where(eq(tools.status, 'active')),
      // Claimed tools (have a developer)
      db.select({ count: sql<number>`count(*)::int` }).from(tools).where(
        and(eq(tools.status, 'active'), sql`${tools.developerId} IS NOT NULL`, sql`${tools.claimToken} IS NULL`),
      ),
      // Total developers
      db.select({ count: sql<number>`count(*)::int` }).from(developers),
      // Total invocations
      db.select({ total: sql<number>`COALESCE(sum(${tools.totalInvocations}), 0)::int` }).from(tools),
      // Top categories by tool count
      db
        .select({
          category: tools.category,
          count: sql<number>`count(*)::int`,
          totalInvocations: sql<number>`COALESCE(sum(${tools.totalInvocations}), 0)::int`,
        })
        .from(tools)
        .where(and(eq(tools.status, 'active'), sql`${tools.category} IS NOT NULL`))
        .groupBy(tools.category)
        .orderBy(sql`count(*) DESC`)
        .limit(15),
      // Top ecosystems
      db
        .select({
          ecosystem: tools.sourceEcosystem,
          count: sql<number>`count(*)::int`,
        })
        .from(tools)
        .where(and(eq(tools.status, 'active'), sql`${tools.sourceEcosystem} IS NOT NULL`))
        .groupBy(tools.sourceEcosystem)
        .orderBy(sql`count(*) DESC`),
      // Top tool types
      db
        .select({
          type: tools.toolType,
          count: sql<number>`count(*)::int`,
        })
        .from(tools)
        .where(eq(tools.status, 'active'))
        .groupBy(tools.toolType)
        .orderBy(sql`count(*) DESC`),
      // Most recently added (last 7 days)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(sql`${tools.createdAt} >= NOW() - INTERVAL '7 days'`),
      // Growth: tools added in the last 30 days vs previous 30 days
      db.select({
        recent: sql<number>`count(*) FILTER (WHERE ${tools.createdAt} >= NOW() - INTERVAL '30 days')::int`,
        previous: sql<number>`count(*) FILTER (WHERE ${tools.createdAt} >= NOW() - INTERVAL '60 days' AND ${tools.createdAt} < NOW() - INTERVAL '30 days')::int`,
      }).from(tools),
    ])

    const recentCount = growthResult[0]?.recent ?? 0
    const previousCount = growthResult[0]?.previous ?? 0
    const growthPct = previousCount > 0
      ? Math.round(((recentCount - previousCount) / previousCount) * 100)
      : recentCount > 0 ? 100 : 0

    return successResponse({
      overview: {
        totalTools: totalToolsResult[0]?.count ?? 0,
        activeTools: activeToolsResult[0]?.count ?? 0,
        claimedTools: claimedToolsResult[0]?.count ?? 0,
        totalDevelopers: totalDevelopersResult[0]?.count ?? 0,
        totalInvocations: totalInvocationsResult[0]?.total ?? 0,
        ecosystemCount: topEcosystemsResult.length,
        bundleCount: TOOL_BUNDLES.length,
      },
      growth: {
        newToolsLast7Days: recentToolsResult[0]?.count ?? 0,
        newToolsLast30Days: recentCount,
        growthPct30Day: growthPct,
      },
      categories: topCategoriesResult.map((c) => ({
        slug: c.category,
        toolCount: c.count,
        totalInvocations: c.totalInvocations,
      })),
      ecosystems: topEcosystemsResult.map((e) => ({
        slug: e.ecosystem,
        toolCount: e.count,
      })),
      toolTypes: topTypeResult.map((t) => ({
        slug: t.type,
        toolCount: t.count,
      })),
      _meta: {
        generatedAt: new Date().toISOString(),
        cacheMaxAgeSec: 300,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
