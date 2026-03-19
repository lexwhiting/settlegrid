import { logger } from '@/lib/logger'
import {
  baseEmailTemplate,
  ctaButton,
  escapeHtml,
  sanitizeSubject,
  sendEmail,
} from '@/lib/email'

/**
 * Send an alert email to a consumer when an alert condition is triggered.
 * Uses the shared baseEmailTemplate and sendEmail helper.
 */
export async function sendAlertEmail(
  email: string,
  toolName: string,
  alertType: string,
  threshold: number
): Promise<void> {
  const labels: Record<string, string> = {
    low_balance: 'Low Balance',
    budget_exceeded: 'Budget Exceeded',
    usage_spike: 'Usage Spike',
  }

  const descriptions: Record<string, string> = {
    low_balance: `Your credit balance for <strong>${escapeHtml(toolName)}</strong> has dropped below <strong>${threshold} cents</strong>.`,
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
