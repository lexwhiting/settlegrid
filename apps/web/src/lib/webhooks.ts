import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints, webhookDeliveries, developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

/**
 * Compute the next retry timestamp using exponential backoff.
 * nextRetryAt = NOW() + (2^attempts * 60) seconds
 */
export function computeNextRetryAt(attempts: number): Date {
  const delaySec = Math.pow(2, attempts) * 60
  return new Date(Date.now() + delaySec * 1000)
}

/**
 * Attempt to deliver a webhook payload to a single URL.
 * Returns { httpStatus, status }.
 */
export async function attemptWebhookDelivery(
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>
): Promise<{ httpStatus: number | null; status: 'delivered' | 'failed' }> {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  let httpStatus: number | null = null
  let status: 'delivered' | 'failed' = 'failed'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SettleGrid-Signature': signature,
        'X-SettleGrid-Event': event,
      },
      body,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    httpStatus = res.status
    status = res.ok ? 'delivered' : 'failed'
  } catch {
    // Network error — stays as 'failed'
  }

  return { httpStatus, status }
}

/**
 * Dispatch a webhook event to all registered endpoints for a developer.
 * Enterprise tier gets 5 max attempts; standard gets 3.
 */
export async function dispatchWebhook(
  developerId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Get developer tier
    const [dev] = await db
      .select({ tier: developers.tier })
      .from(developers)
      .where(eq(developers.id, developerId))
      .limit(1)

    const maxAttempts = dev?.tier === 'enterprise' ? 5 : 3

    // Get active endpoints that subscribe to this event
    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        events: webhookEndpoints.events,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.developerId, developerId))
      .limit(10)

    const activeEndpoints = endpoints.filter((ep) => {
      const events = Array.isArray(ep.events) ? ep.events : JSON.parse(String(ep.events))
      return events.includes(event)
    })

    for (const ep of activeEndpoints) {
      const { httpStatus, status } = await attemptWebhookDelivery(ep.url, ep.secret, event, payload)

      await db
        .insert(webhookDeliveries)
        .values({
          endpointId: ep.id,
          event,
          payload,
          status,
          httpStatus,
          attempts: 1,
          maxAttempts,
          lastAttemptAt: new Date(),
          deliveredAt: status === 'delivered' ? new Date() : null,
          nextRetryAt: status === 'failed' && maxAttempts > 1 ? computeNextRetryAt(1) : null,
        })
    }
  } catch (err) {
    logger.error('webhook.dispatch_failed', { developerId, event }, err)
  }
}
