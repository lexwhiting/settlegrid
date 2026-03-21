/**
 * Email templates and sending utilities for SettleGrid.
 * Uses Resend for transactional email delivery.
 */

import { logger } from '@/lib/logger'
import { getResendApiKey } from '@/lib/env'

// ── Constants ────────────────────────────────────────────────────────────────

export const FROM_TRANSACTIONAL = 'SettleGrid <notifications@settlegrid.ai>'

const FONT_STACK =
  "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const CODE_FONT =
  "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace"

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string
  html: string
}

export interface InvoiceItem {
  description: string
  amountCents: number
}

// ── Send helper ──────────────────────────────────────────────────────────────

/**
 * Send an email via the Resend HTTP API.
 * Returns true if the email was accepted (or Resend is not configured in dev).
 * Never throws — logs errors and returns false on failure.
 */
export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
}): Promise<boolean> {
  let resendApiKey: string | null = null
  try {
    resendApiKey = getResendApiKey()
  } catch {
    // Resend not configured — skip email sending in dev
  }

  if (!resendApiKey) {
    logger.info('email.skipped', { to: params.to, subject: params.subject })
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from ?? FROM_TRANSACTIONAL,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown')
      logger.error('email.send_failed', {
        status: res.status,
        body,
        to: params.to,
      })
      return false
    }

    logger.info('email.sent', { to: params.to, subject: params.subject })
    return true
  } catch (err) {
    logger.error('email.send_error', { to: params.to }, err)
    return false
  }
}

// ── Design system components ─────────────────────────────────────────────────

/**
 * Inline pill badge for status display in emails.
 * Supports settled/active/pending/failed statuses.
 */
export function statusBadge(
  status: 'settled' | 'active' | 'pending' | 'failed',
  label?: string
): string {
  const styles: Record<string, { bg: string; text: string }> = {
    settled: { bg: '#f0fdf4', text: '#166534' },
    active: { bg: '#eff6ff', text: '#1e40af' },
    pending: { bg: '#fffbeb', text: '#92400e' },
    failed: { bg: '#fef2f2', text: '#991b1b' },
  }
  const s = styles[status]
  const displayLabel = escapeHtml(label ?? status.charAt(0).toUpperCase() + status.slice(1))
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600;background-color:${s.bg};color:${s.text};font-family:${FONT_STACK}">${displayLabel}</span>`
}

/**
 * Receipt line item row — label left, value right, optional border-bottom.
 * Bold styling when isTotal is true.
 */
export function dataRow(label: string, value: string, isTotal = false): string {
  const fontWeight = isTotal ? '700' : '400'
  const borderStyle = isTotal
    ? 'border-top:2px solid #1A1F3A;border-bottom:none'
    : 'border-bottom:1px solid #e5e7eb'
  return `<tr><td style="padding:8px 0;${borderStyle};font-weight:${fontWeight};color:#374151;font-size:14px;font-family:${FONT_STACK}">${escapeHtml(label)}</td><td align="right" style="padding:8px 0;${borderStyle};font-weight:${fontWeight};color:#374151;font-size:14px;font-family:${FONT_STACK}">${escapeHtml(value)}</td></tr>`
}

/**
 * Banner with left border accent for info/success/warning/error messages.
 */
export function alertBanner(
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  body: string
): string {
  const styles: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  }
  const s = styles[type]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0"><tr><td style="background-color:${s.bg};border-left:4px solid ${s.border};border-radius:0 8px 8px 0;padding:12px 16px">
