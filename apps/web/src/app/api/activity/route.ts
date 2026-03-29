import { NextRequest, NextResponse } from 'next/server'
import { desc, sql, gte, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, invocations } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 15

/** Human-readable labels for each tool type. */
const TOOL_TYPE_LABELS: Record<string, string> = {
  'mcp-server': 'MCP Server',
  'ai-model': 'AI Model',
  'rest-api': 'REST API',
  'agent-tool': 'Agent Tool',
  automation: 'Automation',
  extension: 'Extension',
  dataset: 'Dataset',
  'sdk-package': 'SDK Package',
}

function getToolTypeLabel(toolType: string): string {
  return TOOL_TYPE_LABELS[toolType] ?? toolType
}

/**
 * GET /api/activity — Public marketplace activity feed
 *
 * Returns anonymized recent marketplace activity across ALL tool types
 * for social proof. Rate limited by IP. No authentication required.
 *
 * Response:
 *   { activity: ActivityItem[], stats: { toolsToday, invocationsLastHour, developersThisWeek, toolTypeBreakdown } }
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `activity:${ip}`)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Run all queries in parallel — now includes toolType
    const [recentTools, recentInvocations, invocationsLastHourResult, toolsTodayResult, devsThisWeekResult, toolTypeBreakdownResult] =
      await Promise.all([
        // Recent tools published (last 24 hours) — includes toolType
        db
          .select({
            category: tools.category,
            toolType: tools.toolType,
            createdAt: tools.createdAt,
          })
          .from(tools)
          .where(gte(tools.createdAt, oneDayAgo))
          .orderBy(desc(tools.createdAt))
          .limit(10),

        // Recent invocations (last hour, anonymized) — includes toolType
        db
          .select({
            toolSlug: tools.slug,
            toolType: tools.toolType,
            category: tools.category,
            createdAt: invocations.createdAt,
          })
          .from(invocations)
          .innerJoin(tools, sql`${invocations.toolId} = ${tools.id}`)
          .where(gte(invocations.createdAt, oneHourAgo))
          .orderBy(desc(invocations.createdAt))
          .limit(15),

        // Invocations in the last hour (count)
        db
          .select({ count: count() })
          .from(invocations)
          .where(gte(invocations.createdAt, oneHourAgo)),

        // Tools published today (count)
        db
          .select({ count: count() })
          .from(tools)
          .where(gte(tools.createdAt, oneDayAgo)),

        // Developers joined this week (count)
        db
          .select({ count: count() })
          .from(developers)
          .where(gte(developers.createdAt, oneWeekAgo)),

        // Tool type breakdown — count of active tools per type
        db
          .select({
            toolType: tools.toolType,
            count: count(),
          })
          .from(tools)
          .where(gte(tools.createdAt, oneDayAgo))
          .groupBy(tools.toolType),
      ])

    // Build activity feed with tool type context
    const activity: {
      type: string
      category?: string
      toolType?: string
      toolTypeLabel?: string
      tool?: string
      timestamp: string
      message: string
    }[] = []

    // Add tool publications — now with tool type info
    for (const t of recentTools) {
      const typeLabel = getToolTypeLabel(t.toolType)
      activity.push({
        type: 'tool_published',
        category: t.category ?? 'general',
        toolType: t.toolType,
        toolTypeLabel: typeLabel,
        timestamp: t.createdAt.toISOString(),
        message: `New ${typeLabel} published in ${t.category ?? 'general'}`,
      })
    }

    // Add recent invocations (anonymized) — now with tool type info
    for (const inv of recentInvocations) {
      const typeLabel = getToolTypeLabel(inv.toolType)
      activity.push({
        type: 'invocation',
        tool: inv.toolSlug ?? undefined,
        toolType: inv.toolType,
        toolTypeLabel: typeLabel,
        category: inv.category ?? undefined,
        timestamp: inv.createdAt.toISOString(),
        message: inv.toolSlug
          ? `${inv.toolSlug} (${typeLabel}) called`
          : `${typeLabel} invoked`,
      })
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Build tool type breakdown map
    const toolTypeBreakdown: Record<string, number> = {}
    for (const row of toolTypeBreakdownResult) {
      toolTypeBreakdown[row.toolType] = row.count
    }

    const stats = {
      toolsToday: toolsTodayResult[0]?.count ?? 0,
      invocationsLastHour: invocationsLastHourResult[0]?.count ?? 0,
      developersThisWeek: devsThisWeekResult[0]?.count ?? 0,
      toolTypeBreakdown,
    }

    logger.info('activity.feed_served', { activityCount: activity.length })

    return NextResponse.json(
      { activity: activity.slice(0, 20), stats },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    logger.error('activity.error', {}, error)
    return NextResponse.json(
      { error: 'Failed to fetch activity.' },
      { status: 500 }
    )
  }
}
