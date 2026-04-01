import { NextRequest } from 'next/server'
import { eq, sql, and, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolBenchmark {
  toolId: string
  toolName: string
  category: string
  yourPrice: number
  categoryMedian: number
  categoryP25: number
  categoryP75: number
  yourInvocations: number
  categoryAvgInvocations: number
  yourErrorRate: number
  categoryAvgErrorRate: number
  yourAvgLatencyMs: number
  categoryAvgLatencyMs: number
  /** True when there is only 1 tool in the category (benchmarks less meaningful) */
  singleToolCategory: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BENCHMARK_PERIOD_DAYS = 30

/** GET /api/dashboard/developer/benchmarks — category benchmarking (Builder+) */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-benchmarks:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: category_benchmarking requires Builder+ ──────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'category_benchmarking', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Builder plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'builder', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    // ── Get developer's tools with categories ──────────────────────────
    const developerTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        category: tools.category,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(100)

    if (developerTools.length === 0) {
      return successResponse({ benchmarks: [], periodDays: BENCHMARK_PERIOD_DAYS })
    }

    const toolIds = developerTools.map((t) => t.id)
    // Tools without a category get 'uncategorized' — still include them in benchmarks
    const categoriesRaw = developerTools.map((t) => t.category).filter(Boolean) as string[]
    const categories = [...new Set(categoriesRaw)]

    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - BENCHMARK_PERIOD_DAYS)
    const periodStartSql = sql`${periodStart.toISOString()}::timestamptz`

    // ── Get your tool stats ────────────────────────────────────────────
    const yourStats = await db
      .select({
        toolId: invocations.toolId,
        avgCostCents: sql<number>`coalesce(avg(${invocations.costCents}), 0)::int`,
        totalInvocations: sql<number>`count(*)::int`,
        errorRate: sql<number>`round(100.0 * count(*) filter (where ${invocations.status} != 'success') / greatest(count(*), 1), 2)::float`,
        avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        gte(invocations.createdAt, periodStartSql),
      ))
      .groupBy(invocations.toolId)
      .limit(100)

    const yourStatsMap = new Map(yourStats.map((s) => [s.toolId, s]))

    // ── Get category benchmarks (for all tools in same categories) ─────
    interface CategoryStatsRow {
      category: string | null
      medianCostCents: number
      p25CostCents: number
      p75CostCents: number
      avgInvocationsPerTool: number
      avgErrorRate: number
      avgLatencyMs: number
      toolCount: number
    }

    let categoryStatsRows: CategoryStatsRow[] = []

    if (categories.length > 0) {
      // Get all active tool IDs in these categories (excluding developer's own)
      const categoryToolIds = await db
        .select({ id: tools.id })
        .from(tools)
        .where(and(
          inArray(tools.category, categories),
          eq(tools.status, 'active'),
        ))
        .limit(5000)

      const allCategoryToolIds = categoryToolIds.map((t) => t.id)

      if (allCategoryToolIds.length > 0) {
        // Get aggregated stats per category via tools table join
        categoryStatsRows = await db
          .select({
            category: tools.category,
            medianCostCents: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.costCents}), 0)::int`,
            p25CostCents: sql<number>`coalesce(percentile_cont(0.25) within group (order by ${invocations.costCents}), 0)::int`,
            p75CostCents: sql<number>`coalesce(percentile_cont(0.75) within group (order by ${invocations.costCents}), 0)::int`,
            avgInvocationsPerTool: sql<number>`(count(*)::float / greatest(count(distinct ${invocations.toolId}), 1))::int`,
            avgErrorRate: sql<number>`round(100.0 * count(*) filter (where ${invocations.status} != 'success') / greatest(count(*), 1), 2)::float`,
            avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
            toolCount: sql<number>`count(distinct ${invocations.toolId})::int`,
          })
          .from(invocations)
          .innerJoin(tools, eq(invocations.toolId, tools.id))
          .where(and(
            inArray(invocations.toolId, allCategoryToolIds),
            gte(invocations.createdAt, periodStartSql),
            inArray(tools.category, categories),
          ))
          .groupBy(tools.category)
          .limit(50)
      }
    }

    const categoryStatsMap = new Map(
      categoryStatsRows
        .filter((s): s is CategoryStatsRow & { category: string } => s.category !== null)
        .map((s) => [s.category, s])
    )

    // ── Assemble benchmarks ────────────────────────────────────────────
    const benchmarks: ToolBenchmark[] = developerTools.map((tool) => {
      const yours = yourStatsMap.get(tool.id)
      const catStats = tool.category ? categoryStatsMap.get(tool.category) : undefined

      return {
        toolId: tool.id,
        toolName: tool.name,
        category: tool.category ?? 'uncategorized',
        yourPrice: yours?.avgCostCents ?? 0,
        categoryMedian: catStats?.medianCostCents ?? 0,
        categoryP25: catStats?.p25CostCents ?? 0,
        categoryP75: catStats?.p75CostCents ?? 0,
        yourInvocations: yours?.totalInvocations ?? 0,
        categoryAvgInvocations: catStats?.avgInvocationsPerTool ?? 0,
        yourErrorRate: yours?.errorRate ?? 0,
        categoryAvgErrorRate: catStats?.avgErrorRate ?? 0,
        yourAvgLatencyMs: yours?.avgLatencyMs ?? 0,
        categoryAvgLatencyMs: catStats?.avgLatencyMs ?? 0,
        singleToolCategory: (catStats?.toolCount ?? 0) <= 1,
      }
    })

    return successResponse({
      benchmarks,
      periodDays: BENCHMARK_PERIOD_DAYS,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
