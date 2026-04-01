import { NextRequest } from 'next/server'
import { eq, and, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerSchedules, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { CronExpressionParser } from 'cron-parser'

export const maxDuration = 120

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum schedules to process per cron run (prevent timeout) */
const MAX_PER_RUN = 100

/** Invocation timeout for each tool call */
const INVOKE_TIMEOUT_MS = 15_000

/** Auto-disable threshold: consecutive failures */
const AUTO_DISABLE_THRESHOLD = 5

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the next run time from a cron expression.
 * Returns null if the expression is invalid.
 */
function computeNextRun(cronExpression: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression)
    return interval.next().toDate()
  } catch {
    return null
  }
}

/**
 * Invoke a tool via internal fetch to the serve endpoint.
 */
async function invokeTool(
  slug: string,
  payload: Record<string, unknown>,
  method: string | null
): Promise<{ success: boolean; status: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'
  const url = `${baseUrl}/api/tools/serve/${encodeURIComponent(slug)}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS)

    const body: Record<string, unknown> = { ...payload }
    if (method) body.method = method

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    return { success: response.ok, status: response.status }
  } catch {
    return { success: false, status: 0 }
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: executes due consumer schedules.
 *
 * Schedule: every 5 minutes
 *
 * For each schedule where enabled=true and nextRunAt <= now:
 * - Invoke the tool via internal fetch
 * - Update lastRunAt and compute nextRunAt
 * - On failure, increment failCount; auto-disable if threshold reached
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-consumer-schedules:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.consumer_schedules.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.consumer_schedules.starting')

    const now = new Date()

    // Find due schedules
    const dueSchedules = await db
      .select({
        id: consumerSchedules.id,
        consumerId: consumerSchedules.consumerId,
        toolId: consumerSchedules.toolId,
        slug: consumerSchedules.slug,
        method: consumerSchedules.method,
        payload: consumerSchedules.payload,
        cronExpression: consumerSchedules.cronExpression,
        failCount: consumerSchedules.failCount,
        maxFailures: consumerSchedules.maxFailures,
      })
      .from(consumerSchedules)
      .where(
        and(
          eq(consumerSchedules.enabled, true),
          lte(consumerSchedules.nextRunAt, now)
        )
      )
      .limit(MAX_PER_RUN)

    if (dueSchedules.length === 0) {
      logger.info('cron.consumer_schedules.none_due')
      return successResponse({ processed: 0, succeeded: 0, failed: 0 })
    }

    let succeeded = 0
    let failed = 0

    for (const schedule of dueSchedules) {
      try {
        // Verify tool is still active
        const [tool] = await db
          .select({ status: tools.status })
          .from(tools)
          .where(eq(tools.id, schedule.toolId))
          .limit(1)

        if (!tool || (tool.status !== 'active' && tool.status !== 'unclaimed')) {
          // Tool was deactivated — disable the schedule
          await db
            .update(consumerSchedules)
            .set({ enabled: false })
            .where(eq(consumerSchedules.id, schedule.id))

          logger.info('cron.consumer_schedules.tool_inactive', {
            scheduleId: schedule.id,
            slug: schedule.slug,
          })
          failed++
          continue
        }

        // Invoke the tool
        const payload = (schedule.payload && typeof schedule.payload === 'object' && !Array.isArray(schedule.payload))
          ? schedule.payload as Record<string, unknown>
          : {}
        const result = await invokeTool(schedule.slug, payload, schedule.method)

        // Compute next run
        const nextRun = computeNextRun(schedule.cronExpression)

        if (result.success) {
          await db
            .update(consumerSchedules)
            .set({
              lastRunAt: now,
              nextRunAt: nextRun,
              failCount: 0, // Reset on success
            })
            .where(eq(consumerSchedules.id, schedule.id))
          succeeded++
        } else {
          const newFailCount = schedule.failCount + 1
          const shouldDisable = newFailCount >= (schedule.maxFailures ?? AUTO_DISABLE_THRESHOLD)

          await db
            .update(consumerSchedules)
            .set({
              lastRunAt: now,
              nextRunAt: nextRun,
              failCount: newFailCount,
              ...(shouldDisable ? { enabled: false } : {}),
            })
            .where(eq(consumerSchedules.id, schedule.id))

          if (shouldDisable) {
            logger.warn('cron.consumer_schedules.auto_disabled', {
              scheduleId: schedule.id,
              slug: schedule.slug,
              failCount: newFailCount,
            })
          }
          failed++
        }

        logger.info('cron.consumer_schedules.executed', {
          scheduleId: schedule.id,
          slug: schedule.slug,
          success: result.success,
          httpStatus: result.status,
        })
      } catch (err) {
        logger.error('cron.consumer_schedules.schedule_error', {
          scheduleId: schedule.id,
        }, err)
        failed++
      }
    }

    logger.info('cron.consumer_schedules.completed', {
      processed: dueSchedules.length,
      succeeded,
      failed,
    })

    return successResponse({ processed: dueSchedules.length, succeeded, failed })
  } catch (error) {
    logger.error('cron.consumer_schedules.failed', {}, error)
    return internalErrorResponse(error)
  }
}
