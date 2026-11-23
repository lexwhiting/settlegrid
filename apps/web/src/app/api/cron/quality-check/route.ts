import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tools, developers, invocations } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { sendNotificationEmail } from '@/lib/notifications'
import {
  toolSlowResponseEmail,
  toolHighErrorRateEmail,
  toolNoTrafficEmail,
} from '@/lib/email'

export const maxDuration = 60

// Cooldown keys expire after the cooldown period
const SLOW_RESPONSE_COOLDOWN_SECS = 24 * 60 * 60 // 24 hours
const ERROR_RATE_COOLDOWN_SECS = 24 * 60 * 60 // 24 hours
const NO_TRAFFIC_COOLDOWN_SECS = 7 * 24 * 60 * 60 // 7 days

// Thresholds
const SLOW_RESPONSE_MS = 2000
const HIGH_ERROR_RATE_PCT = 10
const NO_TRAFFIC_DAYS = 7
const MIN_INVOCATIONS_FOR_CHECK = 10 // minimum invocations in the hour to trigger alerts

/**
 * At most this many alert emails per run. Alerts over the cap are not sent and
 * get no cooldown, so a later run (every 15 minutes) sends them if they still apply.
 */
const MAX_ALERT_EMAILS_PER_RUN = 50

const COOLDOWN_LOOKUP_CHUNK = 100

/**
 * After a failed send, wait this long before trying the alert again, so an address
 * Resend keeps refusing doesn't take one of the run's slots every 15 minutes.
 */
const RETRY_AFTER_FAILURE_SECS = 60 * 60 // 1 hour

/**
 * The no-traffic alert is off (founder decision, 2026-11-22). Before this change it
 * never fired in production: postgres-js returns COUNT(*) as a string, so the old
 * `recentCount === 0` test was never true. Turning it on would start a new email
 * stream (one email per idle tool, including tools idle for months), so it stays off
 * until the founder decides how it should work.
 */
const NO_TRAFFIC_ALERTS_ENABLED = false

type AlertKind = 'slowResponse' | 'highErrorRate' | 'noTraffic'

interface ActiveTool {
  toolId: string
  toolName: string
  developerId: string
  devEmail: string
  devName: string | null
}

interface Candidate {
  kind: AlertKind
  tool: ActiveTool
  cooldownKey: string
  cooldownSecs: number
  avgLatency?: number
  invCount?: number
  errorRate?: number
  totalCount?: number
  errorCount?: number
}

