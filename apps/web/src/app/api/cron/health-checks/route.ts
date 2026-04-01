import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolHealthChecks, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { notifyDeveloper } from '@/lib/notifications'
import { hasFeature } from '@/lib/tier-config'
import { baseEmailTemplate } from '@/lib/email'

export const maxDuration = 60


/**
 * Vercel Cron handler: pings tools with healthEndpoint URLs
 * and records results in toolHealthChecks table.
 * When a tool goes down, notifies the developer via email + Slack/Discord.
 * Schedule: every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-health-checks:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.health_checks.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Fetch active tools with health endpoints (include developerId for notifications)
    const activeTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        healthEndpoint: tools.healthEndpoint,
        developerId: tools.developerId,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(200)

    const toolsWithEndpoints = activeTools.filter(
      (t) => t.healthEndpoint && t.healthEndpoint.length > 0
    )

    if (toolsWithEndpoints.length === 0) {
      return successResponse({ checked: 0, message: 'No tools with health endpoints' })
    }

    // Batch in groups of 10 to stay within function timeout
    const BATCH_SIZE = 10
    const results: Array<{ toolId: string; toolName: string; developerId: string; status: string; responseTimeMs: number | null }> = []

    for (let i = 0; i < toolsWithEndpoints.length; i += BATCH_SIZE) {
      const batch = toolsWithEndpoints.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.allSettled(
        batch.map(async (tool) => {
          const startTime = Date.now()
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

            const response = await fetch(tool.healthEndpoint!, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'User-Agent': 'SettleGrid-HealthCheck/1.0' },
            })

            clearTimeout(timeout)

            const responseTimeMs = Date.now() - startTime
            const status = response.ok ? 'up' : response.status >= 500 ? 'down' : 'degraded'

            return { toolId: tool.id, toolName: tool.name, developerId: tool.developerId, status, responseTimeMs }
          } catch (error) {
            const responseTimeMs = Date.now() - startTime
            const isTimeout = error instanceof Error && error.name === 'AbortError'
            return {
              toolId: tool.id,
              toolName: tool.name,
              developerId: tool.developerId,
              status: 'down' as const,
              responseTimeMs: isTimeout ? 10000 : responseTimeMs,
            }
          }
        })
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        }
      }
    }

    // Batch insert all health check records
    if (results.length > 0) {
      await db.insert(toolHealthChecks).values(
        results.map((r) => ({
          toolId: r.toolId,
          status: r.status,
          responseTimeMs: r.responseTimeMs,
          checkedAt: new Date(),
        }))
      )
    }

    // ── Notify developers when tools go down ─────────────────────────────
    const downTools = results.filter((r) => r.status === 'down' || r.status === 'degraded')

    // Group down tools by developer to avoid duplicate lookups
    const byDeveloper = new Map<string, Array<{ toolName: string; status: string }>>()
    for (const dt of downTools) {
      const existing = byDeveloper.get(dt.developerId) ?? []
      existing.push({ toolName: dt.toolName, status: dt.status })
      byDeveloper.set(dt.developerId, existing)
    }

    // Look up developer tier info once per developer
    for (const [developerId, affectedTools] of byDeveloper) {
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

      // Only send alerts to developers with health_alerts feature (Builder+)
      if (!hasFeature(dev.tier, 'health_alerts', dev.isFoundingMember)) continue

      const toolList = affectedTools
        .map((t) => `${t.toolName} (${t.status})`)
        .join(', ')

      const message = `[SettleGrid] Health Alert: ${affectedTools.length === 1 ? `Your tool "${affectedTools[0].toolName}" is ${affectedTools[0].status}` : `${affectedTools.length} tools are down or degraded: ${toolList}`}. Check your dashboard for details.`

      const emailHtml = baseEmailTemplate(
        `<h2 style="margin:0 0 16px;">Health Alert</h2>
        <p>Hi ${dev.name ?? 'Developer'},</p>
        <p>Our health check detected that the following tool${affectedTools.length > 1 ? 's are' : ' is'} experiencing issues:</p>
        <ul>${affectedTools.map((t) => `<li><strong>${t.toolName}</strong> — ${t.status}</li>`).join('')}</ul>
        <p>Please check your health endpoint and dashboard for details.</p>`
      )

      // Fire-and-forget notification (don't block the cron)
      notifyDeveloper({
        developerId,
        event: 'tool.health_alert',
        message,
        email: {
          to: dev.email,
          subject: `[SettleGrid] Health Alert: ${affectedTools.length === 1 ? affectedTools[0].toolName : `${affectedTools.length} tools`} ${affectedTools.length === 1 ? `is ${affectedTools[0].status}` : 'need attention'}`,
          html: emailHtml,
        },
        critical: true,
      }).catch((err) => {
        logger.error('cron.health_checks.notify_failed', { developerId }, err)
      })
    }

    const upCount = results.filter((r) => r.status === 'up').length
    const downCount = results.filter((r) => r.status === 'down').length
    const degradedCount = results.filter((r) => r.status === 'degraded').length

    logger.info('cron.health_checks.completed', {
      checked: results.length,
      up: upCount,
      down: downCount,
      degraded: degradedCount,
      notified: byDeveloper.size,
    })

    return successResponse({
      checked: results.length,
      up: upCount,
      down: downCount,
      degraded: degradedCount,
      notified: byDeveloper.size,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
