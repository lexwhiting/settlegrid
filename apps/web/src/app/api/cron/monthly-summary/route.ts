import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { developers, tools, invocations } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendNotificationEmail } from '@/lib/notifications'
import { monthlyDeveloperSummaryEmail } from '@/lib/email'
import type { MonthlySummaryData } from '@/lib/email'

export const maxDuration = 60

/**
 * Vercel Cron handler: sends monthly developer summary emails.
 * Runs on the 1st of each month at 9 AM UTC.
 *
 * For each developer with at least 1 active tool:
 *   - Total revenue this month
 *   - Total invocations
 *   - Top tool by revenue
 *   - Month-over-month trend (up/down %)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-monthly-summary:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.monthly_summary.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()

    // Calculate periods: last month (the month we're reporting on) and the month before
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1) // 1st of current month = end of last month
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth() - 1, 1)
    const prevMonthStart = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() - 1, 1)

    const monthName = lastMonthStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    })

    // Get all developers with at least 1 active tool
    const devsWithTools = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
      })
      .from(developers)
      .where(
        sql`EXISTS (SELECT 1 FROM ${tools} WHERE ${tools.developerId} = ${developers.id} AND ${tools.status} = 'active')`
      )
      .limit(10000)

    let emailsSent = 0

    for (const dev of devsWithTools) {
      try {
        const devName = dev.name ?? 'Developer'

        // ─── Last month stats ─────────────────────────────────────────
        const [lastMonthStats] = await db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)`,
            totalInvocations: sql<number>`COUNT(*)`,
          })
          .from(invocations)
          .innerJoin(tools, eq(invocations.toolId, tools.id))
          .where(
            and(
              eq(tools.developerId, dev.id),
              sql`${invocations.createdAt} >= ${lastMonthStart}`,
              sql`${invocations.createdAt} < ${lastMonthEnd}`
            )
          )
          .limit(1)

        const totalRevenue = lastMonthStats?.totalRevenue ?? 0
        const totalInvocations = lastMonthStats?.totalInvocations ?? 0

        // Skip if zero activity
        if (totalInvocations === 0) continue

        // ─── Top tool by revenue ──────────────────────────────────────
        const [topTool] = await db
          .select({
            toolName: tools.name,
            revenue: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)`,
          })
          .from(invocations)
          .innerJoin(tools, eq(invocations.toolId, tools.id))
          .where(
            and(
              eq(tools.developerId, dev.id),
              sql`${invocations.createdAt} >= ${lastMonthStart}`,
              sql`${invocations.createdAt} < ${lastMonthEnd}`
            )
          )
          .groupBy(tools.name)
          .orderBy(sql`SUM(${invocations.costCents}) DESC`)
          .limit(1)

        // ─── Previous month stats (for MoM trend) ────────────────────
        const [prevMonthStats] = await db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)`,
            totalInvocations: sql<number>`COUNT(*)`,
          })
          .from(invocations)
          .innerJoin(tools, eq(invocations.toolId, tools.id))
          .where(
            and(
              eq(tools.developerId, dev.id),
              sql`${invocations.createdAt} >= ${prevMonthStart}`,
              sql`${invocations.createdAt} < ${lastMonthStart}`
            )
          )
          .limit(1)

        const prevRevenue = prevMonthStats?.totalRevenue ?? 0
        const prevInvocations = prevMonthStats?.totalInvocations ?? 0

        // Calculate MoM trends
        const momRevenuePct = prevRevenue > 0
          ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
          : null

        const momInvocationPct = prevInvocations > 0
          ? ((totalInvocations - prevInvocations) / prevInvocations) * 100
          : null

        const summaryData: MonthlySummaryData = {
          totalRevenueCents: totalRevenue,
          totalInvocations,
          topToolName: topTool?.toolName ?? null,
          topToolRevenueCents: topTool?.revenue ?? 0,
          momRevenuePct,
          momInvocationPct,
        }

        const tpl = monthlyDeveloperSummaryEmail(devName, monthName, summaryData)

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

    logger.info('cron.monthly_summary.completed', {
      month: monthName,
      devsChecked: devsWithTools.length,
      emailsSent,
    })

    return successResponse({
      month: monthName,
      devsChecked: devsWithTools.length,
      emailsSent,
    })
  } catch (error) {
    logger.error('cron.monthly_summary.failed', {}, error)
    return internalErrorResponse(error)
  }
}