/**
 * Vercel Cron handler: checks tool quality metrics and sends coaching emails.
 * Runs every 15 minutes.
 *
 * Checks every active tool, with grouped queries (no per-tool loop and no cap
 * on how many tools):
 *   1. Average response time >2000ms in the last hour
 *   2. Error rate >10% in the last hour
 *   3. Zero invocations for 7+ days (for previously active tools); switched off,
 *      see NO_TRAFFIC_ALERTS_ENABLED
 *
 * Alerts are sent in that order (the last-hour checks first), oldest tool first
 * within each check, up to MAX_ALERT_EMAILS_PER_RUN per run. The alert's cooldown
 * is set when the email was sent or the developer opted out of it; when the send
 * fails, no cooldown is set and the alert is tried again after an hour if it still
 * applies.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-quality-check:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.quality_check.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - NO_TRAFFIC_DAYS * 24 * 60 * 60 * 1000)

    const redis = getRedis()

    // Every active tool with its developer (no row cap), oldest first
    const activeTools: ActiveTool[] = await db
      .select({
        toolId: tools.id,
        toolName: tools.name,
        developerId: tools.developerId,
        devEmail: developers.email,
        devName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .orderBy(tools.createdAt, tools.id)
    const toolById = new Map(activeTools.map((t) => [t.toolId, t]))
    const activeToolIds = sql`(select ${tools.id} from ${tools} where ${tools.status} = 'active')`

    // ─── Checks 1 and 2: the last hour, per active tool, in one query ──────
    const lastHour = await db
      .select({
        toolId: invocations.toolId,
        avgLatency: sql<number>`coalesce(avg(${invocations.latencyMs}) filter (where ${invocations.latencyMs} is not null), 0)::float`,
        latencyCount: sql<number>`(count(*) filter (where ${invocations.latencyMs} is not null))::int`,
        totalCount: sql<number>`count(*)::int`,
        errorCount: sql<number>`(count(*) filter (where ${invocations.status} != 'success'))::int`,
      })
      .from(invocations)
      .where(and(
        sql`${invocations.toolId} in ${activeToolIds}`,
        sql`${invocations.createdAt} >= ${oneHourAgo.toISOString()}::timestamptz`,
      ))
      .groupBy(invocations.toolId)

    // ─── Check 3: previously active tools with no call in 7 days (off) ─────
    const idle = !NO_TRAFFIC_ALERTS_ENABLED ? [] : await db
      .select({ toolId: tools.id })
      .from(tools)
      .where(and(
        eq(tools.status, 'active'),
        sql`${tools.totalInvocations} > 0`,
        sql`not exists (select 1 from ${invocations} where ${invocations.toolId} = ${tools.id} and ${invocations.createdAt} >= ${sevenDaysAgo.toISOString()}::timestamptz)`,
      ))
      .orderBy(tools.createdAt, tools.id)

    // ─── Candidates, in sending order ──────────────────────────────────────
    const order = new Map(activeTools.map((t, i) => [t.toolId, i]))
    const byToolAge = <T extends { toolId: string }>(rows: T[]) =>
      rows.filter((r) => toolById.has(r.toolId)).sort((a, b) => (order.get(a.toolId) ?? 0) - (order.get(b.toolId) ?? 0))

    const candidates: Candidate[] = []
    const hourRows = byToolAge(lastHour)
    for (const row of hourRows) {
      const avgLatency = Math.round(row.avgLatency)
      if (avgLatency > SLOW_RESPONSE_MS && row.latencyCount >= MIN_INVOCATIONS_FOR_CHECK) {
        candidates.push({
          kind: 'slowResponse', tool: toolById.get(row.toolId)!, cooldownKey: `quality:slow:${row.toolId}`,
          cooldownSecs: SLOW_RESPONSE_COOLDOWN_SECS, avgLatency, invCount: row.latencyCount,
        })
      }
    }
    for (const row of hourRows) {
      if (row.totalCount >= MIN_INVOCATIONS_FOR_CHECK && row.errorCount > 0) {
        const errorRate = (row.errorCount / row.totalCount) * 100
        if (errorRate > HIGH_ERROR_RATE_PCT) {
          candidates.push({
            kind: 'highErrorRate', tool: toolById.get(row.toolId)!, cooldownKey: `quality:error:${row.toolId}`,
            cooldownSecs: ERROR_RATE_COOLDOWN_SECS, errorRate, totalCount: row.totalCount, errorCount: row.errorCount,
          })
        }
      }
    }
    for (const row of byToolAge(idle)) {
      candidates.push({
        kind: 'noTraffic', tool: toolById.get(row.toolId)!, cooldownKey: `quality:notraffic:${row.toolId}`,
        cooldownSecs: NO_TRAFFIC_COOLDOWN_SECS,
      })
    }

    // Cooldowns and retry waits, looked up in chunks
    const retryKey = (c: Candidate) => `${c.cooldownKey}:retry`
    const onCooldown = new Set<string>()
    for (let i = 0; i < candidates.length; i += COOLDOWN_LOOKUP_CHUNK) {
      const chunk = candidates.slice(i, i + COOLDOWN_LOOKUP_CHUNK)
      const keys = chunk.flatMap((c) => [c.cooldownKey, retryKey(c)])
      const values = await redis.mget<(string | null)[]>(...keys)
      chunk.forEach((c, j) => { if (values[2 * j] || values[2 * j + 1]) onCooldown.add(c.cooldownKey) })
    }

    // ─── Send, up to the cap ───────────────────────────────────────────────
    const alerts = { slowResponse: 0, highErrorRate: 0, noTraffic: 0 }
    let deferred = 0
    let failed = 0
    let skipped = 0 // opted out of quality alerts
    let sent = 0

    for (const c of candidates) {
      if (onCooldown.has(c.cooldownKey)) continue
      if (sent >= MAX_ALERT_EMAILS_PER_RUN) {
        deferred++
        continue
      }
      try {
        const devName = c.tool.devName ?? 'Developer'
        let tpl: { subject: string; html: string }
        if (c.kind === 'slowResponse') {
          tpl = toolSlowResponseEmail(devName, c.tool.toolName, c.avgLatency!)
        } else if (c.kind === 'highErrorRate') {
          tpl = toolHighErrorRateEmail(devName, c.tool.toolName, c.errorRate!)
        } else {
          // The last invocation date for the email
          const [lastInv] = await db
            .select({ lastAt: sql<string>`max(${invocations.createdAt})` })
            .from(invocations)
            .where(eq(invocations.toolId, c.tool.toolId))
            .limit(1)
          const lastDate = lastInv?.lastAt
            ? new Date(lastInv.lastAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })
            : 'unknown'
          tpl = toolNoTrafficEmail(devName, c.tool.toolName, lastDate)
        }
        sent++
        const outcome = await sendNotificationEmail({
          developerId: c.tool.developerId,
          eventKey: 'quality_alert',
          email: c.tool.devEmail,
          subject: tpl.subject,
          html: tpl.html,
        })
        if (outcome === 'failed') {
          // No cooldown: tried again after RETRY_AFTER_FAILURE_SECS if it still applies
          failed++
          await redis.set(retryKey(c), '1', { ex: RETRY_AFTER_FAILURE_SECS })
          logger.warn('cron.quality_check.send_failed', { toolId: c.tool.toolId, kind: c.kind })
          continue
        }
        await redis.set(c.cooldownKey, '1', { ex: c.cooldownSecs })
        if (outcome === 'opted_out') {
          skipped++
          continue
        }
        alerts[c.kind]++

        logger.info(`cron.quality_check.${c.kind === 'slowResponse' ? 'slow_response' : c.kind === 'highErrorRate' ? 'high_error_rate' : 'no_traffic'}`, {
          toolId: c.tool.toolId,
          ...(c.kind === 'slowResponse' ? { avgLatency: c.avgLatency, invCount: c.invCount } : {}),
          ...(c.kind === 'highErrorRate'
            ? { errorRate: Math.round(c.errorRate! * 10) / 10, totalCount: c.totalCount, errorCount: c.errorCount }
            : {}),
        })
      } catch (toolErr) {
        // Don't let one tool failure stop the batch
        logger.error('cron.quality_check.tool_failed', { toolId: c.tool.toolId }, toolErr)
      }
    }

    const totalAlerts = alerts.slowResponse + alerts.highErrorRate + alerts.noTraffic

    logger.info('cron.quality_check.completed', {
      toolsChecked: activeTools.length,
      totalAlerts,
      deferred,
      failed,
      skipped,
      ...alerts,
    })

    return successResponse({
      toolsChecked: activeTools.length,
      totalAlerts,
      alerts,
      deferred,
      failed,
      skipped,
    })
  } catch (error) {
    logger.error('cron.quality_check.failed', {}, error)
    return internalErrorResponse(error)
  }
}
