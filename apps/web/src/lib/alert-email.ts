import { logger } from '@/lib/logger'
import {
  baseEmailTemplate,
  ctaButton,
  escapeHtml,
  lowBalanceAlertEmail,
  sanitizeSubject,
  sendEmail,
} from '@/lib/email'

/**
 * Send an alert email to a consumer when an alert condition is triggered.
 * Uses the shared baseEmailTemplate and sendEmail helper.
 * For low_balance alerts, delegates to the richer lowBalanceAlertEmail template.
 */
export async function sendAlertEmail(
  email: string,
  toolName: string,
  alertType: string,
  threshold: number
): Promise<void> {
  // Use the dedicated lowBalanceAlertEmail template for low_balance alerts
  // (includes formatted currency, auto-refill tip, and richer styling)
  if (alertType === 'low_balance') {
    try {
      const template = lowBalanceAlertEmail(email, toolName, threshold)
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        from: 'SettleGrid <alerts@settlegrid.ai>',
      })
      logger.info('alert.email_sent', { email, alertType, toolName })
    } catch (err) {
      logger.error('alert.email_failed', { email, alertType }, err)
    }
    return
  }

  const labels: Record<string, string> = {
    budget_exceeded: 'Budget Exceeded',
    usage_spike: 'Usage Spike',
  }

  const descriptions: Record<string, string> = {
    budget_exceeded: `Your spending budget for <strong>${escapeHtml(toolName)}</strong> has been exceeded.`,
    usage_spike: `Unusual usage spike detected for <strong>${escapeHtml(toolName)}</strong> — invocations exceeded 2x the 7-day hourly average.`,
  }

  const label = labels[alertType] ?? alertType
  const description = descriptions[alertType] ?? 'An alert condition has been triggered.'
  const subject = sanitizeSubject(`SettleGrid Alert: ${label} — ${toolName}`)

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">${escapeHtml(label)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">${description}</p>
${ctaButton('View Dashboard', 'https://settlegrid.ai/consumer')}
`,
    { preheader: `Alert: ${label} for ${toolName}` }
  )

  try {
    await sendEmail({
      to: email,
      subject,
      html,
      from: 'SettleGrid <alerts@settlegrid.ai>',
    })

    logger.info('alert.email_sent', { email, alertType, toolName })
  } catch (err) {
    logger.error('alert.email_failed', { email, alertType }, err)
  }
}
