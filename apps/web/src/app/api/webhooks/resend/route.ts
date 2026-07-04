import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { db } from '@/lib/db'
import { processedWebhookEvents } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { getResendWebhookSecret } from '@/lib/env'
import { sdkLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizeEmail, suppress } from '@/lib/email-suppression'

// Svix verification uses Node's `crypto` — pin to the Node runtime. NEVER set
// runtime='edge' (it would break signature verification). FOLD #3.
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/webhooks/resend — Resend bounce/complaint webhook (Svix-signed).
 *
 * SECURITY BOUNDARY (DECISION-3): a forged `email.complained` for `victim@`
 * would write `(victim,'all')` and suppress ALL mail (incl. security) to that
 * victim — a real abuse / deliverability-DoS vector. So: verify the Svix
 * signature over the RAW body, reject (400) on any failure, fail CLOSED (503)
 * if the signing secret is unset, and NEVER unsuppress from any event.
 *
 *   email.complained            → suppress (email,'all','complaint')
 *   email.bounced (PERMANENT)   → suppress (email,'all','bounce')
 *   email.bounced (transient)   → IGNORED (a mailbox-full/greylist bounce is
 *                                 not a dead mailbox — suppressing 'all' would
 *                                 permanently kill a live address)
 */

interface ResendWebhookPayload {
  type?: unknown
  data?: {
    to?: unknown
    bounce?: { type?: unknown } | null
  }
}

/** True only for a permanent/hard bounce (Resend `data.bounce.type`). */
function isHardBounce(payload: ResendWebhookPayload): boolean {
  const t = payload.data?.bounce?.type
  return typeof t === 'string' && /permanent|hard/i.test(t)
}

/** Recipients live in `data.to` (an ARRAY) — iterate + normalize each. */
function recipients(payload: ResendWebhookPayload): string[] {
  const to = payload.data?.to
  const arr = Array.isArray(to) ? to : typeof to === 'string' ? [to] : []
  return arr
    .filter((x): x is string => typeof x === 'string')
    .map(normalizeEmail)
    .filter((e) => e.includes('@'))
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(sdkLimiter, `resend-webhook:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Fail CLOSED on an unset secret, BEFORE new Webhook(secret): svix throws on
    // an empty secret; an unguarded/mis-caught throw could become an accept-all
    // forgery sink. There is deliberately NO "unset ⇒ skip verify / accept"
    // branch — the catastrophic tail (FOLD #3).
    const secret = getResendWebhookSecret()?.trim()
    if (!secret) {
      logger.error('resend.webhook.not_configured', {
        message: 'RESEND_WEBHOOK_SECRET is not set — bounce/complaint suppression disabled.',
      })
      return errorResponse('Resend webhook is not configured.', 503, 'NOT_CONFIGURED')
    }

    // Verify over the RAW body (never JSON.parse → stringify → verify).
    const rawBody = await request.text()
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return errorResponse('Missing Svix signature headers.', 400, 'MISSING_SIGNATURE')
    }

    let payload: ResendWebhookPayload
    try {
      payload = new Webhook(secret).verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ResendWebhookPayload
    } catch {
      // Any signature/timestamp failure — reject, write nothing.
      return errorResponse('Invalid webhook signature.', 400, 'INVALID_SIGNATURE')
    }

    const eventType = typeof payload.type === 'string' ? payload.type : 'unknown'

    const shouldSuppress =
      eventType === 'email.complained' ||
      (eventType === 'email.bounced' && isHardBounce(payload))

    if (!shouldSuppress) {
      // Non-actionable (delivered/opened/clicked/soft-bounce/…) — ack, no write.
      return successResponse({ received: true, suppressed: false })
    }

    const reason = eventType === 'email.complained' ? 'complaint' : 'bounce'
    const addresses = recipients(payload)

    // suppress() FIRST (ON CONFLICT DO NOTHING — idempotent), THEN record the
    // dedup ledger. Ordering is load-bearing: if the ledger were written first
    // and suppress then failed, a redelivery would see "already processed" and
    // permanently skip a valid complaint. If suppress throws here (missing
    // table in the deploy window), the outer catch → 500 and Resend redelivers.
    for (const email of addresses) {
      await suppress(email, 'all', reason, 'resend-webhook')
    }

    // Dedup on the STABLE `svix-id` request header (stable across retries), not
    // a payload id. Mirror the Stripe ledger pattern.
    let inserted: { eventId: string }[]
    try {
      inserted = await db
        .insert(processedWebhookEvents)
        .values({ eventId: svixId, source: 'resend', eventType })
        .onConflictDoNothing({ target: processedWebhookEvents.eventId })
        .returning({ eventId: processedWebhookEvents.eventId })
    } catch (err) {
      logger.error('resend.webhook.ledger_unavailable', { svixId }, err)
      return errorResponse('Idempotency ledger unavailable.', 503, 'IDEMPOTENCY_UNAVAILABLE')
    }

    const duplicate = inserted.length === 0
    logger.info('resend.webhook.processed', {
      eventType,
      reason,
      count: addresses.length,
      duplicate,
    })
    return successResponse({ received: true, suppressed: true, duplicate })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
