import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { consumerSchedules, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { requireConsumer } from '@/lib/middleware/auth'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { CronExpressionParser } from 'cron-parser'

export const maxDuration = 30

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum schedules for free-tier consumers */
const MAX_SCHEDULES_FREE = 10

/** Maximum schedules for builder+ consumers */
const MAX_SCHEDULES_PAID = 50

/** Minimum cron interval: 5 minutes (prevent abuse) */
const MIN_INTERVAL_MS = 5 * 60 * 1000

/** Allowed cron expression parts count (5 = standard cron) */
const CRON_PARTS_COUNT = 5

// ── Validation schemas ─────────────────────────────────────────────────────

const createScheduleSchema = z.object({
  toolId: z.string().uuid(),
  slug: z.string().min(1).max(200),
  method: z.string().max(100).nullable().optional(),
  payload: z.record(z.unknown()).default({}),
  cronExpression: z.string().min(9).max(50),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate a cron expression and ensure interval >= 5 minutes.
 * Returns the next run date or null if invalid.
 */
function validateCronExpression(expression: string): { valid: boolean; nextRun: Date | null; error?: string } {
  // Basic format validation: must have exactly 5 parts
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== CRON_PARTS_COUNT) {
    return { valid: false, nextRun: null, error: 'Cron expression must have exactly 5 fields (minute hour day month weekday).' }
  }

  try {
    const interval = CronExpressionParser.parse(expression)
    const next1 = interval.next().toDate()
    const next2 = interval.next().toDate()
    const intervalMs = next2.getTime() - next1.getTime()

    if (intervalMs < MIN_INTERVAL_MS) {
      return { valid: false, nextRun: null, error: `Minimum schedule interval is 5 minutes. This expression runs every ${Math.round(intervalMs / 1000)}s.` }
    }

    // Re-parse to get the actual first next run
    const freshInterval = CronExpressionParser.parse(expression)
    const nextRun = freshInterval.next().toDate()

    return { valid: true, nextRun }
  } catch {
    return { valid: false, nextRun: null, error: 'Invalid cron expression.' }
  }
}

/**
 * Determine schedule limit based on consumer tier (developer tier lookup via org or default).
 * Consumers without an associated developer record get free-tier limits.
 */
async function getScheduleLimit(consumerId: string): Promise<number> {
  try {
    // Check if this consumer has any tool balances with significant spend
    // (proxy for "paid" — consumers who've purchased credits are treated as builder+)
    const [spendResult] = await db
      .select({ totalSpend: sql<number>`COALESCE(SUM(balance_cents), 0)::int` })
      .from(sql`consumer_tool_balances`)
      .where(sql`consumer_id = ${consumerId}`)

    const totalSpend = spendResult?.totalSpend ?? 0
    return totalSpend > 0 ? MAX_SCHEDULES_PAID : MAX_SCHEDULES_FREE
  } catch {
    return MAX_SCHEDULES_FREE
  }
}

// ── GET: List consumer schedules ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-schedules-list:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const consumer = await requireConsumer(request)

    const schedules = await db
      .select({
        id: consumerSchedules.id,
        toolId: consumerSchedules.toolId,
        slug: consumerSchedules.slug,
        method: consumerSchedules.method,
        payload: consumerSchedules.payload,
        cronExpression: consumerSchedules.cronExpression,
        enabled: consumerSchedules.enabled,
        lastRunAt: consumerSchedules.lastRunAt,
        nextRunAt: consumerSchedules.nextRunAt,
        failCount: consumerSchedules.failCount,
        maxFailures: consumerSchedules.maxFailures,
        createdAt: consumerSchedules.createdAt,
      })
      .from(consumerSchedules)
      .where(eq(consumerSchedules.consumerId, consumer.id))
      .orderBy(consumerSchedules.createdAt)
      .limit(100)

    return successResponse({ schedules })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return errorResponse(error.message, 401, 'UNAUTHORIZED')
    }
    logger.error('consumer_schedules.list_error', {}, error)
    return internalErrorResponse(error)
  }
}

// ── POST: Create a new schedule ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `consumer-schedules-create:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const consumer = await requireConsumer(request)
    const body = await parseBody(request, createScheduleSchema)

    // Validate cron expression
    const cronResult = validateCronExpression(body.cronExpression)
    if (!cronResult.valid || !cronResult.nextRun) {
      return errorResponse(cronResult.error ?? 'Invalid cron expression.', 400, 'INVALID_CRON')
    }

    // Check schedule limit
    const limit = await getScheduleLimit(consumer.id)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(consumerSchedules)
      .where(eq(consumerSchedules.consumerId, consumer.id))

    const currentCount = countResult?.count ?? 0
    if (currentCount >= limit) {
      return errorResponse(
        `Schedule limit reached (${limit}). ${limit === MAX_SCHEDULES_FREE ? 'Purchase credits to unlock up to 50 schedules.' : ''}`,
        403,
        'SCHEDULE_LIMIT_REACHED'
      )
    }

    // Verify the tool exists and is active
    const [tool] = await db
      .select({ id: tools.id, slug: tools.slug, status: tools.status })
      .from(tools)
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'TOOL_NOT_FOUND')
    }
    if (tool.status !== 'active' && tool.status !== 'unclaimed') {
      return errorResponse('Tool is not available.', 400, 'TOOL_UNAVAILABLE')
    }

    // Create the schedule
    const [schedule] = await db
      .insert(consumerSchedules)
      .values({
        consumerId: consumer.id,
        toolId: body.toolId,
        slug: body.slug,
        method: body.method ?? null,
        payload: body.payload,
        cronExpression: body.cronExpression,
        enabled: true,
        nextRunAt: cronResult.nextRun,
      })
      .returning()

    logger.info('consumer_schedules.created', {
      scheduleId: schedule.id,
      consumerId: consumer.id,
      toolSlug: body.slug,
      cron: body.cronExpression,
    })

    return successResponse({ schedule }, 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return errorResponse(error.message, 401, 'UNAUTHORIZED')
    }
    logger.error('consumer_schedules.create_error', {}, error)
    return internalErrorResponse(error)
  }
}
