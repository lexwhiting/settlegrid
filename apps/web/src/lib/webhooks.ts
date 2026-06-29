import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { webhookEndpoints, webhookDeliveries, developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { safeFetch, isPublicUrlString } from '@/lib/safe-egress'

/**
 * Compute the next retry timestamp using exponential backoff.
 * nextRetryAt = NOW() + (2^attempts * 60) seconds
 */
export function computeNextRetryAt(attempts: number): Date {
  const delaySec = Math.pow(2, attempts) * 60
  return new Date(Date.now() + delaySec * 1000)
}

/**
 * Cheap registration-/dispatch-time UX pre-check that a webhook URL is safe to
 * deliver to (https-only; blocks private/reserved IP literals + obvious internal
 * hostnames). Delegates to the shared SSRF guard (G2-2) — superseding the old
 * string-prefix denylist. The LOAD-BEARING guard is `safeFetch` (L1 literal +
 * L2 connect-time DNS classify), applied to the actual delivery below; this
 * pre-check just lets us short-circuit obvious cases to a clean 'failed'.
 */
export function isWebhookUrlSafe(url: string): boolean {
  return isPublicUrlString(url, { allowedProtocols: ['https:'] })
}

// Headers that must not be overridden by custom headers
const RESERVED_HEADERS = new Set([
  'content-type',
  'x-settlegrid-signature',
  'x-settlegrid-event',
  'host',
  'authorization',
  'proxy-authorization',
  'content-length',
  'transfer-encoding',
  'cookie',
  'set-cookie',
  'connection',
  'upgrade',
])

/**
 * Sanitize and filter custom headers.
 * - Rejects reserved/internal headers
 * - Limits header name and value length
 * - Rejects non-string values
 */
function sanitizeCustomHeaders(
  raw: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string> = {}
  const MAX_HEADER_NAME_LEN = 128
  const MAX_HEADER_VALUE_LEN = 2048
  const MAX_CUSTOM_HEADERS = 10

  let count = 0
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_CUSTOM_HEADERS) break
    if (typeof value !== 'string') continue
    const normalizedKey = key.toLowerCase().trim()
    if (normalizedKey.length === 0 || normalizedKey.length > MAX_HEADER_NAME_LEN) continue
    if (value.length > MAX_HEADER_VALUE_LEN) continue
    if (RESERVED_HEADERS.has(normalizedKey)) continue
    // Block headers starting with x-settlegrid- to prevent spoofing
    if (normalizedKey.startsWith('x-settlegrid-')) continue
    // Block CRLF injection in header names and values
    if (/[\r\n\0]/.test(key) || /[\r\n\0]/.test(value)) continue
    result[key] = value
    count++
  }
  return result
}

/**
 * Attempt to deliver a webhook payload to a single URL.
 * Returns { httpStatus, status }.
 */
export async function attemptWebhookDelivery(
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
  customHeaders?: Record<string, unknown> | null
): Promise<{ httpStatus: number | null; status: 'delivered' | 'failed' }> {
  // SSRF protection: block requests to internal/private addresses
  if (!isWebhookUrlSafe(url)) {
    logger.warn('webhook.ssrf_blocked', { url, event })
    return { httpStatus: null, status: 'failed' }
  }

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  // Merge custom headers with standard headers (standard headers take precedence)
  const sanitized = sanitizeCustomHeaders(customHeaders as Record<string, unknown> | null)
  const headers: Record<string, string> = {
    ...sanitized,
    'Content-Type': 'application/json',
    'X-SettleGrid-Signature': signature,
    'X-SettleGrid-Event': event,
  }

  let httpStatus: number | null = null
  let status: 'delivered' | 'failed' = 'failed'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    // SSRF guard (G2-2): the load-bearing fetch-time block (L1 literal + L2
    // connect-time DNS classify; redirect:'error' — no need to follow).
    const res = await safeFetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      redirect: 'error',
      allowedProtocols: ['https:'],
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
        customHeaders: webhookEndpoints.customHeaders,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.developerId, developerId))
      .limit(10)

    const activeEndpoints = endpoints.filter((ep) => {
      const events = Array.isArray(ep.events) ? ep.events : JSON.parse(String(ep.events))
      return events.includes(event)
    })

    for (const ep of activeEndpoints) {
      const { httpStatus, status } = await attemptWebhookDelivery(
        ep.url,
        ep.secret,
        event,
        payload,
        ep.customHeaders as Record<string, unknown> | null,
      )

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
