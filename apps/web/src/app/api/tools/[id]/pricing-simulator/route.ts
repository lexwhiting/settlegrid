import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const priceEntrySchema = z.object({
  method: z.string().min(1),
  cents: z.number().int().min(0),
})

const simulatorSchema = z.object({
  model: z.enum(['per_call', 'tiered']),
  prices: z.array(priceEntrySchema).min(1).max(100),
})

/** POST /api/tools/[id]/pricing-simulator — project revenue impact of pricing changes */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `pricing-sim:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID')
    }

    // Verify tool ownership
    const [tool] = await db
      .select({ id: tools.id, developerId: tools.developerId })
      .from(tools)
      .where(eq(tools.id, id))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (tool.developerId !== auth.id) {
      return errorResponse('Access denied.', 403, 'FORBIDDEN')
    }

    const body = await parseBody(request, simulatorSchema)

    // Get historical usage for last 30 days grouped by method
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const methodStats = await db
      .select({
        method: invocations.method,
        count: sql<number>`count(*)::int`,
        currentRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(sql`${invocations.toolId} = ${id} AND ${invocations.createdAt} >= ${thirtyDaysAgo}`)
      .groupBy(invocations.method)
      .orderBy(sql`count(*) desc`)
      .limit(200)

    // Build price map from proposal
    const priceMap = new Map<string, number>()
    for (const p of body.prices) {
      priceMap.set(p.method, p.cents)
    }

    // Calculate projected revenue
    let currentRevenue30d = 0
    let projectedRevenue30d = 0
    const topAffectedMethods: Array<{
      method: string
      currentRevenueCents: number
      projectedRevenueCents: number
      impactPct: number
    }> = []

    for (const stat of methodStats) {
      currentRevenue30d += stat.currentRevenueCents
      const newPriceCents = priceMap.get(stat.method)
      const projectedForMethod = newPriceCents !== undefined
        ? stat.count * newPriceCents
        : stat.currentRevenueCents // unchanged methods keep current revenue
      projectedRevenue30d += projectedForMethod

      if (newPriceCents !== undefined) {
        const impact = stat.currentRevenueCents > 0
          ? Math.round(((projectedForMethod - stat.currentRevenueCents) / stat.currentRevenueCents) * 10000) / 100
          : projectedForMethod > 0 ? 100 : 0
        topAffectedMethods.push({
          method: stat.method,
          currentRevenueCents: stat.currentRevenueCents,
          projectedRevenueCents: projectedForMethod,
          impactPct: impact,
        })
      }
    }

    const overallImpactPct = currentRevenue30d > 0
      ? Math.round(((projectedRevenue30d - currentRevenue30d) / currentRevenue30d) * 10000) / 100
      : 0

    // Sort affected methods by absolute impact
    topAffectedMethods.sort((a, b) =>
      Math.abs(b.projectedRevenueCents - b.currentRevenueCents) -
      Math.abs(a.projectedRevenueCents - a.currentRevenueCents)
    )

    return successResponse({
      projectedRevenue30d,
      currentRevenue30d,
      impactPct: overallImpactPct,
      topAffectedMethods: topAffectedMethods.slice(0, 20),
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
