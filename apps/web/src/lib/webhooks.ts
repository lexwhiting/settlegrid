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
 * Blocked hostnames and IP patterns for SSRF protection.
 * Prevents webhook delivery to internal/private network addresses.
 */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]

const PRIVATE_IP_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '169.254.',
  'fd',
  'fe80:',
]

/**
 * Validates that a webhook URL is safe to deliver to.
 * Blocks internal/private IPs and non-HTTPS URLs.
 */
export function isWebhookUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false

    const hostname = parsed.hostname.toLowerCase()

    // Block known internal hostnames
    if (BLOCKED_HOSTS.includes(hostname)) return false

    // Block private IP prefixes
    if (PRIVATE_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) return false

    // Block .local, .internal, .corp domains
    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.corp')) return false

    return true
  } catch {
    return false
  }
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

    const res = await fetch(url, {
      method: 'POST',
      headers,
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
