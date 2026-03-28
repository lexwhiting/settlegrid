import { NextRequest, NextResponse } from 'next/server'
import { desc, sql, gte, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, invocations } from '@/lib/db/schema'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 15

/**
 * GET /api/activity — Public marketplace activity feed
 *
 * Returns anonymized recent marketplace activity for social proof.
 * Rate limited by IP. No authentication required.
 *
 * Response:
 *   { activity: ActivityItem[], stats: { toolsToday, invocationsLastHour, developersThisWeek } }
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

    // Run all queries in parallel
    const [recentTools, recentInvocations, invocationsLastHourResult, toolsTodayResult, devsThisWeekResult] =
      await Promise.all([
        // Recent tools published (last 24 hours)
        db
          .select({
            category: tools.category,
            createdAt: tools.createdAt,
          })
          .from(tools)
          .where(gte(tools.createdAt, oneDayAgo))
          .orderBy(desc(tools.createdAt))
          .limit(10),

        // Recent invocations (last hour, anonymized)
        db
          .select({
            toolSlug: tools.slug,
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
      ])

    // Build activity feed
    const activity: {
      type: string
      category?: string
      tool?: string
      timestamp: string
      message: string
    }[] = []

    // Add tool publications
    for (const t of recentTools) {
      activity.push({
        type: 'tool_published',
        category: t.category ?? 'general',
        timestamp: t.createdAt.toISOString(),
        message: `New ${t.category ?? 'general'} tool published`,
      })
    }

    // Add recent invocations (anonymized)
    for (const inv of recentInvocations) {
      activity.push({
        type: 'invocation',
        tool: inv.toolSlug ?? undefined,
        timestamp: inv.createdAt.toISOString(),
        message: inv.toolSlug ? `${inv.toolSlug} called` : 'Tool invoked',
      })
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const stats = {
      toolsToday: toolsTodayResult[0]?.count ?? 0,
      invocationsLastHour: invocationsLastHourResult[0]?.count ?? 0,
      developersThisWeek: devsThisWeekResult[0]?.count ?? 0,
    }

    logger.info('activity.feed_served', { ip, activityCount: activity.length })

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
