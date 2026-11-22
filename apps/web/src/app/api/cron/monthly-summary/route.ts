import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { eq, sql, and, gte, lt, inArray } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendNotificationEmail } from '@/lib/notifications'
import { monthlyDeveloperSummaryEmail } from '@/lib/email'
import type { MonthlySummaryData } from '@/lib/email'
import { getRedis } from '@/lib/redis'
import { utcMonthStart, utcMonthKey } from '@/lib/utc-periods'

export const maxDuration = 60

/** Stop starting new sends after this long (maxDuration is 60 s). */
const SEND_BUDGET_MS = 45_000

/**
 * Vercel Cron handler: sends monthly developer summary emails.
 * Runs on the 1st of each month at 9 AM UTC.
 *
 * For each developer with at least 1 active tool and calls last UTC month (one
 * email per developer and month; sandbox calls don't count):
 *   - Total revenue last month
 *   - Total invocations
 *   - Top tool by revenue
 *   - Month-over-month trend (up/down %)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-monthly-summary:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.monthly_summary.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const startedAt = Date.now()
    const now = new Date()

    // UTC calendar months: the month reported on and the month before it (for the trend)
    const lastMonthEnd = utcMonthStart(now) // 1st of this month = end of last month
    const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth() - 1, 1))
    const prevMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth() - 2, 1))
    const monthKey = utcMonthKey(lastMonthStart)

    const monthName = lastMonthStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })

    // Per developer and tool name: last month's and the month before's revenue and
    // calls, in one query. Sandbox (test) calls don't count, as in the weekly report.
    // Timestamps go to SQL as ISO strings: the postgres-js driver cannot serialize a
    // JS Date inside a sql template.
    const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`
    const inLast = sql`${invocations.createdAt} >= ${ts(lastMonthStart)}`
    const rows = await db
      .select({
        developerId: tools.developerId,
        toolName: tools.name,
        revenue: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where ${inLast}), 0))::int`,
        calls: sql<number>`(count(*) filter (where ${inLast}))::int`,
        prevRevenue: sql<number>`(coalesce(sum(${invocations.costCents}) filter (where not ${inLast}), 0))::int`,
        prevCalls: sql<number>`(count(*) filter (where not ${inLast}))::int`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(
        eq(invocations.isTest, false),
        gte(invocations.createdAt, ts(prevMonthStart)),
        lt(invocations.createdAt, ts(lastMonthEnd)),
      ))
      .groupBy(tools.developerId, tools.name)

    type Totals = { revenue: number; calls: number; prevRevenue: number; prevCalls: number; topTool: string | null; topToolRevenue: number }
    const totalsByDev = new Map<string, Totals>()
    for (const r of rows) {
      const t = totalsByDev.get(r.developerId) ?? { revenue: 0, calls: 0, prevRevenue: 0, prevCalls: 0, topTool: null, topToolRevenue: 0 }
      t.revenue += r.revenue
      t.calls += r.calls
      t.prevRevenue += r.prevRevenue
      t.prevCalls += r.prevCalls
      // Top tool: most revenue last month; ties go to the name that sorts first
      if (r.calls > 0 && (t.topTool === null || r.revenue > t.topToolRevenue || (r.revenue === t.topToolRevenue && r.toolName < t.topTool))) {
        t.topTool = r.toolName
        t.topToolRevenue = r.revenue
      }
      totalsByDev.set(r.developerId, t)
    }

    // Developers with at least 1 active tool and calls last month (no email for a
    // month without activity)
    const activeIds = [...totalsByDev].filter(([, t]) => t.calls > 0).map(([id]) => id)
    const devsWithTools = activeIds.length === 0 ? [] : await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
      })
      .from(developers)
      .where(and(
        inArray(developers.id, activeIds),
        sql`EXISTS (SELECT 1 FROM ${tools} WHERE ${tools.developerId} = ${developers.id} AND ${tools.status} = 'active')`,
      ))
      .orderBy(developers.id)

    const redis = getRedis()
    let emailsSent = 0
    let remaining = 0

    for (const dev of devsWithTools) {
      // Stop starting sends well before the 60 s limit. Running the job again sends
      // the rest: developers already sent this month's summary are skipped.
      if (Date.now() - startedAt > SEND_BUDGET_MS) {
        remaining++
        continue
      }
      try {
        const t = totalsByDev.get(dev.id)!
        const devName = dev.name ?? 'Developer'

        // Calculate MoM trends
        const momRevenuePct = t.prevRevenue > 0
          ? ((t.revenue - t.prevRevenue) / t.prevRevenue) * 100
          : null

        const momInvocationPct = t.prevCalls > 0
          ? ((t.calls - t.prevCalls) / t.prevCalls) * 100
          : null

        const summaryData: MonthlySummaryData = {
          totalRevenueCents: t.revenue,
          totalInvocations: t.calls,
          topToolName: t.topTool,
          topToolRevenueCents: t.topToolRevenue,
          momRevenuePct,
          momInvocationPct,
        }

        const tpl = monthlyDeveloperSummaryEmail(devName, monthName, summaryData)

        // Claim this month's summary before sending (SET NX): one already sent, or
        // being sent by an overlapping run, is skipped.
        const sentKey = `monthly-summary:${dev.id}:${monthKey}`
        const claimed = await redis.set(sentKey, '1', { nx: true, ex: 40 * 24 * 60 * 60 })
        if (claimed === null) continue

        await sendNotificationEmail({
          developerId: dev.id,
          eventKey: 'monthly_summary',
          email: dev.email,
          subject: tpl.subject,
          html: tpl.html,
        })

        emailsSent++
      } catch (devErr) {
        // Don't let one developer failure stop the batch
        logger.error('cron.monthly_summary.dev_failed', { developerId: dev.id }, devErr)
      }
    }

    if (remaining > 0) {
      logger.warn('cron.monthly_summary.incomplete', { month: monthName, remaining })
    }

    logger.info('cron.monthly_summary.completed', {
      month: monthName,
      devsChecked: devsWithTools.length,
      emailsSent,
      remaining,
    })

    return successResponse({
      month: monthName,
      devsChecked: devsWithTools.length,
      emailsSent,
      remaining,
    })
  } catch (error) {
    logger.error('cron.monthly_summary.failed', {}, error)
    return internalErrorResponse(error)
  }
}