<p style="color:${s.text};margin:0 0 4px;font-size:14px;font-weight:700;font-family:${FONT_STACK}">${escapeHtml(title)}</p>
<p style="color:${s.text};margin:0;font-size:14px;line-height:1.5;font-family:${FONT_STACK}">${escapeHtml(body)}</p>
</td></tr></table>`
}

/**
 * Horizontal separator between email sections.
 */
export function dividerLine(): string {
  return `<table role="presentation" class="sg-divider" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>`
}

/**
 * Dark indigo background code snippet block.
 */
export function codeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0"><tr><td style="background-color:#1A1F3A;border-radius:8px;padding:16px;overflow-x:auto">
<pre style="margin:0;color:#f9fafb;font-size:13px;line-height:1.5;font-family:${CODE_FONT};white-space:pre-wrap;word-break:break-all">${escapeHtml(code)}</pre>
</td></tr></table>`
}

// ── Base template ────────────────────────────────────────────────────────────

/**
 * Wraps email content in a responsive, dark-mode-aware shell with
 * preheader text, bulletproof CTA support, and enhanced footer.
 */
export function baseEmailTemplate(
  content: string,
  options?: { preheader?: string }
): string {
  const preheader = options?.preheader ?? ''
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>SettleGrid</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .sg-body { background-color: #111827 !important; }
  .sg-card { background-color: #1f2937 !important; border-color: #374151 !important; }
  .sg-heading { color: #f9fafb !important; }
  .sg-text { color: #f9fafb !important; }
  .sg-muted { color: #d1d5db !important; }
  .sg-code { background-color: #374151 !important; color: #f9fafb !important; }
  .sg-divider { border-color: #374151 !important; }
  .sg-info-box { background-color: #374151 !important; border-color: #4b5563 !important; }
}
</style>
</head>
<body class="sg-body" style="margin:0;padding:0;background-color:#f9fafb;font-family:${FONT_STACK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}${'&#847; &zwnj; '.repeat(30)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">
<!-- Logo -->
<tr><td align="center" style="padding-bottom:24px">
<span style="display:inline-block;font-size:22px;letter-spacing:-0.5px"><span style="font-weight:700;color:#1A1F3A">Settle</span><span style="font-weight:400;color:#10B981">Grid</span></span>
</td></tr>
<!-- Card -->
<tr><td>
<table role="presentation" class="sg-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:32px">
${content}
</td></tr>
</table>
</td></tr>
<!-- Footer -->
<tr><td style="padding-top:24px;text-align:center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding-bottom:12px">
<a href="https://settlegrid.ai" style="color:#059669;text-decoration:none;font-size:13px;margin:0 8px">Website</a>
<span class="sg-muted" style="color:#d1d5db">&middot;</span>
<a href="https://settlegrid.ai/docs" style="color:#059669;text-decoration:none;font-size:13px;margin:0 8px">Docs</a>
<span class="sg-muted" style="color:#d1d5db">&middot;</span>
<a href="mailto:support@settlegrid.ai" style="color:#059669;text-decoration:none;font-size:13px;margin:0 8px">Support</a>
</td></tr>
<tr><td align="center">
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:0">&copy; ${year} Alerterra, LLC. All rights reserved.</p>
<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:4px 0 0">2810 N Church St, Wilmington, DE 19802, PMB #481712</p>
</td></tr>
</table>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

/**
 * Create a bulletproof CTA button that works in Outlook and all major clients.
 * Uses VML fallback for Outlook and padding-based approach for others.
 */
export function ctaButton(text: string, href: string, color = '#059669'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto"><tr><td align="center" style="border-radius:8px;background-color:${color}">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:44px;v-text-anchor:middle;width:200px" arcsize="18%" strokecolor="${color}" fillcolor="${color}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:600">${escapeHtml(text)}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${escapeHtml(href)}" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;font-family:${FONT_STACK};line-height:1.2;mso-hide:all">${escapeHtml(text)}</a>
<!--<![endif]-->
</td></tr></table>`
}

// ── Template functions ───────────────────────────────────────────────────────

export function welcomeDeveloperEmail(
  name: string,
  options?: { preheader?: string }
): EmailTemplate {
  return {
    subject: 'Welcome to SettleGrid — Start monetizing your tools',
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Welcome, ${escapeHtml(name)}!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">You're all set to start monetizing your MCP tools with per-call billing.</p>
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Next steps:</h3>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Connect your Stripe account to receive payouts</li>
<li>Create your first tool in the dashboard</li>
<li>Install the <code class="sg-code" style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">@settlegrid/mcp</code> SDK</li>
<li>Wrap your handler and go live</li>
</ol>
${ctaButton('Go to Dashboard', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: options?.preheader ?? 'Get started monetizing your MCP tools in minutes.' }
    ),
  }
}

export function welcomeConsumerEmail(
  email: string,
  options?: { preheader?: string }
): EmailTemplate {
  return {
    subject: 'Welcome to SettleGrid — Start using AI tools',
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Welcome to SettleGrid!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">You're ready to discover and use powerful AI tools with simple pay-per-call billing.</p>
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Getting started:</h3>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Browse available tools in the marketplace</li>
<li>Add credits to your account</li>
<li>Generate an API key</li>
<li>Start making calls</li>
</ol>
${ctaButton('Explore Tools', 'https://settlegrid.ai/consumer')}
`,
      { preheader: options?.preheader ?? 'Discover and use AI tools with simple pay-per-call pricing.' }
    ),
  }
}

export function stripeConnectCompleteEmail(
  name: string,
  options?: { preheader?: string; revenueSharePct?: number }
): EmailTemplate {
  const pct = options?.revenueSharePct ?? 80
  return {
    subject: 'Stripe Connect is active — You can now receive payouts',
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Stripe Connect Active</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Great news, ${escapeHtml(name)}! Your Stripe Connect account is now active. You'll receive payouts automatically based on your payout schedule.</p>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Revenue split: You keep ${pct}%</li>
<li>Minimum payout: $25.00</li>
<li>Schedule: Based on your settings (weekly or monthly)</li>
</ul>
${ctaButton('View Settings', 'https://settlegrid.ai/dashboard/developer/settings')}
`,
      { preheader: options?.preheader ?? 'Your Stripe Connect account is live. Payouts are enabled.' }
    ),
  }
}

export function payoutNotificationEmail(
  name: string,
  amountCents: number,
  options?: { preheader?: string }
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject(`Payout of ${formatted} has been initiated`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Payout Initiated</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, a payout of <strong style="color:#10B981">${formatted}</strong> has been initiated to your connected Stripe account.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Funds typically arrive within 2-7 business days depending on your bank.</p>
${ctaButton('View Payouts', 'https://settlegrid.ai/dashboard/payouts')}
`,
      { preheader: options?.preheader ?? `A payout of ${formatted} is on its way to your bank.` }
    ),
  }
}

export function lowBalanceAlertEmail(
  email: string,
  toolName: string,
  balanceCents: number,
  options?: { preheader?: string }
): EmailTemplate {
  const formatted = formatCurrency(balanceCents)
  return {
    subject: sanitizeSubject(`Low balance alert: ${toolName} — ${formatted} remaining`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Low Credit Balance</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your credit balance for <strong>${escapeHtml(toolName)}</strong> is running low at <strong style="color:#ef4444">${formatted}</strong>.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Add credits to avoid service interruption.</p>
${ctaButton('Add Credits', 'https://settlegrid.ai/consumer')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">Tip: Enable auto-refill to automatically top up when your balance gets low.</p>
`,
      { preheader: options?.preheader ?? `Your balance for ${toolName} is low at ${formatted}.` }
    ),
  }
}

export function creditPurchaseConfirmationEmail(
  email: string,
  amountCents: number,
  toolName: string,
  options?: { preheader?: string }
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject(`Credit purchase confirmed: ${formatted} for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Purchase Confirmed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your purchase of <strong style="color:#10B981">${formatted}</strong> in credits for <strong>${escapeHtml(toolName)}</strong> has been confirmed.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Credits have been added to your balance and are available immediately.</p>
${ctaButton('View Balance', 'https://settlegrid.ai/consumer')}
`,
      { preheader: options?.preheader ?? `${formatted} in credits added to your ${toolName} balance.` }
    ),
  }
}

export function paymentFailedEmail(
  email: string,
  amountCents: number,
  reason: string,
  toolName: string,
  options?: { preheader?: string }
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject(`Payment failed: ${formatted} for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Payment Failed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A payment of <strong style="color:#ef4444">${formatted}</strong> for <strong>${escapeHtml(toolName)}</strong> could not be processed.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#991b1b;margin:0;font-size:14px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Please update your payment method and try again to avoid service interruption.</p>
${ctaButton('Retry Payment', 'https://settlegrid.ai/consumer', '#ef4444')}
`,
      { preheader: options?.preheader ?? `Your ${formatted} payment for ${toolName} failed. Please retry.` }
    ),
  }
}

export function autoRefillConfirmationEmail(
  email: string,
  amountCents: number,
  toolName: string,
  newBalanceCents: number,
  options?: { preheader?: string }
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  const balanceFormatted = formatCurrency(newBalanceCents)
  return {
    subject: sanitizeSubject(`Auto-refill: ${formatted} added for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Auto-Refill Complete</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your balance for <strong>${escapeHtml(toolName)}</strong> was automatically topped up.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#166534;margin:0 0 4px;font-size:14px"><strong>Amount charged:</strong> ${formatted}</p>
<p class="sg-text" style="color:#166534;margin:0;font-size:14px"><strong>New balance:</strong> ${balanceFormatted}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">You can manage auto-refill settings from your dashboard.</p>
${ctaButton('View Balance', 'https://settlegrid.ai/consumer')}
`,
      { preheader: options?.preheader ?? `${formatted} auto-refilled for ${toolName}. New balance: ${balanceFormatted}.` }
    ),
  }
}

export function apiKeyCreatedEmail(
  email: string,
  keyPrefix: string,
  toolName: string,
  options?: { preheader?: string; ip?: string; userAgent?: string }
): EmailTemplate {
  const securityContext =
    options?.ip || options?.userAgent
      ? `${dividerLine()}
<p class="sg-text" style="color:#6b7280;font-size:13px;margin:0 0 4px"><strong>Security context:</strong></p>
${options.ip ? `<p class="sg-text" style="color:#6b7280;font-size:13px;margin:0 0 2px">IP address: <code class="sg-code" style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;font-family:${CODE_FONT}">${escapeHtml(options.ip)}</code></p>` : ''}
${options.userAgent ? `<p class="sg-text" style="color:#6b7280;font-size:13px;margin:0">User agent: ${escapeHtml(options.userAgent.slice(0, 120))}</p>` : ''}`
      : ''

  return {
    subject: sanitizeSubject(`New API key created for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">API Key Created</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A new API key was created for <strong>${escapeHtml(toolName)}</strong>.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>Key prefix:</strong> <code class="sg-code" style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(keyPrefix)}...</code></p>
</td></tr>
</table>
${securityContext}
<p class="sg-text" style="color:#4b5563;line-height:1.6">If you didn't create this key, revoke it immediately from your dashboard.</p>
${ctaButton('Manage API Keys', 'https://settlegrid.ai/consumer')}
`,
      { preheader: options?.preheader ?? `A new API key (${keyPrefix}...) was created for ${toolName}.` }
    ),
  }
}

export function apiKeyRevokedEmail(
  email: string,
  keyPrefix: string,
  toolName: string,
  options?: { preheader?: string }
): EmailTemplate {
  return {
    subject: sanitizeSubject(`API key revoked for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">API Key Revoked</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">An API key for <strong>${escapeHtml(toolName)}</strong> has been revoked and will no longer work.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef3c7;border:1px solid #fde68a;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#92400e;margin:0;font-size:14px"><strong>Key prefix:</strong> <code class="sg-code" style="background:#fde68a;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(keyPrefix)}...</code></p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Any applications using this key will need to be updated with a new one.</p>
${ctaButton('Manage API Keys', 'https://settlegrid.ai/consumer')}
`,
      { preheader: options?.preheader ?? `API key ${keyPrefix}... for ${toolName} has been revoked.` }
    ),
  }
}

export function webhookFailureEmail(
  email: string,
  endpointUrl: string,
  failureCount: number,
  lastStatusCode: number,
  options?: { preheader?: string }
): EmailTemplate {
  // Mask the webhook URL to show only the host
  let maskedUrl: string
  try {
    const parsed = new URL(endpointUrl)
    maskedUrl = `${parsed.protocol}//${parsed.host}/***`
  } catch {
    maskedUrl = '(invalid URL)'
  }

  return {
    subject: sanitizeSubject(`Webhook delivery failures for ${maskedUrl}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Webhook Delivery Failures</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your webhook endpoint has experienced repeated delivery failures.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#991b1b;margin:0 0 4px;font-size:14px"><strong>Endpoint:</strong> <code class="sg-code" style="background:#fecaca;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(maskedUrl)}</code></p>
<p class="sg-text" style="color:#991b1b;margin:0 0 4px;font-size:14px"><strong>Failures:</strong> ${failureCount} consecutive</p>
<p class="sg-text" style="color:#991b1b;margin:0;font-size:14px"><strong>Last status:</strong> ${lastStatusCode}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Please verify your endpoint is reachable and returning a 2xx status code. Continued failures may result in the endpoint being disabled.</p>
${ctaButton('Check Webhooks', 'https://settlegrid.ai/dashboard/developer/webhooks', '#d97706')}
`,
      { preheader: options?.preheader ?? `${failureCount} consecutive webhook failures detected for ${maskedUrl}.` }
    ),
  }
}

export function abandonedCheckoutEmail(
  email: string,
  amountCents: number,
  toolName: string,
  checkoutUrl: string
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject('You left credits in your cart \u2014 complete your purchase'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Complete Your Purchase</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">We noticed you didn't finish adding credits to your account. No worries \u2014 your purchase is still waiting for you.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#166534;margin:0 0 4px;font-size:14px"><strong>Amount:</strong> ${formatted}</p>
<p class="sg-text" style="color:#166534;margin:0;font-size:14px"><strong>Tool:</strong> ${escapeHtml(toolName)}</p>
</td></tr>
</table>
${ctaButton('Complete Purchase', checkoutUrl)}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">If you didn't intend to make this purchase, you can safely ignore this email.</p>
`,
      { preheader: `Your ${formatted} credit purchase for ${escapeHtml(toolName)} is waiting` }
    ),
  }
}

// ── New templates ────────────────────────────────────────────────────────────

export function accountEmailChangedEmail(
  oldEmail: string,
  newEmail: string
): EmailTemplate {
  return {
    subject: sanitizeSubject('Your SettleGrid email address was changed'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Email Address Changed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The email address on your SettleGrid account has been updated.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>Previous email:</strong> ${escapeHtml(oldEmail)}</p>
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>New email:</strong> ${escapeHtml(newEmail)}</p>
</td></tr>
</table>
${alertBanner('warning', 'Not you?', 'If you did not make this change, your account may be compromised. Contact support immediately.')}
${ctaButton('Contact Support', 'mailto:support@settlegrid.ai', '#d97706')}
`,
      { preheader: 'Your SettleGrid email address was recently changed.' }
    ),
  }
}

export function accountDeletedEmail(
  email: string,
  exportUrl?: string
): EmailTemplate {
  const exportSection = exportUrl
    ? `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">You can download a copy of your data using the link below. This link will expire in 30 days.</p>
${ctaButton('Download Data Export', exportUrl)}
`
    : ''

  return {
    subject: sanitizeSubject('Your SettleGrid account has been deleted'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Account Deleted</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your SettleGrid account associated with <strong>${escapeHtml(email)}</strong> has been permanently deleted.</p>
${alertBanner('info', 'Data retention', 'Some data may be retained for up to 30 days for legal and compliance purposes before being permanently removed.')}
${exportSection}
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px">If you believe this was a mistake, contact <a href="mailto:support@settlegrid.ai" style="color:#059669">support@settlegrid.ai</a> within 30 days.</p>
`,
      { preheader: 'Your SettleGrid account has been permanently deleted.' }
    ),
  }
}

export function dataExportReadyEmail(
  email: string,
  exportUrl: string
): EmailTemplate {
  return {
    subject: sanitizeSubject('Your data export is ready'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Data Export Ready</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your requested data export is ready for download.</p>
${alertBanner('info', 'Link expires in 7 days', 'Please download your data before the link expires. After 7 days, you will need to request a new export.')}
${ctaButton('Download Data', exportUrl)}
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px;margin:16px 0 0">If you did not request this export, you can safely ignore this email.</p>
`,
      { preheader: 'Your SettleGrid data export is ready to download.' }
    ),
  }
}

export function invoiceReceiptEmail(
  email: string,
  items: InvoiceItem[],
  totalCents: number,
  invoiceNumber: string,
  paymentMethodLast4: string,
  date: string
): EmailTemplate {
  const safeInvoiceNumber = escapeHtml(invoiceNumber)
  const itemRows = items
    .map((item) => dataRow(item.description, formatCurrency(item.amountCents)))
    .join('')

  return {
    subject: sanitizeSubject(`Invoice #INV-${invoiceNumber} from SettleGrid`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Invoice #INV-${safeInvoiceNumber}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Thank you for your payment. Here is your receipt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${itemRows}
${dataRow('Total', formatCurrency(totalCents), true)}
</table>
${dividerLine()}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;font-family:${FONT_STACK}"><strong>Payment method:</strong> **** ${escapeHtml(paymentMethodLast4)}</td></tr>
<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;font-family:${FONT_STACK}"><strong>Date:</strong> ${escapeHtml(date)}</td></tr>
<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;font-family:${FONT_STACK}"><strong>Invoice:</strong> INV-${safeInvoiceNumber}</td></tr>
</table>
${ctaButton('View in Dashboard', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `Receipt for Invoice #INV-${invoiceNumber} - ${formatCurrency(totalCents)}` }
    ),
  }
}

export function payoutCompletedEmail(
  name: string,
  amountCents: number,
  transferId: string
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject(`Payout of ${formatted} has arrived`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Payout Completed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your payout of <strong style="color:#10B981">${formatted}</strong> has been deposited to your bank account.</p>
${alertBanner('success', 'Deposit confirmed', 'Funds have been transferred to your connected bank account.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Amount', formatted)}
${dataRow('Transfer reference', transferId)}
</table>
${ctaButton('View Payouts', 'https://settlegrid.ai/dashboard/payouts')}
`,
      { preheader: `Your payout of ${formatted} has been deposited.` }
    ),
  }
}

export function payoutFailedEmail(
  name: string,
  amountCents: number,
  reason: string
): EmailTemplate {
  const formatted = formatCurrency(amountCents)
  return {
    subject: sanitizeSubject(`Payout of ${formatted} failed`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Payout Failed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your payout of <strong style="color:#ef4444">${formatted}</strong> could not be completed.</p>
${alertBanner('error', 'Failure reason', reason)}
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Resolution steps:</h3>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Verify your bank account details are correct</li>
<li>Ensure your Stripe Connect account is in good standing</li>
<li>Contact support if the issue persists</li>
</ol>
${ctaButton('View Payout Settings', 'https://settlegrid.ai/dashboard/developer/settings', '#ef4444')}
`,
      { preheader: `Your payout of ${formatted} failed. Please review your settings.` }
    ),
  }
}

export function suspiciousActivityEmail(
  email: string,
  reasons: string[],
  riskScore: number
): EmailTemplate {
  const reasonsList = reasons
    .map((r) => `<li style="margin:0 0 4px">${escapeHtml(r)}</li>`)
    .join('')

  return {
    subject: sanitizeSubject('Suspicious activity detected on your SettleGrid account'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Suspicious Activity Detected</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">We detected unusual activity on the account associated with <strong>${escapeHtml(email)}</strong>.</p>
${alertBanner('warning', `Risk score: ${riskScore}/100`, 'The following signals were detected on your account. Please review immediately.')}
<h3 class="sg-heading" style="color:#1A1F3A;margin:16px 0 8px;font-family:${FONT_STACK}">Signals detected:</h3>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
${reasonsList}
</ul>
<p class="sg-text" style="color:#4b5563;line-height:1.6">If this activity was not you, we recommend revoking your API keys and reviewing your account settings.</p>
${ctaButton('Review Account', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `Suspicious activity detected on your SettleGrid account (risk score: ${riskScore}).` }
    ),
  }
}

export function orgMemberInvitedEmail(
  email: string,
  orgName: string,
  role: string,
  inviterName: string
): EmailTemplate {
  const roleBadge = statusBadge('active', role)
  return {
    subject: sanitizeSubject(`You've been added to ${orgName} on SettleGrid`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">You've Been Added to an Organization</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong>${escapeHtml(inviterName)}</strong> has added you to <strong>${escapeHtml(orgName)}</strong> on SettleGrid.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#1e40af;margin:0 0 4px;font-size:14px"><strong>Organization:</strong> ${escapeHtml(orgName)}</p>
<p class="sg-text" style="color:#1e40af;margin:0;font-size:14px"><strong>Role:</strong> ${roleBadge}</p>
</td></tr>
</table>
<h3 class="sg-heading" style="color:#1A1F3A;margin:16px 0 8px;font-family:${FONT_STACK}">Next steps:</h3>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Visit the organization dashboard to explore tools and settings</li>
<li>Review your permissions and role within the organization</li>
</ul>
${ctaButton('View Organization', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `${escapeHtml(inviterName)} added you to ${escapeHtml(orgName)} on SettleGrid.` }
    ),
  }
}

export function orgMemberRemovedEmail(
  email: string,
  orgName: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`You've been removed from ${orgName} on SettleGrid`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Organization Access Revoked</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your access to <strong>${escapeHtml(orgName)}</strong> on SettleGrid has been revoked.</p>
${alertBanner('info', 'Access revoked', 'You no longer have access to tools, API keys, or settings associated with this organization.')}
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px;margin:16px 0 0">If you believe this was a mistake, contact the organization administrator or reach out to <a href="mailto:support@settlegrid.ai" style="color:#059669">support@settlegrid.ai</a>.</p>
`,
      { preheader: `Your access to ${escapeHtml(orgName)} on SettleGrid has been revoked.` }
    ),
  }
}

export function waitlistConfirmationEmail(
  email: string,
  feature: string
): EmailTemplate {
  return {
    subject: sanitizeSubject("You're on the SettleGrid waitlist"),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">You're on the Waitlist!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Thanks for your interest in <strong>${escapeHtml(feature)}</strong>. We've added you to our waitlist and will notify you as soon as access is available.</p>
${alertBanner('success', 'What to expect', 'We will email you when your spot is ready. Early waitlist members often receive priority access and special offers.')}
${ctaButton('Learn More', 'https://settlegrid.ai/docs')}
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px;margin:16px 0 0">In the meantime, explore our documentation to learn more about SettleGrid.</p>
`,
      { preheader: `You're on the waitlist for ${escapeHtml(feature)} on SettleGrid.` }
    ),
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sanitize a string for use in email subjects.
 * Strips CR/LF characters to prevent email header injection,
 * and truncates to a safe length.
 */
export function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
