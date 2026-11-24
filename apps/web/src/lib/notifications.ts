import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail, sendEmailResult, type SendEmailResult } from '@/lib/email'
import { logger } from '@/lib/logger'
import { isWebhookUrlSafe } from '@/lib/webhooks'
import { safeFetch } from '@/lib/safe-egress'
import { isNotificationOptedOut, type NotificationEventKey } from '@/lib/notification-events'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationWebhooks {
  slack?: string
  discord?: string
}

interface SlackPayload {
  text: string
}

interface DiscordPayload {
  content: string
}

// ── Slack / Discord Webhook Senders ─────────────────────────────────────────

const WEBHOOK_TIMEOUT_MS = 10_000

/**
 * Send a plain-text message to a Slack incoming webhook.
 * Returns true on success, false on failure (never throws).
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: string
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

    const payload: SlackPayload = { text: message }

    // SSRF guard (G2-2): the developer-configured webhook host is untrusted.
    // The guard-collapse on isWebhookUrlSafe alone does NOT attach the connect-
    // time guard here — route the actual delivery through safeFetch (L1 literal
    // + L2 connect-time DNS classify), https-only, redirect:'error'.
    const res = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'error',
      allowedProtocols: ['https:'],
    })

    clearTimeout(timeout)

    if (!res.ok) {
      logger.error('notification.slack.failed', {
        status: res.status,
        url: webhookUrl.slice(0, 60),
      })
      return false
    }

    return true
  } catch (err) {
    logger.error('notification.slack.error', {
      url: webhookUrl.slice(0, 60),
    }, err)
    return false
  }
}

/**
 * Send a plain-text message to a Discord webhook.
 * Discord uses `content` instead of Slack's `text`.
 * Returns true on success, false on failure (never throws).
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  message: string
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

    const payload: DiscordPayload = { content: message }

    // SSRF guard (G2-2): the developer-configured webhook host is untrusted.
    // The guard-collapse on isWebhookUrlSafe alone does NOT attach the connect-
    // time guard here — route the actual delivery through safeFetch (L1 literal
    // + L2 connect-time DNS classify), https-only, redirect:'error'.
    const res = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'error',
      allowedProtocols: ['https:'],
    })

    clearTimeout(timeout)

    if (!res.ok) {
      logger.error('notification.discord.failed', {
        status: res.status,
        url: webhookUrl.slice(0, 60),
      })
      return false
    }

    return true
  } catch (err) {
    logger.error('notification.discord.error', {
      url: webhookUrl.slice(0, 60),
    }, err)
    return false
  }
}

// ── Developer Notification Dispatcher ───────────────────────────────────────

/**
 * Notify a developer across all configured channels (email + Slack + Discord).
 *
 * - Always sends email (respecting notificationPreferences opt-out).
 * - Sends to Slack/Discord if the developer has configured webhook URLs
 *   in their notificationWebhooks JSONB column.
 * - Never throws — all failures are logged.
 */
export async function notifyDeveloper(params: {
  developerId: string
  event: NotificationEventKey
  message: string
  email?: {
    to: string
    subject: string
    html: string
  }
  critical?: boolean
}): Promise<void> {
  try {
    const [dev] = await db
      .select({
        notificationPreferences: developers.notificationPreferences,
        notificationWebhooks: developers.notificationWebhooks,
        email: developers.email,
      })
      .from(developers)
      .where(eq(developers.id, params.developerId))
      .limit(1)

    if (!dev) {
      logger.warn('notification.developer_not_found', {
        developerId: params.developerId,
      })
      return
    }

    const prefs = (dev.notificationPreferences ?? {}) as Record<string, boolean>
    const webhooks = (dev.notificationWebhooks ?? {}) as NotificationWebhooks

    // Check opt-out (critical notifications always send)
    if (!params.critical && isNotificationOptedOut(prefs, params.event)) {
      logger.info('notification.skipped', {
        developerId: params.developerId,
        event: params.event,
      })
      return
    }

    // Send email if provided
    if (params.email) {
      sendEmail({
        to: params.email.to,
        subject: params.email.subject,
        html: params.email.html,
      }).catch((err) => {
        logger.error('notification.email.failed', {
          developerId: params.developerId,
          event: params.event,
        }, err)
      })
    }

    // Send to Slack if configured — validate URL to prevent SSRF
    if (webhooks.slack) {
      if (!isWebhookUrlSafe(webhooks.slack)) {
        logger.warn('notification.slack.ssrf_blocked', {
          developerId: params.developerId,
          url: webhooks.slack.slice(0, 60),
        })
      } else {
        sendSlackNotification(webhooks.slack, params.message).catch((err) => {
          logger.error('notification.slack.dispatch_error', {
            developerId: params.developerId,
          }, err)
        })
      }
    }

    // Send to Discord if configured — validate URL to prevent SSRF
    if (webhooks.discord) {
      if (!isWebhookUrlSafe(webhooks.discord)) {
        logger.warn('notification.discord.ssrf_blocked', {
          developerId: params.developerId,
          url: webhooks.discord.slice(0, 60),
        })
      } else {
        sendDiscordNotification(webhooks.discord, params.message).catch((err) => {
          logger.error('notification.discord.dispatch_error', {
            developerId: params.developerId,
          }, err)
        })
      }
    }
  } catch (err) {
    logger.error('notification.notify_developer_failed', {
      developerId: params.developerId,
      event: params.event,
    }, err)
  }
}

