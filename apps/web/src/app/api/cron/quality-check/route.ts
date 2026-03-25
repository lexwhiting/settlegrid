import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tools, developers, invocations } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
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
 * Vercel Cron handler: checks tool quality metrics and sends coaching emails.
 * Runs every 15 minutes.
 *
 * Checks for each active tool:
 *   1. Average response time >2000ms in the last hour
 *   2. Error rate >10% in the last hour
 *   3. Zero invocations for 7+ days (for previously active tools)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-quality-check:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.quality_check.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - NO_TRAFFIC_DAYS * 24 * 60 * 60 * 1000)

    const redis = getRedis()

    // Fetch active tools with their developer info
    const activeTools = await db
      .select({
        toolId: tools.id,
        toolName: tools.name,
        developerId: tools.developerId,
        totalInvocations: tools.totalInvocations,
        devEmail: developers.email,
        devName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .limit(500)

    const alerts = { slowResponse: 0, highErrorRate: 0, noTraffic: 0 }

    for (const tool of activeTools) {
      try {
        const devName = tool.devName ?? 'Developer'

        // ─── Check 1: Slow response time ──────────────────────────────
        const [latencyResult] = await db
          .select({
            avgLatency: sql<number>`COALESCE(AVG(${invocations.latencyMs}), 0)`,
            invCount: sql<number>`COUNT(*)`,
          })
          .from(invocations)
          .where(
            and(
              eq(invocations.toolId, tool.toolId),
              sql`${invocations.createdAt} >= ${oneHourAgo}`,
              sql`${invocations.latencyMs} IS NOT NULL`
            )
          )
          .limit(1)

        const avgLatency = Math.round(latencyResult?.avgLatency ?? 0)
        const latencyInvCount = latencyResult?.invCount ?? 0

        if (avgLatency > SLOW_RESPONSE_MS && latencyInvCount >= MIN_INVOCATIONS_FOR_CHECK) {
          const cooldownKey = `quality:slow:${tool.toolId}`
          const alreadySent = await redis.get<string>(cooldownKey)

          if (!alreadySent) {
            const tpl = toolSlowResponseEmail(devName, tool.toolName, avgLatency)
            await sendNotificationEmail({
              developerId: tool.developerId,
              eventKey: 'quality_alert',
              email: tool.devEmail,
              subject: tpl.subject,
              html: tpl.html,
            })
            await redis.set(cooldownKey, '1', { ex: SLOW_RESPONSE_COOLDOWN_SECS })
            alerts.slowResponse++

            logger.info('cron.quality_check.slow_response', {
              toolId: tool.toolId,
              avgLatency,
              invCount: latencyInvCount,
            })
          }
        }

        // ─── Check 2: High error rate ─────────────────────────────────
        const [errorResult] = await db
          .select({
            totalCount: sql<number>`COUNT(*)`,
            errorCount: sql<number>`COUNT(*) FILTER (WHERE ${invocations.status} != 'success')`,
          })
          .from(invocations)
          .where(
            and(
              eq(invocations.toolId, tool.toolId),
              sql`${invocations.createdAt} >= ${oneHourAgo}`
            )
          )
          .limit(1)

        const totalCount = errorResult?.totalCount ?? 0
        const errorCount = errorResult?.errorCount ?? 0

        if (totalCount >= MIN_INVOCATIONS_FOR_CHECK && errorCount > 0) {
          const errorRate = (errorCount / totalCount) * 100

          if (errorRate > HIGH_ERROR_RATE_PCT) {
            const cooldownKey = `quality:error:${tool.toolId}`
            const alreadySent = await redis.get<string>(cooldownKey)

            if (!alreadySent) {
              const tpl = toolHighErrorRateEmail(devName, tool.toolName, errorRate)
              await sendNotificationEmail({
                developerId: tool.developerId,
                eventKey: 'quality_alert',
                email: tool.devEmail,
                subject: tpl.subject,
                html: tpl.html,
              })
              await redis.set(cooldownKey, '1', { ex: ERROR_RATE_COOLDOWN_SECS })
              alerts.highErrorRate++

              logger.info('cron.quality_check.high_error_rate', {
                toolId: tool.toolId,
                errorRate: Math.round(errorRate * 10) / 10,
                totalCount,
                errorCount,
              })
            }
          }
        }

        // ─── Check 3: No traffic for 7 days (previously active) ──────
        // Only check tools that have had at least 1 invocation historically
        if (tool.totalInvocations > 0) {
          const [recentResult] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(invocations)
            .where(
              and(
                eq(invocations.toolId, tool.toolId),
                sql`${invocations.createdAt} >= ${sevenDaysAgo}`
              )
            )
            .limit(1)

          const recentCount = recentResult?.count ?? 0

          if (recentCount === 0) {
            const cooldownKey = `quality:notraffic:${tool.toolId}`
            const alreadySent = await redis.get<string>(cooldownKey)

            if (!alreadySent) {
              // Get the last invocation date for the email
              const [lastInv] = await db
                .select({ lastAt: sql<string>`MAX(${invocations.createdAt})` })
                .from(invocations)
                .where(eq(invocations.toolId, tool.toolId))
                .limit(1)

              const lastDate = lastInv?.lastAt
                ? new Date(lastInv.lastAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'unknown'

              const tpl = toolNoTrafficEmail(devName, tool.toolName, lastDate)
              await sendNotificationEmail({
                developerId: tool.developerId,
                eventKey: 'quality_alert',
                email: tool.devEmail,
                subject: tpl.subject,
                html: tpl.html,
              })
              await redis.set(cooldownKey, '1', { ex: NO_TRAFFIC_COOLDOWN_SECS })
              alerts.noTraffic++

              logger.info('cron.quality_check.no_traffic', {
                toolId: tool.toolId,
                lastInvocation: lastDate,
              })
            }
          }
        }
      } catch (toolErr) {
        // Don't let one tool failure stop the batch
        logger.error('cron.quality_check.tool_failed', { toolId: tool.toolId }, toolErr)
      }
    }

    const totalAlerts = alerts.slowResponse + alerts.highErrorRate + alerts.noTraffic

    logger.info('cron.quality_check.completed', {
      toolsChecked: activeTools.length,
      totalAlerts,
      ...alerts,
    })

    return successResponse({
      toolsChecked: activeTools.length,
      totalAlerts,
      alerts,
    })
  } catch (error) {
    logger.error('cron.quality_check.failed', {}, error)
    return internalErrorResponse(error)
  }
}
