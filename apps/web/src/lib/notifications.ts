import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { isWebhookUrlSafe } from '@/lib/webhooks'

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

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
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

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
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
  event: string
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
    if (!params.critical && prefs[params.event] === false) {
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
 * Send a notification email to a developer, respecting their notification preferences.
 *
 * - Critical emails (security alerts, payout failures) are always sent regardless of preference.
 * - Non-critical emails check the developer's notificationPreferences JSONB column.
 * - If the eventKey is explicitly set to false, the email is skipped.
 * - If the eventKey is not present (undefined), the email is sent (opt-out model).
 */
export async function sendNotificationEmail(params: {
  developerId: string
  eventKey: string
  email: string
  subject: string
  html: string
  critical?: boolean
}): Promise<void> {
  try {
    // Critical emails (security alerts, payout failures) always send
    if (!params.critical) {
      const [dev] = await db
        .select({ notificationPreferences: developers.notificationPreferences })
        .from(developers)
        .where(eq(developers.id, params.developerId))
        .limit(1)

      const prefs = (dev?.notificationPreferences ?? {}) as Record<string, boolean>

      // If the developer explicitly disabled this event, skip
      if (prefs[params.eventKey] === false) {
        logger.info('notification.skipped', {
          developerId: params.developerId,
          eventKey: params.eventKey,
        })
        return
      }
    }

    await sendEmail({ to: params.email, subject: params.subject, html: params.html })
  } catch (err) {
    logger.error(
      'notification.send_failed',
      { developerId: params.developerId, eventKey: params.eventKey },
      err
    )
  }
}
