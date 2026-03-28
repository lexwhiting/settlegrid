import { NextRequest } from 'next/server'
import { sql, eq, and, gte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations, payouts } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail, baseEmailTemplate, escapeHtml, sanitizeSubject, dataRow, dividerLine } from '@/lib/email'

export const maxDuration = 120

// ─── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'lexwhiting365@gmail.com'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WeeklyReportData {
  periodStart: string
  periodEnd: string
  totalActiveTools: number
  newToolsThisWeek: number
  totalInvocationsThisWeek: number
  totalRevenueCentsThisWeek: number
  top5Tools: Array<{
    name: string
    slug: string
    invocations: number
  }>
  categoryBreakdown: Array<{
    category: string
    toolCount: number
  }>
  averagePricingByCategory: Array<{
    category: string
    avgPriceCents: number
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats cents as a dollar string.
 */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Sends the weekly marketplace report email.
 */
async function sendReportEmail(report: WeeklyReportData): Promise<void> {
  const subject = sanitizeSubject(
    `SettleGrid Weekly Report: ${report.periodStart} - ${report.periodEnd}`
  )

  const top5Html = report.top5Tools.length > 0
    ? report.top5Tools
        .map(
          (t, i) =>
            `<tr>
  <td style="padding:6px 0;color:#374151;font-size:14px">${i + 1}. ${escapeHtml(t.name)}</td>
  <td align="right" style="padding:6px 0;color:#374151;font-size:14px">${t.invocations.toLocaleString()} calls</td>
</tr>`
        )
        .join('')
    : '<tr><td style="padding:6px 0;color:#9ca3af;font-size:14px" colspan="2">No invocations this week</td></tr>'

  const categoryHtml = report.categoryBreakdown.length > 0
    ? report.categoryBreakdown
        .map(
          (c) =>
            `<tr>
  <td style="padding:4px 0;color:#374151;font-size:13px">${escapeHtml(c.category || 'uncategorized')}</td>
  <td align="right" style="padding:4px 0;color:#374151;font-size:13px">${c.toolCount} tools</td>
</tr>`
        )
        .join('')
    : ''

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 8px">Weekly Marketplace Report</h2>
<p class="sg-text" style="color:#9ca3af;font-size:13px;margin:0 0 24px">${escapeHtml(report.periodStart)} &mdash; ${escapeHtml(report.periodEnd)}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${dataRow('Total Active Tools', String(report.totalActiveTools))}
${dataRow('New Tools This Week', String(report.newToolsThisWeek))}
${dataRow('Total Invocations', report.totalInvocationsThisWeek.toLocaleString())}
${dataRow('Total Revenue', formatCents(report.totalRevenueCentsThisWeek), true)}
</table>

${dividerLine()}

<h3 class="sg-heading" style="color:#1A1F3A;margin:0 0 12px;font-size:16px">Top 5 Tools by Invocations</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${top5Html}
</table>

${categoryHtml ? `
${dividerLine()}
<h3 class="sg-heading" style="color:#1A1F3A;margin:0 0 12px;font-size:16px">Category Breakdown</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${categoryHtml}
</table>
` : ''}
`,
    { preheader: `Active tools: ${report.totalActiveTools} | Revenue: ${formatCents(report.totalRevenueCentsThisWeek)}` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: generates and emails a weekly marketplace report.
 * Schedule: Monday 9 AM UTC
 *
 * Aggregates:
 *   - Total active tools
 *   - New tools this week
 *   - Total invocations this week
 *   - Total revenue settled this week
 *   - Top 5 tools by invocations
 *   - Category breakdown
 *   - Average pricing by category
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-weekly-report:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.weekly_report.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const periodStart = weekAgo.toISOString().slice(0, 10)
    const periodEnd = now.toISOString().slice(0, 10)

    // 1. Total active tools
    const [activeToolsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'active'))

    const totalActiveTools = activeToolsResult?.count ?? 0

    // 2. New tools this week (any status)
    const [newToolsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(gte(tools.createdAt, weekAgo))

    const newToolsThisWeek = newToolsResult?.count ?? 0

    // 3. Total invocations this week
    const [invocationsResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          gte(invocations.createdAt, weekAgo),
          eq(invocations.isTest, false)
        )
      )

    const totalInvocationsThisWeek = invocationsResult?.count ?? 0
    const totalRevenueCentsThisWeek = invocationsResult?.totalCents ?? 0

    // 4. Top 5 tools by invocations this week
    const top5ToolsRaw = await db
      .select({
        toolId: invocations.toolId,
        invocationCount: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(
        and(
          gte(invocations.createdAt, weekAgo),
          eq(invocations.isTest, false)
        )
      )
      .groupBy(invocations.toolId)
      .orderBy(desc(sql`count(*)`))
      .limit(5)

    // Resolve tool names for the top 5
    const top5Tools: WeeklyReportData['top5Tools'] = []
    for (const row of top5ToolsRaw) {
      const [tool] = await db
        .select({ name: tools.name, slug: tools.slug })
        .from(tools)
        .where(eq(tools.id, row.toolId))
        .limit(1)

      top5Tools.push({
        name: tool?.name ?? 'Unknown',
        slug: tool?.slug ?? '',
        invocations: row.invocationCount,
      })
    }

    // 5. Category breakdown (tools per category)
    const categoryBreakdown = await db
      .select({
        category: sql<string>`coalesce(${tools.category}, 'uncategorized')`,
        toolCount: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .groupBy(sql`coalesce(${tools.category}, 'uncategorized')`)
      .orderBy(desc(sql`count(*)`))
      .limit(20)

    // 6. Average pricing by category
    // pricingConfig is JSONB; extract defaultCostCents
    const avgPricingRaw = await db
      .select({
        category: sql<string>`coalesce(${tools.category}, 'uncategorized')`,
        avgPriceCents: sql<number>`coalesce(avg((${tools.pricingConfig}->>'defaultCostCents')::numeric), 0)::int`,
      })
      .from(tools)
      .where(
        and(
          eq(tools.status, 'active'),
          sql`${tools.pricingConfig} is not null`
        )
      )
      .groupBy(sql`coalesce(${tools.category}, 'uncategorized')`)
      .orderBy(desc(sql`avg((${tools.pricingConfig}->>'defaultCostCents')::numeric)`))
      .limit(20)

    const report: WeeklyReportData = {
      periodStart,
      periodEnd,
      totalActiveTools,
      newToolsThisWeek,
      totalInvocationsThisWeek,
      totalRevenueCentsThisWeek,
      top5Tools,
      categoryBreakdown: categoryBreakdown.map((r) => ({
        category: r.category,
        toolCount: r.toolCount,
      })),
      averagePricingByCategory: avgPricingRaw.map((r) => ({
        category: r.category,
        avgPriceCents: r.avgPriceCents,
      })),
    }

    // Log the report data (can be consumed by "State of MCP" page)
    logger.info('cron.weekly_report.data', { ...report })

    // Send report email
    try {
      await sendReportEmail(report)
      logger.info('cron.weekly_report.email_sent', { to: ADMIN_EMAIL })
    } catch (emailErr) {
      logger.error('cron.weekly_report.email_failed', {}, emailErr)
    }

    logger.info('cron.weekly_report.completed', {
      totalActiveTools,
      newToolsThisWeek,
      totalInvocationsThisWeek,
      totalRevenueCentsThisWeek,
    })

    return successResponse({
      report,
    })
  } catch (error) {
    logger.error('cron.weekly_report.failed', {}, error)
    return internalErrorResponse(error)
  }
}
