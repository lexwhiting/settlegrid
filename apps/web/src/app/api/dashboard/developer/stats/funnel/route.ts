import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, conversionEvents } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/dashboard/developer/stats/funnel — conversion funnel analytics */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-funnel:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)

    const emptyResult = {
      conversionRates: [],
      upgradeTriggers: [],
      churnSignals: [],
      funnelSummary: { totalTrials: 0, totalUpgrades: 0, totalDowngrades: 0, totalChurns: 0 },
    }

    if (toolIds.length === 0) {
      return successResponse(emptyResult)
    }

    const toolFilter = sql`${conversionEvents.toolId} = ANY(${toolIds})`

    // Conversion rates by event type
    const conversionRates = await db
      .select({
        event: conversionEvents.event,
        count: sql<number>`count(*)::int`,
        uniqueConsumers: sql<number>`count(distinct ${conversionEvents.consumerId})::int`,
      })
      .from(conversionEvents)
      .where(toolFilter)
      .groupBy(conversionEvents.event)
      .orderBy(sql`count(*) desc`)
      .limit(10)

    // Upgrade triggers — what tier transitions are most common
    const upgradeTriggers = await db
      .select({
        fromTier: conversionEvents.fromTier,
        toTier: conversionEvents.toTier,
        count: sql<number>`count(*)::int`,
      })
      .from(conversionEvents)
      .where(sql`${toolFilter} AND ${conversionEvents.event} = 'upgrade'`)
      .groupBy(conversionEvents.fromTier, conversionEvents.toTier)
      .orderBy(sql`count(*) desc`)
      .limit(20)

    // Churn signals — recent churn events with metadata
    const churnSignals = await db
      .select({
        toolId: conversionEvents.toolId,
        consumerId: conversionEvents.consumerId,
        fromTier: conversionEvents.fromTier,
        metadata: conversionEvents.metadata,
        createdAt: conversionEvents.createdAt,
      })
      .from(conversionEvents)
      .where(sql`${toolFilter} AND ${conversionEvents.event} = 'churn'`)
      .orderBy(sql`${conversionEvents.createdAt} desc`)
      .limit(50)

    // Summary counts
    const [summary] = await db
      .select({
        totalTrials: sql<number>`count(*) filter (where ${conversionEvents.event} = 'free_trial')::int`,
        totalUpgrades: sql<number>`count(*) filter (where ${conversionEvents.event} = 'upgrade')::int`,
        totalDowngrades: sql<number>`count(*) filter (where ${conversionEvents.event} = 'downgrade')::int`,
        totalChurns: sql<number>`count(*) filter (where ${conversionEvents.event} = 'churn')::int`,
      })
      .from(conversionEvents)
      .where(toolFilter)

    return successResponse({
      conversionRates,
      upgradeTriggers,
      churnSignals,
      funnelSummary: summary ?? emptyResult.funnelSummary,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
