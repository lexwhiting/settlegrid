import { logger } from '@/lib/logger'
import { getResendApiKey } from '@/lib/env'

/**
 * Send an alert email to a consumer when an alert condition is triggered.
 * Uses Resend in production; logs in development.
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

  const subject = sanitizeSubject(`SettleGrid Alert: ${labels[alertType] ?? alertType} — ${toolName}`)

  const descriptions: Record<string, string> = {
    low_balance: `Your credit balance for <strong>${escapeHtml(toolName)}</strong> has dropped below <strong>${threshold} cents</strong>.`,
    budget_exceeded: `Your spending budget for <strong>${escapeHtml(toolName)}</strong> has been exceeded.`,
    usage_spike: `Unusual usage spike detected for <strong>${escapeHtml(toolName)}</strong> — invocations exceeded 2x the 7-day hourly average.`,
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Outfit',system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="text-align:center;margin-bottom:24px">
<div style="display:inline-block;font-size:22px;letter-spacing:-0.5px"><span style="font-weight:700;color:#1A1F3A">Settle</span><span style="font-weight:400;color:#10B981">Grid</span></div>
</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
<h2 style="color:#1A1F3A;margin:0 0 16px">${labels[alertType] ?? 'Alert'}</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">${descriptions[alertType] ?? 'An alert condition has been triggered.'}</p>
<div style="text-align:center;margin:24px 0">
<a href="https://settlegrid.ai/consumer" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View Dashboard</a>
</div>
</div>
<div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px">
<p>&copy; ${new Date().getFullYear()} SettleGrid. All rights reserved.</p>
</div>
</div>
</body>
</html>`

  try {
    let resendApiKey: string | null = null
    try {
      resendApiKey = getResendApiKey()
    } catch {
      // Resend not configured — skip email sending
    }
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SettleGrid <alerts@settlegrid.ai>',
          to: [email],
          subject,
          html,
        }),
      })
    }

    logger.info('alert.email_sent', { email, alertType, toolName })
  } catch (err) {
    logger.error('alert.email_failed', { email, alertType }, err)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sanitize a string for use in email subjects.
 * Strips CR/LF characters to prevent email header injection.
 */
function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)
}
