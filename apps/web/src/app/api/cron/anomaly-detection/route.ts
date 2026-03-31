import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'
import { notifyDeveloper } from '@/lib/notifications'
import { baseEmailTemplate } from '@/lib/email'

export const maxDuration = 120

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLLING_WINDOW_DAYS = 7
const STD_DEV_THRESHOLD = 2
const MIN_INVOCATIONS_FOR_DETECTION = 10

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnomalyResult {
  toolId: string
  toolName: string
  developerId: string
  todayCount: number
  rollingAvg: number
  rollingStdDev: number
  zScore: number
  direction: 'spike' | 'drop'
}

/**
 * Vercel Cron handler: anomaly detection for invocation counts.
 * Compares today's invocation count per tool to the 7-day rolling average.
 * If deviation > 2 standard deviations, triggers an alert.
 * Alert delivery gated behind 'anomaly_detection' feature (Scale+).
 * Schedule: every 6 hours
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-anomaly:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.anomaly.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // ── Get all active tools ─────────────────────────────────────────────
    const activeTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        developerId: tools.developerId,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(1000)

    if (activeTools.length === 0) {
      return successResponse({ checked: 0, anomalies: 0, message: 'No active tools' })
    }

    const toolIds = activeTools.map((t) => t.id)

    // ── Get today's counts per tool ──────────────────────────────────────
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayCounts = await db
      .select({
        toolId: invocations.toolId,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        gte(invocations.createdAt, sql`${todayStart.toISOString()}::timestamptz`),
      ))
      .groupBy(invocations.toolId)
      .limit(1000)

    const todayCountMap = new Map(todayCounts.map((r) => [r.toolId, r.count]))

    // ── Get daily counts for rolling window (per tool, per day) ──────────
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - ROLLING_WINDOW_DAYS)

    const dailyCounts = await db
      .select({
        toolId: invocations.toolId,
        date: sql<string>`to_char(${invocations.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(and(
        inArray(invocations.toolId, toolIds),
        gte(invocations.createdAt, sql`${windowStart.toISOString()}::timestamptz`),
      ))
      .groupBy(invocations.toolId, sql`${invocations.createdAt}::date`)
      .limit(10000)

    // Group daily counts by tool
    const toolDailyCounts = new Map<string, number[]>()
    for (const row of dailyCounts) {
      const existing = toolDailyCounts.get(row.toolId) ?? []
      existing.push(row.count)
      toolDailyCounts.set(row.toolId, existing)
    }

    // ── Detect anomalies ─────────────────────────────────────────────────
    const anomalies: AnomalyResult[] = []
    const toolNameMap = new Map(activeTools.map((t) => [t.id, { name: t.name, developerId: t.developerId }]))

    for (const [toolId, dailyValues] of toolDailyCounts) {
      if (dailyValues.length < 2) continue // Need at least 2 days for meaningful stats

      const todayCount = todayCountMap.get(toolId) ?? 0
      if (todayCount < MIN_INVOCATIONS_FOR_DETECTION && dailyValues.every((v) => v < MIN_INVOCATIONS_FOR_DETECTION)) {
        continue // Skip tools with very low traffic
      }

      // Calculate mean and standard deviation
      const n = dailyValues.length
      const mean = dailyValues.reduce((s, v) => s + v, 0) / n
      const variance = dailyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n
      const stdDev = Math.sqrt(variance)

      // Avoid division by zero
      if (stdDev === 0) continue

      const zScore = (todayCount - mean) / stdDev

      if (Math.abs(zScore) > STD_DEV_THRESHOLD) {
        const toolInfo = toolNameMap.get(toolId)
        if (!toolInfo) continue

        anomalies.push({
          toolId,
          toolName: toolInfo.name,
          developerId: toolInfo.developerId,
          todayCount,
          rollingAvg: Math.round(mean),
          rollingStdDev: Math.round(stdDev * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          direction: zScore > 0 ? 'spike' : 'drop',
        })
      }
    }

    // ── Notify developers (gated behind anomaly_detection feature) ───────
    // Group anomalies by developer
    const byDeveloper = new Map<string, AnomalyResult[]>()
    for (const anomaly of anomalies) {
      const existing = byDeveloper.get(anomaly.developerId) ?? []
      existing.push(anomaly)
      byDeveloper.set(anomaly.developerId, existing)
    }

    let notifiedCount = 0

    for (const [developerId, devAnomalies] of byDeveloper) {
      // Look up developer tier
      const [dev] = await db
        .select({
          tier: developers.tier,
          isFoundingMember: developers.isFoundingMember,
          email: developers.email,
          name: developers.name,
        })
        .from(developers)
        .where(eq(developers.id, developerId))
        .limit(1)

      if (!dev) continue

      // Gate behind anomaly_detection (Scale+)
      if (!hasFeature(dev.tier, 'anomaly_detection', dev.isFoundingMember)) continue

      const toolSummaries = devAnomalies
        .map((a) => `${a.toolName}: ${a.todayCount} invocations today (${a.direction}, avg: ${a.rollingAvg}, z-score: ${a.zScore})`)
        .join('\n')

      const message = `[SettleGrid] Anomaly Detected: ${devAnomalies.length === 1 ? `"${devAnomalies[0].toolName}" has unusual traffic (${devAnomalies[0].direction})` : `${devAnomalies.length} tools have unusual traffic patterns`}.\n\n${toolSummaries}`

      const emailHtml = baseEmailTemplate(
        `<h2 style="margin:0 0 16px;">Anomaly Detection Alert</h2>
        <p>Hi ${dev.name ?? 'Developer'},</p>
        <p>Our anomaly detection system identified unusual invocation patterns for your tool${devAnomalies.length > 1 ? 's' : ''}:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Tool</th>
            <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Today</th>
            <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">7-day Avg</th>
            <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Z-Score</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Direction</th>
          </tr>
          ${devAnomalies.map((a) => `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.toolName}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">${a.todayCount.toLocaleString()}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">${a.rollingAvg.toLocaleString()}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">${a.zScore}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.direction === 'spike' ? 'Spike' : 'Drop'}</td>
          </tr>`).join('')}
        </table>
        <p>Check your dashboard for more details. If this looks expected, no action is needed.</p>`
      )

      // Fire-and-forget
      notifyDeveloper({
        developerId,
        event: 'tool.anomaly_detected',
        message,
        email: {
          to: dev.email,
          subject: `[SettleGrid] Anomaly Alert: ${devAnomalies.length === 1 ? devAnomalies[0].toolName : `${devAnomalies.length} tools`}`,
          html: emailHtml,
        },
      }).catch((err) => {
        logger.error('cron.anomaly.notify_failed', { developerId }, err)
      })

      notifiedCount++
    }

    logger.info('cron.anomaly_detection.completed', {
      toolsChecked: toolDailyCounts.size,
      anomaliesFound: anomalies.length,
      developersNotified: notifiedCount,
    })

    return successResponse({
      toolsChecked: toolDailyCounts.size,
      anomaliesFound: anomalies.length,
      developersNotified: notifiedCount,
      anomalies: anomalies.map((a) => ({
        toolId: a.toolId,
        toolName: a.toolName,
        todayCount: a.todayCount,
        rollingAvg: a.rollingAvg,
        zScore: a.zScore,
        direction: a.direction,
      })),
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
