import { NextRequest } from 'next/server'
import { sql, eq, and, gte, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations, consumers, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail, baseEmailTemplate, escapeHtml, sanitizeSubject, dataRow, dividerLine } from '@/lib/email'
import { hasFeature } from '@/lib/tier-config'
import { getRedis } from '@/lib/redis'

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
  // Seed/demo traffic (consumers without supabase_user_id)
  seedInvocationsThisWeek: number
  seedRevenueCentsThisWeek: number
  // Real traffic (consumers with supabase_user_id = authenticated users)
  realInvocationsThisWeek: number
  realRevenueCentsThisWeek: number
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
</table>

${dividerLine()}

<h3 class="sg-heading" style="color:#1A1F3A;margin:0 0 12px;font-size:16px">Real Traffic (Authenticated Users)</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${dataRow('Invocations', report.realInvocationsThisWeek.toLocaleString())}
${dataRow('Revenue', formatCents(report.realRevenueCentsThisWeek), true)}
</table>

<h3 class="sg-heading" style="color:#9ca3af;margin:16px 0 12px;font-size:14px">Seed / Demo Traffic</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${dataRow('Invocations', report.seedInvocationsThisWeek.toLocaleString())}
${dataRow('Revenue (not withdrawable)', formatCents(report.seedRevenueCentsThisWeek))}
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
    { preheader: `Active tools: ${report.totalActiveTools} | Real revenue: ${formatCents(report.realRevenueCentsThisWeek)} | Real invocations: ${report.realInvocationsThisWeek.toLocaleString()}` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Enhanced Report Types (Scale+) ──────────────────────────────────────────

interface EnhancedReportData {
  revenueByTool: Array<{ toolName: string; revenueCents: number; invocations: number }>
  topConsumers: Array<{ email: string; spendCents: number; invocations: number }>
  anomalySummary: Array<{ toolName: string; direction: string; todayCount: number; avg: number }>
  categoryBenchmark: Array<{ category: string; yourAvgPriceCents: number; categoryMedianCents: number; position: string }>
  forecastNextMonthCents: number
  forecastGrowthRate: number
}

/**
 * Gather enhanced report data for a Scale+ developer.
 */
async function gatherEnhancedReport(
  developerId: string,
  weekAgo: Date,
): Promise<EnhancedReportData> {
  // Get developer's tools
  const devTools = await db
    .select({ id: tools.id, name: tools.name, category: tools.category })
    .from(tools)
    .where(eq(tools.developerId, developerId))
    .limit(100)

  const toolIds = devTools.map((t) => t.id)
  const emptyReport: EnhancedReportData = {
    revenueByTool: [],
    topConsumers: [],
    anomalySummary: [],
    categoryBenchmark: [],
    forecastNextMonthCents: 0,
    forecastGrowthRate: 0,
  }

  if (toolIds.length === 0) return emptyReport

  // Revenue breakdown by tool
  const revenueByToolRaw = await db
    .select({
      toolId: invocations.toolId,
      revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      invocationCount: sql<number>`count(*)::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, weekAgo),
      eq(invocations.isTest, false),
    ))
    .groupBy(invocations.toolId)
    .orderBy(sql`sum(${invocations.costCents}) desc`)
    .limit(20)

  const toolNameMap = new Map(devTools.map((t) => [t.id, t.name]))

  const revenueByTool = revenueByToolRaw.map((r) => ({
    toolName: toolNameMap.get(r.toolId) ?? 'Unknown',
    revenueCents: r.revenueCents,
    invocations: r.invocationCount,
  }))

  // Top 5 consumers
  const topConsumersRaw = await db
    .select({
      consumerId: invocations.consumerId,
      spendCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      invocationCount: sql<number>`count(*)::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, weekAgo),
      eq(invocations.isTest, false),
    ))
    .groupBy(invocations.consumerId)
    .orderBy(sql`sum(${invocations.costCents}) desc`)
    .limit(5)

  const cIds = topConsumersRaw.map((r) => r.consumerId)
  const cEmails = cIds.length > 0
    ? await db
        .select({ id: consumers.id, email: consumers.email })
        .from(consumers)
        .where(inArray(consumers.id, cIds))
        .limit(5)
    : []
  const cEmailMap = new Map(cEmails.map((c) => [c.id, c.email]))

  const topConsumers = topConsumersRaw.map((r) => ({
    email: cEmailMap.get(r.consumerId) ?? 'unknown',
    spendCents: r.spendCents,
    invocations: r.invocationCount,
  }))

  // Anomaly summary: compare this week's daily avg to last week's
  const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000)

  const thisWeekDailyCounts = await db
    .select({
      toolId: invocations.toolId,
      dailyAvg: sql<number>`(count(*)::float / greatest(extract(epoch from (now() - ${weekAgo.toISOString()}::timestamptz)) / 86400, 1))::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, weekAgo),
    ))
    .groupBy(invocations.toolId)
    .limit(100)

  const lastWeekDailyCounts = await db
    .select({
      toolId: invocations.toolId,
      dailyAvg: sql<number>`(count(*)::float / 7)::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, twoWeeksAgo),
      sql`${invocations.createdAt} < ${weekAgo.toISOString()}::timestamptz`,
    ))
    .groupBy(invocations.toolId)
    .limit(100)

  const lastWeekMap = new Map(lastWeekDailyCounts.map((r) => [r.toolId, r.dailyAvg]))

  const anomalySummary: EnhancedReportData['anomalySummary'] = []
  for (const curr of thisWeekDailyCounts) {
    const prev = lastWeekMap.get(curr.toolId) ?? 0
    if (prev < 5) continue // skip low-traffic
    const change = (curr.dailyAvg - prev) / prev
    if (Math.abs(change) > 0.5) {
      anomalySummary.push({
        toolName: toolNameMap.get(curr.toolId) ?? 'Unknown',
        direction: change > 0 ? 'spike' : 'drop',
        todayCount: curr.dailyAvg,
        avg: prev,
      })
    }
  }

  // Category benchmark: compare developer's avg price to category median
  const toolCategories = devTools.map((t) => t.category).filter(Boolean) as string[]
  const uniqueCategories = [...new Set(toolCategories)]

  const categoryBenchmark: EnhancedReportData['categoryBenchmark'] = []
  if (uniqueCategories.length > 0) {
    const yourAvgPrices = await db
      .select({
        category: tools.category,
        avgPriceCents: sql<number>`coalesce(avg(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(
        inArray(invocations.toolId, toolIds),
        gte(invocations.createdAt, weekAgo),
      ))
      .groupBy(tools.category)
      .limit(20)

    const categoryMedians = await db
      .select({
        category: tools.category,
        medianPriceCents: sql<number>`coalesce(percentile_cont(0.50) within group (order by ${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(
        eq(tools.status, 'active'),
        inArray(tools.category, uniqueCategories),
        gte(invocations.createdAt, weekAgo),
      ))
      .groupBy(tools.category)
      .limit(20)

    const medianMap = new Map(
      categoryMedians
        .filter((r): r is typeof r & { category: string } => r.category !== null)
        .map((r) => [r.category, r.medianPriceCents])
    )

    for (const row of yourAvgPrices) {
      if (!row.category) continue
      const median = medianMap.get(row.category) ?? 0
      const diff = median > 0 ? Math.round(((row.avgPriceCents - median) / median) * 100) : 0
      categoryBenchmark.push({
        category: row.category,
        yourAvgPriceCents: row.avgPriceCents,
        categoryMedianCents: median,
        position: diff > 5 ? `${diff}% above median` : diff < -5 ? `${Math.abs(diff)}% below median` : 'At median',
      })
    }
  }

  // Revenue forecast (simple extrapolation)
  const dailyRevenue = await db
    .select({
      revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, weekAgo),
      eq(invocations.isTest, false),
    ))
    .limit(1)

  const weekRevenue = dailyRevenue[0]?.revenueCents ?? 0
  const forecastNextMonthCents = Math.round(weekRevenue * (30 / 7))

  // Growth rate: compare this week to the week before
  const lastWeekRevenue = await db
    .select({
      revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
    })
    .from(invocations)
    .where(and(
      inArray(invocations.toolId, toolIds),
      gte(invocations.createdAt, twoWeeksAgo),
      sql`${invocations.createdAt} < ${weekAgo.toISOString()}::timestamptz`,
      eq(invocations.isTest, false),
    ))
    .limit(1)

  const prevWeekRevenue = lastWeekRevenue[0]?.revenueCents ?? 0
  const forecastGrowthRate = prevWeekRevenue > 0
    ? Math.round(((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 10000) / 10000
    : 0

  return {
    revenueByTool,
    topConsumers,
    anomalySummary,
    categoryBenchmark,
    forecastNextMonthCents,
    forecastGrowthRate,
  }
}

/**
 * Sends an enhanced weekly report email to a Scale+ developer.
 */
async function sendEnhancedDevReport(
  email: string,
  name: string | null,
  enhanced: EnhancedReportData,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const subject = sanitizeSubject(
    `SettleGrid Enhanced Weekly Report: ${periodStart} - ${periodEnd}`
  )

  const revenueByToolHtml = enhanced.revenueByTool.length > 0
    ? enhanced.revenueByTool.map((t) =>
        `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(t.toolName)}</td>
          <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${formatCents(t.revenueCents)}</td>
          <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${t.invocations.toLocaleString()}</td>
        </tr>`
      ).join('')
    : '<tr><td colspan="3" style="padding:8px;color:#9ca3af;">No revenue this week</td></tr>'

  const topConsumersHtml = enhanced.topConsumers.length > 0
    ? enhanced.topConsumers.map((c, i) =>
        `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${i + 1}. ${escapeHtml(c.email)}</td>
          <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${formatCents(c.spendCents)}</td>
          <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">${c.invocations.toLocaleString()}</td>
        </tr>`
      ).join('')
    : '<tr><td colspan="3" style="padding:8px;color:#9ca3af;">No consumer activity</td></tr>'

  const anomalyHtml = enhanced.anomalySummary.length > 0
    ? enhanced.anomalySummary.map((a) =>
        `<li>${escapeHtml(a.toolName)}: ${a.direction} (${a.todayCount} vs avg ${a.avg})</li>`
      ).join('')
    : '<li>No anomalies detected</li>'

  const benchmarkHtml = enhanced.categoryBenchmark.length > 0
    ? enhanced.categoryBenchmark.map((b) =>
        `<li>${escapeHtml(b.category)}: ${escapeHtml(b.position)} (your avg: ${formatCents(b.yourAvgPriceCents)}, median: ${formatCents(b.categoryMedianCents)})</li>`
      ).join('')
    : '<li>No benchmark data available</li>'

  const growthPct = Math.round(enhanced.forecastGrowthRate * 100)
  const growthStr = growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`

  const html = baseEmailTemplate(
    `<h2 style="color:#1A1F3A;margin:0 0 8px;">Enhanced Weekly Report</h2>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 24px;">${escapeHtml(periodStart)} &mdash; ${escapeHtml(periodEnd)}</p>
    <p>Hi ${escapeHtml(name ?? 'Developer')},</p>

    <h3 style="color:#1A1F3A;margin:20px 0 8px;font-size:16px;">Revenue by Tool</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;">Tool</th>
        <th style="text-align:right;padding:6px 8px;">Revenue</th>
        <th style="text-align:right;padding:6px 8px;">Invocations</th>
      </tr>
      ${revenueByToolHtml}
    </table>

    ${dividerLine()}

    <h3 style="color:#1A1F3A;margin:20px 0 8px;font-size:16px;">Top 5 Consumers</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f5f5f5;">
        <th style="text-align:left;padding:6px 8px;">Consumer</th>
        <th style="text-align:right;padding:6px 8px;">Spend</th>
        <th style="text-align:right;padding:6px 8px;">Invocations</th>
      </tr>
      ${topConsumersHtml}
    </table>

    ${dividerLine()}

    <h3 style="color:#1A1F3A;margin:20px 0 8px;font-size:16px;">Anomaly Summary</h3>
    <ul style="font-size:13px;color:#374151;">${anomalyHtml}</ul>

    <h3 style="color:#1A1F3A;margin:20px 0 8px;font-size:16px;">Category Benchmark</h3>
    <ul style="font-size:13px;color:#374151;">${benchmarkHtml}</ul>

    ${dividerLine()}

    <h3 style="color:#1A1F3A;margin:20px 0 8px;font-size:16px;">Revenue Forecast</h3>
    <p style="font-size:14px;color:#374151;">
      Projected next month: <strong>${formatCents(enhanced.forecastNextMonthCents)}</strong> (${growthStr} WoW)
    </p>

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      This enhanced report is available on the Scale plan. View your full dashboard at settlegrid.ai/dashboard.
    </p>`
  )

  await sendEmail({ to: email, subject, html })
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

    // 3. Total invocations this week — split real vs seed
    // Real = consumer has supabase_user_id (authenticated via OAuth)
    // Seed = consumer has no supabase_user_id (demo/test data)
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

    // Real invocations: join with consumers to check supabase_user_id
    const [realResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .innerJoin(consumers, eq(invocations.consumerId, consumers.id))
      .where(
        and(
          gte(invocations.createdAt, weekAgo),
          eq(invocations.isTest, false),
          sql`${consumers.supabaseUserId} IS NOT NULL`
        )
      )

    const realInvocationsThisWeek = realResult?.count ?? 0
    const realRevenueCentsThisWeek = realResult?.totalCents ?? 0
    const seedInvocationsThisWeek = totalInvocationsThisWeek - realInvocationsThisWeek
    const seedRevenueCentsThisWeek = totalRevenueCentsThisWeek - realRevenueCentsThisWeek

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
      seedInvocationsThisWeek,
      seedRevenueCentsThisWeek,
      realInvocationsThisWeek,
      realRevenueCentsThisWeek,
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

    // ── Set Tool of the Week spotlight ─────────────────────────────────
    // The top tool by invocations this week becomes the spotlight tool
    if (top5Tools.length > 0) {
      try {
        const topSlug = top5Tools[0].slug
        const topInvocations = top5Tools[0].invocations
        const [spotlightTool] = await db
          .select({
            id: tools.id,
            name: tools.name,
            slug: tools.slug,
            description: tools.description,
            category: tools.category,
            toolType: tools.toolType,
            totalInvocations: tools.totalInvocations,
            developerId: tools.developerId,
          })
          .from(tools)
          .where(eq(tools.slug, topSlug))
          .limit(1)

        if (spotlightTool) {
          const redis = getRedis()
          const SPOTLIGHT_TTL_SECONDS = 8 * 24 * 60 * 60 // 8 days
          await redis.set('spotlight:current', JSON.stringify({
            id: spotlightTool.id,
            name: spotlightTool.name,
            slug: spotlightTool.slug,
            description: spotlightTool.description,
            category: spotlightTool.category,
            toolType: spotlightTool.toolType,
            totalInvocations: spotlightTool.totalInvocations,
          }), { ex: SPOTLIGHT_TTL_SECONDS })

          logger.info('cron.weekly_report.spotlight_set', { slug: spotlightTool.slug })

          // Get this week's revenue for the spotlight tool
          const [spotlightRevenue] = await db
            .select({
              revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
            })
            .from(invocations)
            .where(
              and(
                eq(invocations.toolId, spotlightTool.id),
                gte(invocations.createdAt, weekAgo),
                eq(invocations.isTest, false)
              )
            )
            .limit(1)

          const weekRevenueCents = spotlightRevenue?.revenueCents ?? 0

          // Send Tool of the Week section in a follow-up admin email
          const totwSubject = sanitizeSubject(
            `Tool of the Week: ${spotlightTool.name}`
          )
          const totwHtml = baseEmailTemplate(
            `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 8px">Tool of the Week</h2>
<p class="sg-text" style="color:#9ca3af;font-size:13px;margin:0 0 24px">${escapeHtml(periodStart)} &mdash; ${escapeHtml(periodEnd)}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${dataRow('Tool Name', escapeHtml(spotlightTool.name))}
${dataRow('Category', escapeHtml(spotlightTool.category ?? 'uncategorized'))}
${dataRow('Invocations This Week', topInvocations.toLocaleString())}
${dataRow('Revenue This Week', formatCents(weekRevenueCents))}
</table>

<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0 8px">
${escapeHtml(spotlightTool.description ?? 'No description available.')}
</p>

<p style="margin:16px 0">
<a href="https://settlegrid.ai/tools/${escapeHtml(spotlightTool.slug)}" style="color:#E5A336;font-weight:600;text-decoration:underline">
View Tool Page
</a>
</p>
`,
            { preheader: `Tool of the Week: ${spotlightTool.name} (${topInvocations.toLocaleString()} invocations)` }
          )

          try {
            await sendEmail({ to: ADMIN_EMAIL, subject: totwSubject, html: totwHtml })
            logger.info('cron.weekly_report.totw_email_sent')
          } catch (totwErr) {
            logger.error('cron.weekly_report.totw_email_failed', {}, totwErr)
          }

          // Send congratulations email to the developer
          const [spotlightDev] = await db
            .select({
              email: developers.email,
              name: developers.name,
            })
            .from(developers)
            .where(eq(developers.id, spotlightTool.developerId))
            .limit(1)

          if (spotlightDev) {
            const congratsSubject = sanitizeSubject(
              `Congratulations! ${spotlightTool.name} is SettleGrid's Tool of the Week`
            )
            const congratsHtml = baseEmailTemplate(
              `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">Your Tool is Tool of the Week!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px">
Hi ${escapeHtml(spotlightDev.name ?? 'Developer')},
</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">
Congratulations! <strong>${escapeHtml(spotlightTool.name)}</strong> has been selected as
SettleGrid's <strong>Tool of the Week</strong> for the period ${escapeHtml(periodStart)} to ${escapeHtml(periodEnd)}.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${dataRow('Invocations This Week', topInvocations.toLocaleString())}
${dataRow('Revenue This Week', formatCents(weekRevenueCents))}
${dataRow('Total Invocations (All Time)', spotlightTool.totalInvocations.toLocaleString())}
</table>

<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0">
Your tool is being featured on the SettleGrid homepage and in our marketplace spotlight.
Keep up the great work!
</p>

<p style="margin:16px 0">
<a href="https://settlegrid.ai/tools/${escapeHtml(spotlightTool.slug)}" style="display:inline-block;background:#E5A336;color:white;padding:10px 24px;border-radius:8px;font-weight:600;text-decoration:none">
View Your Tool Page
</a>
</p>
`,
              { preheader: `${spotlightTool.name} is SettleGrid's Tool of the Week!` }
            )

            try {
              await sendEmail({ to: spotlightDev.email, subject: congratsSubject, html: congratsHtml })
              logger.info('cron.weekly_report.congrats_email_sent', { to: spotlightDev.email })
            } catch (congratsErr) {
              logger.error('cron.weekly_report.congrats_email_failed', { to: spotlightDev.email }, congratsErr)
            }
          }
        }
      } catch (spotlightErr) {
        logger.error('cron.weekly_report.spotlight_failed', {}, spotlightErr)
      }
    }

    // ── Enhanced per-developer reports for Scale+ ──────────────────────
    // Gather all developers with weekly_report feature
    const allDevelopers = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        tier: developers.tier,
        isFoundingMember: developers.isFoundingMember,
      })
      .from(developers)
      .limit(5000)

    let enhancedReportsSent = 0

    for (const dev of allDevelopers) {
      if (!hasFeature(dev.tier, 'weekly_report', dev.isFoundingMember)) continue

      try {
        const enhanced = await gatherEnhancedReport(dev.id, weekAgo)
        await sendEnhancedDevReport(dev.email, dev.name, enhanced, periodStart, periodEnd)
        enhancedReportsSent++
      } catch (devErr) {
        logger.error('cron.weekly_report.dev_report_failed', { developerId: dev.id }, devErr)
      }
    }

    logger.info('cron.weekly_report.completed', {
      totalActiveTools,
      newToolsThisWeek,
      totalInvocationsThisWeek,
      totalRevenueCentsThisWeek,
      enhancedReportsSent,
    })

    return successResponse({
      report,
      enhancedReportsSent,
    })
  } catch (error) {
    logger.error('cron.weekly_report.failed', {}, error)
    return internalErrorResponse(error)
  }
}
