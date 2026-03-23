import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

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