// ── Legacy Email Notification ───────────────────────────────────────────────

/**
 * What happened to a notification email: sent, skipped because the developer
 * opted out of the event, or failed (the send errored or Resend refused it,
 * e.g. a 429).
 */
export type NotificationOutcome = 'sent' | 'opted_out' | 'failed'

type NotificationEmailParams = {
  developerId: string
  eventKey: NotificationEventKey
  email: string
  subject: string
  html: string
  critical?: boolean
  /** Passed to Resend: the same key and payload within 24 hours is not sent again. */
  idempotencyKey?: string
}

/** True if the developer turned this (non-critical) event off. Throws on a database error. */
async function optedOut(params: NotificationEmailParams): Promise<boolean> {
  // Critical emails (security alerts, payout failures) always send
  if (params.critical) return false
  const [dev] = await db
    .select({ notificationPreferences: developers.notificationPreferences })
    .from(developers)
    .where(eq(developers.id, params.developerId))
    .limit(1)
  const prefs = (dev?.notificationPreferences ?? {}) as Record<string, boolean>
  if (!isNotificationOptedOut(prefs, params.eventKey)) return false
  logger.info('notification.skipped', { developerId: params.developerId, eventKey: params.eventKey })
  return true
}

/**
 * Send a notification email to a developer, respecting their notification preferences.
 *
 * - Critical emails (security alerts, payout failures) are always sent regardless of preference.
 * - Non-critical emails check the developer's notificationPreferences JSONB column.
 * - If the eventKey is explicitly set to false, the email is skipped.
 * - If the eventKey is not present (undefined), the email is sent (opt-out model).
 * - Account notices do not consult the bulk-mail suppression table (see
 *   lib/email-suppression.ts); Resend's own suppression list stops delivery to
 *   addresses that hard-bounced or complained.
 *
 * Never throws. Returns the outcome so a caller can, for example, keep retrying
 * an alert whose send failed instead of recording it as delivered.
 */
export async function sendNotificationEmail(params: NotificationEmailParams): Promise<NotificationOutcome> {
  try {
    if (await optedOut(params)) return 'opted_out'
    const sent = await sendEmail({
      to: params.email,
      subject: params.subject,
      html: params.html,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
    })
    return sent ? 'sent' : 'failed'
  } catch (err) {
    logger.error(
      'notification.send_failed',
      { developerId: params.developerId, eventKey: params.eventKey },
      err
    )
    return 'failed'
  }
}

/**
 * Like sendNotificationEmail, but tells a failure that provably sent nothing
 * (`not_sent`: the preference lookup failed before any send, or Resend refused the
 * email) from one whose outcome is unknown (`unknown`: Resend may have accepted it).
 * Used where a retry must not risk a second email (lib/notification-delivery).
 * Never throws.
 */
export async function sendNotificationEmailResult(
  params: NotificationEmailParams,
): Promise<'opted_out' | SendEmailResult> {
  try {
    if (await optedOut(params)) return 'opted_out'
  } catch (err) {
    logger.error('notification.send_failed', { developerId: params.developerId, eventKey: params.eventKey }, err)
    return 'not_sent'
  }
  return sendEmailResult({
    to: params.email,
    subject: params.subject,
    html: params.html,
    ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
  })
}
