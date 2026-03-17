import { NextRequest } from 'next/server'
import { eq, and, lte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookDeliveries, webhookEndpoints } from '@/lib/db/schema'
import { attemptWebhookDelivery, computeNextRetryAt } from '@/lib/webhooks'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/**
 * Vercel Cron handler: retries failed webhook deliveries with exponential backoff.
 * Picks up deliveries WHERE status='failed' AND attempts < maxAttempts AND nextRetryAt <= NOW().
 * On success: status -> 'delivered'. On final failure: status -> 'dead_letter'.
 * Schedule: every 2 minutes.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-webhook-retry:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.webhook_retry.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const now = new Date()

    // Find failed deliveries eligible for retry
    const failedDeliveries = await db
      .select({
        id: webhookDeliveries.id,
        endpointId: webhookDeliveries.endpointId,
        event: webhookDeliveries.event,
        payload: webhookDeliveries.payload,
        attempts: webhookDeliveries.attempts,
        maxAttempts: webhookDeliveries.maxAttempts,
      })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, 'failed'),
          lt(webhookDeliveries.attempts, sql`${webhookDeliveries.maxAttempts}`),
          lte(webhookDeliveries.nextRetryAt, now)
        )
      )
      .limit(50)

    if (failedDeliveries.length === 0) {
      return successResponse({ retried: 0, delivered: 0, deadLettered: 0 })
    }

    // Look up the endpoint URL/secret for each unique endpointId
    const endpointIds = [...new Set(failedDeliveries.map((d) => d.endpointId))]
    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        status: webhookEndpoints.status,
      })
      .from(webhookEndpoints)
      .where(sql`${webhookEndpoints.id} IN (${sql.join(endpointIds.map((id) => sql`${id}`), sql`, `)})`)
      .limit(50)

    const endpointMap = new Map(endpoints.map((ep) => [ep.id, ep]))

    let delivered = 0
    let deadLettered = 0

    for (const delivery of failedDeliveries) {
      const endpoint = endpointMap.get(delivery.endpointId)
      if (!endpoint || endpoint.status !== 'active') {
        // Endpoint deleted or disabled — dead letter this delivery
        await db
          .update(webhookDeliveries)
          .set({ status: 'dead_letter', lastAttemptAt: now })
          .where(eq(webhookDeliveries.id, delivery.id))
        deadLettered++
        continue
      }

      const newAttempts = delivery.attempts + 1
      const payload = (typeof delivery.payload === 'string'
        ? JSON.parse(delivery.payload)
        : delivery.payload) as Record<string, unknown>

      const result = await attemptWebhookDelivery(
        endpoint.url,
        endpoint.secret,
        delivery.event,
        payload
      )

      if (result.status === 'delivered') {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'delivered',
            httpStatus: result.httpStatus,
            attempts: newAttempts,
            lastAttemptAt: now,
            deliveredAt: now,
            nextRetryAt: null,
          })
          .where(eq(webhookDeliveries.id, delivery.id))
        delivered++
      } else if (newAttempts >= delivery.maxAttempts) {
        // Final failure — dead letter
        await db
          .update(webhookDeliveries)
          .set({
            status: 'dead_letter',
            httpStatus: result.httpStatus,
            attempts: newAttempts,
            lastAttemptAt: now,
            nextRetryAt: null,
          })
          .where(eq(webhookDeliveries.id, delivery.id))
        deadLettered++
      } else {
        // Still has retries left — schedule next retry
        await db
          .update(webhookDeliveries)
          .set({
            status: 'failed',
            httpStatus: result.httpStatus,
            attempts: newAttempts,
            lastAttemptAt: now,
            nextRetryAt: computeNextRetryAt(newAttempts),
          })
          .where(eq(webhookDeliveries.id, delivery.id))
      }
    }

    logger.info('cron.webhook_retry.completed', {
      retried: failedDeliveries.length,
      delivered,
      deadLettered,
    })

    return successResponse({
      retried: failedDeliveries.length,
      delivered,
      deadLettered,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
