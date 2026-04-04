/**
 * Email templates and sending utilities for SettleGrid.
 * Uses Resend for transactional email delivery.
 */

import { logger } from '@/lib/logger'
import { getResendApiKey } from '@/lib/env'

// ── Constants ────────────────────────────────────────────────────────────────

export const FROM_TRANSACTIONAL = 'SettleGrid <notifications@settlegrid.ai>'
export const FROM_OUTREACH = 'Luther from SettleGrid <luther@mail.settlegrid.ai>'

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
<!-- Gold flow band -->
<tr><td style="padding:0">
<div style="height:3px;background:linear-gradient(90deg, transparent, #E5A336 20%, #F5C963 50%, #E5A336 80%, transparent);border-radius:2px"></div>
</td></tr>
<!-- Logo -->
<tr><td align="center" style="padding:16px 0 24px">
<span style="display:inline-block;font-size:22px;letter-spacing:-0.5px"><span style="font-weight:700;color:#1A1F3A">Settle</span><span style="font-weight:400;color:#E5A336">Grid</span></span>
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
<!-- Gold flow band -->
<tr><td style="padding:0 0 12px">
<div style="height:2px;background:linear-gradient(90deg, transparent, #C4891E 20%, #E5A336 50%, #C4891E 80%, transparent);border-radius:2px"></div>
</td></tr>
<tr><td align="center" style="padding-bottom:12px">
<a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-size:13px;margin:0 8px">Website</a>
<span class="sg-muted" style="color:#d1d5db">&middot;</span>
<a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:none;font-size:13px;margin:0 8px">Docs</a>
<span class="sg-muted" style="color:#d1d5db">&middot;</span>
<a href="mailto:support@settlegrid.ai" style="color:#E5A336;text-decoration:none;font-size:13px;margin:0 8px">Support</a>
</td></tr>
<tr><td align="center" style="padding-bottom:12px">
<p style="font-size:11px;color:#666;text-align:center;margin:0">Powered by <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> &mdash; The settlement layer for the AI economy</p>
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
export function ctaButton(text: string, href: string, color = '#E5A336'): string {
  // Non-gold colors (e.g. red for warnings) use the original style with white text
  const isGold = color === '#E5A336'
  const bgStyle = isGold
    ? 'background:linear-gradient(135deg, #E5A336, #D4961F)'
    : `background-color:${color}`
  const textColor = isGold ? '#1A1F3A' : '#ffffff'

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto"><tr><td align="center" style="border-radius:8px;${bgStyle}">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:44px;v-text-anchor:middle;width:200px" arcsize="18%" strokecolor="${color}" fillcolor="${color}">
<w:anchorlock/>
<center style="color:${textColor};font-family:${FONT_STACK};font-size:15px;font-weight:600">${escapeHtml(text)}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${escapeHtml(href)}" style="display:inline-block;${bgStyle};color:${textColor};text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;font-family:${FONT_STACK};line-height:1.2;mso-hide:all">${escapeHtml(text)}</a>
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
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">You're all set to start monetizing your AI tools — <strong>free forever</strong>. Your Free plan includes 50,000 ops/month, unlimited tools, and a progressive take rate (0% on your first $1K/mo of revenue). No credit card required.</p>
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
<li>Browse available tools in the showcase</li>
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

export function newSignupNotificationEmail(
  type: 'developer' | 'consumer',
  email: string,
  name: string | null,
  createdAt: string,
): EmailTemplate {
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
  const displayName = name ? escapeHtml(name) : 'N/A'
  const formattedDate = new Date(createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return {
    subject: sanitizeSubject(`New ${type} signup: ${email}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">New ${typeLabel} Signup</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A new ${type} just signed up on SettleGrid.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">Email</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK};font-weight:600">${escapeHtml(email)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">Name</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">${displayName}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">Type</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">${statusBadge(type === 'developer' ? 'active' : 'pending', typeLabel)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">Signed up</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;font-family:${FONT_STACK}">${escapeHtml(formattedDate)}</td></tr>
</table>
${ctaButton('View Admin Dashboard', 'https://settlegrid.ai/admin')}
`,
      { preheader: `New ${type} signup: ${email}` }
    ),
  }
}

export function stripeConnectCompleteEmail(
  name: string,
  options?: { preheader?: string; revenueSharePct?: number }
): EmailTemplate {
  return {
    subject: 'Stripe Connect is active — You can now receive payouts',
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Stripe Connect Active</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Great news, ${escapeHtml(name)}! Your Stripe Connect account is now active. You'll receive payouts automatically based on your payout schedule.</p>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Revenue split: Progressive take rate — 0% on your first $1K/mo</li>
<li>Minimum payout: $1.00 — get paid from your very first earnings</li>
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
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, a payout of <strong style="color:#E5A336">${formatted}</strong> has been initiated to your connected Stripe account.</p>
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
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your purchase of <strong style="color:#E5A336">${formatted}</strong> in credits for <strong>${escapeHtml(toolName)}</strong> has been confirmed.</p>
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
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px">If you believe this was a mistake, contact <a href="mailto:support@settlegrid.ai" style="color:#E5A336">support@settlegrid.ai</a> within 30 days.</p>
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
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your payout of <strong style="color:#E5A336">${formatted}</strong> has been deposited to your bank account.</p>
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
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px;margin:16px 0 0">If you believe this was a mistake, contact the organization administrator or reach out to <a href="mailto:support@settlegrid.ai" style="color:#E5A336">support@settlegrid.ai</a>.</p>
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

// ── Nice-to-have templates ────────────────────────────────────────────────────

export function cardExpiringEmail(
  email: string,
  last4: string,
  expiryMonth: number,
  expiryYear: number
): EmailTemplate {
  const safeLast4 = escapeHtml(last4)
  const monthStr = String(expiryMonth).padStart(2, '0')
  return {
    subject: sanitizeSubject(`Your card ending in ${last4} expires soon`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Card Expiring Soon</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The payment card on file for your SettleGrid account is expiring soon. Please update it to avoid service interruption.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#92400e;margin:0 0 4px;font-size:14px"><strong>Card:</strong> **** ${safeLast4}</p>
<p class="sg-text" style="color:#92400e;margin:0;font-size:14px"><strong>Expires:</strong> ${monthStr}/${expiryYear}</p>
</td></tr>
</table>
${alertBanner('warning', 'Action needed', 'Update your payment method before the card expires to prevent failed charges and service disruption.')}
${ctaButton('Update Payment Method', 'https://settlegrid.ai/consumer')}
`,
      { preheader: `Your card ending in ${last4} expires ${monthStr}/${expiryYear}. Update it now.` }
    ),
  }
}

export function dunningEmail(
  email: string,
  dayNumber: number,
  failedAmountCents: number,
  toolName: string
): EmailTemplate {
  const formatted = formatCurrency(failedAmountCents)
  const safeTool = escapeHtml(toolName)

  const subjectMap: Record<number, string> = {
    0: `Action required: payment failed for ${toolName}`,
    3: `Reminder: payment still failing for ${toolName}`,
    7: `Urgent: service may be interrupted for ${toolName}`,
    14: `Final notice: account at risk for ${toolName}`,
  }
  const subject = sanitizeSubject(
    subjectMap[dayNumber] ?? `Action required: payment failed for ${toolName}`
  )

  const urgencyMap: Record<number, { heading: string; body: string; bannerType: 'warning' | 'error'; ctaColor: string }> = {
    0: {
      heading: 'Payment Failed',
      body: `We were unable to process your payment of <strong style="color:#ef4444">${formatted}</strong> for <strong>${safeTool}</strong>. Please update your payment method to continue using the service.`,
      bannerType: 'warning',
      ctaColor: '#E5A336',
    },
    3: {
      heading: 'Payment Still Failing',
      body: `Your payment of <strong style="color:#ef4444">${formatted}</strong> for <strong>${safeTool}</strong> has been failing for 3 days. Please update your payment method as soon as possible.`,
      bannerType: 'warning',
      ctaColor: '#d97706',
    },
    7: {
      heading: 'Service Interruption Warning',
      body: `Your payment of <strong style="color:#ef4444">${formatted}</strong> for <strong>${safeTool}</strong> has been failing for 7 days. Your service may be suspended if payment is not resolved soon.`,
      bannerType: 'error',
      ctaColor: '#d97706',
    },
    14: {
      heading: 'Final Notice',
      body: `Your payment of <strong style="color:#ef4444">${formatted}</strong> for <strong>${safeTool}</strong> has been failing for 14 days. Your account is at risk of suspension and your API keys may be disabled.`,
      bannerType: 'error',
      ctaColor: '#ef4444',
    },
  }

  const config = urgencyMap[dayNumber] ?? urgencyMap[0]

  const bannerMessages: Record<number, { title: string; body: string }> = {
    0: { title: 'What happens next', body: 'We will retry the charge in 3 days. Update your payment method to avoid further issues.' },
    3: { title: 'Important', body: 'We will make one more attempt in 4 days. After that, your service may be interrupted.' },
    7: { title: 'Urgent', body: 'Your service will be suspended in 7 days if payment is not resolved.' },
    14: { title: 'Final warning', body: 'Your API keys will be disabled and service suspended if payment is not resolved immediately.' },
  }

  const banner = bannerMessages[dayNumber] ?? bannerMessages[0]

  return {
    subject,
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">${config.heading}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">${config.body}</p>
${alertBanner(config.bannerType, banner.title, banner.body)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Failed amount', formatted)}
${dataRow('Tool', toolName)}
${dataRow('Days overdue', String(dayNumber))}
</table>
${ctaButton('Update Payment', 'https://settlegrid.ai/consumer', config.ctaColor)}
`,
      { preheader: `Payment of ${formatted} for ${toolName} failed. Update your payment method.` }
    ),
  }
}

export function firstToolPublishedEmail(
  name: string,
  toolName: string,
  toolSlug: string
): EmailTemplate {
  const safeSlug = encodeURIComponent(toolSlug)
  return {
    subject: sanitizeSubject('Your first tool is live on SettleGrid!'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Congratulations, ${escapeHtml(name)}!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your first tool, <strong>${escapeHtml(toolName)}</strong>, is now live on SettleGrid and ready to earn revenue.</p>
${alertBanner('success', 'Tool published', 'Your tool is visible in the showcase and ready to receive API calls.')}
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Next steps:</h3>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Embed the SettleGrid widget on your site</li>
<li>Set per-call pricing for your tool</li>
<li>Share your tool link with potential users</li>
</ol>
${ctaButton('View Your Tool', `https://settlegrid.ai/tools/${safeSlug}`)}
`,
      { preheader: `${escapeHtml(toolName)} is now live! Start earning with every API call.` }
    ),
  }
}

export function toolStatusChangedEmail(
  name: string,
  toolName: string,
  fromStatus: string,
  toStatus: string
): EmailTemplate {
  const verb = toStatus === 'active' ? 'activated' : 'deactivated'
  const fromBadge = statusBadge(
    fromStatus === 'active' ? 'active' : 'failed',
    fromStatus
  )
  const toBadge = statusBadge(
    toStatus === 'active' ? 'active' : 'failed',
    toStatus
  )
  const implication =
    toStatus === 'active'
      ? 'Your tool is now accepting API calls and generating revenue.'
      : 'Your tool is no longer accepting API calls. Existing consumers will receive errors.'

  return {
    subject: sanitizeSubject(`Your tool ${toolName} has been ${verb}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Tool Status Changed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, the status of <strong>${escapeHtml(toolName)}</strong> has been updated.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>Status:</strong> ${fromBadge} &rarr; ${toBadge}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">${escapeHtml(implication)}</p>
${ctaButton('View Tool', 'https://settlegrid.ai/dashboard/tools')}
`,
      { preheader: `Your tool ${escapeHtml(toolName)} has been ${verb}.` }
    ),
  }
}

const PLAN_DETAILS: Record<string, { label: string; opsLimit: string; takeRate: string }> = {
  standard: { label: 'Free', opsLimit: '50,000', takeRate: 'Progressive (0% on first $1K/mo)' },
  builder: { label: 'Builder', opsLimit: '200,000', takeRate: 'Progressive' },
  starter: { label: 'Builder', opsLimit: '200,000', takeRate: 'Progressive' }, // legacy alias
  growth: { label: 'Builder', opsLimit: '200,000', takeRate: 'Progressive' }, // legacy alias
  scale: { label: 'Scale', opsLimit: '2,000,000', takeRate: 'Progressive' },
}

const PLAN_RANK: Record<string, number> = { standard: 0, builder: 1, starter: 1, growth: 1, scale: 2 }

export function planChangedEmail(
  name: string,
  oldPlan: string,
  newPlan: string
): EmailTemplate {
  const isUpgrade = (PLAN_RANK[newPlan] ?? 0) > (PLAN_RANK[oldPlan] ?? 0)
  const oldDetails = PLAN_DETAILS[oldPlan] ?? PLAN_DETAILS.standard
  const newDetails = PLAN_DETAILS[newPlan] ?? PLAN_DETAILS.standard

  const changeNote = isUpgrade
    ? `You now have access to ${newDetails.opsLimit} operations/month.`
    : `Your new limit of ${newDetails.opsLimit} operations/month takes effect immediately. A prorated credit has been applied.`

  return {
    subject: sanitizeSubject('Your SettleGrid plan has been updated'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Plan ${isUpgrade ? 'Upgraded' : 'Changed'}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your plan has been changed from <strong>${escapeHtml(oldDetails.label)}</strong> to <strong>${escapeHtml(newDetails.label)}</strong>.</p>
${alertBanner(isUpgrade ? 'success' : 'info', isUpgrade ? 'Upgrade confirmed' : 'Plan updated', changeNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Previous plan', oldDetails.label)}
${dataRow('New plan', newDetails.label)}
${dataRow('Operations/month', newDetails.opsLimit)}
${dataRow('Take rate', newDetails.takeRate)}
</table>
${ctaButton('View Your Plan', 'https://settlegrid.ai/dashboard/settings')}
`,
      { preheader: `Your plan has been changed from ${oldDetails.label} to ${newDetails.label}. ${changeNote}` }
    ),
  }
}

export function revenueMilestoneEmail(
  name: string,
  toolName: string,
  milestoneAmount: number
): EmailTemplate {
  const formatted = formatCurrency(milestoneAmount)
  return {
    subject: sanitizeSubject(`You just earned ${formatted} on SettleGrid!`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Revenue Milestone Reached!</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Congratulations, ${escapeHtml(name)}! Your tool <strong>${escapeHtml(toolName)}</strong> has earned a total of <strong style="color:#E5A336">${formatted}</strong> on SettleGrid.</p>
${alertBanner('success', 'Milestone unlocked', `You have reached ${formatted} in total earnings. Keep building great tools!`)}
${ctaButton('View Earnings', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `${escapeHtml(toolName)} just hit ${formatted} in earnings!` }
    ),
  }
}

export interface ToolBreakdownItem {
  toolName: string
  amountCents: number
  invocations?: number
}

const UNSUBSCRIBE_FOOTER = `<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:24px 0 0;text-align:center">You are receiving this because you have a SettleGrid account. <a href="https://settlegrid.ai/dashboard/settings" style="color:#E5A336;text-decoration:underline">Manage email preferences</a> or <a href="https://settlegrid.ai/unsubscribe" style="color:#E5A336;text-decoration:underline">unsubscribe</a>.</p>`

export function monthlyEarningsSummaryEmail(
  name: string,
  monthName: string,
  totalEarnedCents: number,
  toolBreakdown: ToolBreakdownItem[]
): EmailTemplate {
  const formatted = formatCurrency(totalEarnedCents)
  const breakdownRows = toolBreakdown
    .map((t) => dataRow(t.toolName, formatCurrency(t.amountCents)))
    .join('')

  return {
    subject: sanitizeSubject(`Your ${monthName} earnings summary — ${formatted}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Your ${escapeHtml(monthName)} Earnings Summary</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, here is a summary of your earnings for ${escapeHtml(monthName)}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${breakdownRows}
${dataRow('Total Earned', formatted, true)}
</table>
${dividerLine()}
<p class="sg-text" style="color:#4b5563;line-height:1.6">Payouts are processed based on your schedule and sent to your connected Stripe account.</p>
${ctaButton('View Dashboard', 'https://settlegrid.ai/dashboard')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `You earned ${formatted} in ${escapeHtml(monthName)}. View your breakdown.` }
    ),
  }
}

export function monthlyUsageSummaryEmail(
  email: string,
  monthName: string,
  totalSpentCents: number,
  totalInvocations: number,
  toolBreakdown: ToolBreakdownItem[]
): EmailTemplate {
  const formatted = formatCurrency(totalSpentCents)
  const breakdownRows = toolBreakdown
    .map((t) =>
      dataRow(
        t.toolName,
        `${formatCurrency(t.amountCents)}${t.invocations != null ? ` (${t.invocations.toLocaleString()} calls)` : ''}`
      )
    )
    .join('')

  return {
    subject: sanitizeSubject(`Your ${monthName} usage summary`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Your ${escapeHtml(monthName)} Usage Summary</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Here is your usage summary for ${escapeHtml(monthName)}.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#1e40af;margin:0 0 4px;font-size:14px"><strong>Total spent:</strong> ${formatted}</p>
<p class="sg-text" style="color:#1e40af;margin:0;font-size:14px"><strong>Total invocations:</strong> ${totalInvocations.toLocaleString()}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${breakdownRows}
${dataRow('Total', formatted, true)}
</table>
${ctaButton('View Usage', 'https://settlegrid.ai/consumer')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `You spent ${formatted} across ${totalInvocations.toLocaleString()} invocations in ${escapeHtml(monthName)}.` }
    ),
  }
}

export function ipAllowlistChangedEmail(
  email: string,
  keyPrefix: string,
  toolName: string,
  action: string,
  ipValue: string
): EmailTemplate {
  const safePrefix = escapeHtml(keyPrefix)
  return {
    subject: sanitizeSubject(`IP allowlist updated for API key ${keyPrefix}...`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">IP Allowlist Updated</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The IP allowlist for your API key has been modified.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>API key:</strong> <code class="sg-code" style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${safePrefix}...</code></p>
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>Tool:</strong> ${escapeHtml(toolName)}</p>
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>Action:</strong> ${escapeHtml(action)}</p>
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>IP:</strong> <code class="sg-code" style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(ipValue)}</code></p>
</td></tr>
</table>
${alertBanner('info', 'Security notice', 'If you did not make this change, review your API keys immediately.')}
${ctaButton('Manage API Keys', 'https://settlegrid.ai/consumer')}
`,
      { preheader: `IP allowlist ${escapeHtml(action)} for API key ${safePrefix}...` }
    ),
  }
}

export function orgRoleChangedEmail(
  email: string,
  orgName: string,
  oldRole: string,
  newRole: string
): EmailTemplate {
  const oldBadge = statusBadge('pending', oldRole)
  const newBadge = statusBadge('active', newRole)
  return {
    subject: sanitizeSubject(`Your role in ${orgName} was changed to ${newRole}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Organization Role Changed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your role in <strong>${escapeHtml(orgName)}</strong> has been updated.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>Role:</strong> ${oldBadge} &rarr; ${newBadge}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Your permissions within the organization have been updated to match your new role. Review your access in the organization dashboard.</p>
${ctaButton('View Organization', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `Your role in ${escapeHtml(orgName)} changed from ${escapeHtml(oldRole)} to ${escapeHtml(newRole)}.` }
    ),
  }
}

export function orgBudgetWarningEmail(
  billingEmail: string,
  orgName: string,
  spentCents: number,
  budgetCents: number,
  percentage: number
): EmailTemplate {
  const spentFormatted = formatCurrency(spentCents)
  const budgetFormatted = formatCurrency(budgetCents)
  return {
    subject: sanitizeSubject(`Budget alert: ${orgName} at ${percentage}% of monthly limit`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Budget Alert</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong>${escapeHtml(orgName)}</strong> has reached <strong style="color:#ef4444">${percentage}%</strong> of its monthly budget.</p>
${alertBanner(percentage >= 90 ? 'error' : 'warning', `${percentage}% of budget used`, `Your organization has spent ${spentFormatted} of the ${budgetFormatted} monthly limit.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Amount spent', spentFormatted)}
${dataRow('Monthly budget', budgetFormatted)}
${dataRow('Usage', `${percentage}%`)}
</table>
${ctaButton('View Budget', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `${escapeHtml(orgName)} has used ${percentage}% of its monthly budget (${spentFormatted} / ${budgetFormatted}).` }
    ),
  }
}

export function gasWalletLowEmail(
  adminEmail: string,
  balanceEth: string,
  network: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`Gas wallet balance low on ${network}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Gas Wallet Balance Low</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The gas wallet on <strong>${escapeHtml(network)}</strong> is running low and may not be able to process settlements.</p>
${alertBanner('error', 'Low balance', `Current balance: ${escapeHtml(balanceEth)} ETH on ${escapeHtml(network)}. Top up immediately to avoid settlement failures.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Network', network)}
${dataRow('Current balance', `${balanceEth} ETH`)}
</table>
<p class="sg-text" style="color:#6b7280;line-height:1.6;font-size:13px;margin:16px 0 0">This is an admin-only notification. Transfer funds to the gas wallet to resume normal operations.</p>
`,
      { preheader: `Gas wallet on ${escapeHtml(network)} is low at ${escapeHtml(balanceEth)} ETH. Refill urgently.` }
    ),
  }
}

export function disputeOpenedEmail(
  email: string,
  verificationId: string,
  reason: string,
  role: string
): EmailTemplate {
  const safeId = escapeHtml(verificationId)
  return {
    subject: sanitizeSubject(`Dispute opened on outcome #${verificationId}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Dispute Opened</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A dispute has been opened on verification outcome <strong>#${safeId}</strong>.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#991b1b;margin:0 0 4px;font-size:14px"><strong>Verification ID:</strong> #${safeId}</p>
<p class="sg-text" style="color:#991b1b;margin:0 0 4px;font-size:14px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p class="sg-text" style="color:#991b1b;margin:0;font-size:14px"><strong>Your role:</strong> ${escapeHtml(role)}</p>
</td></tr>
</table>
${alertBanner('warning', '24-hour deadline', 'Both parties have been notified. You have 24 hours to respond to this dispute before it is auto-resolved.')}
${ctaButton('View Dispute', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `A dispute was opened on outcome #${safeId}. Respond within 24 hours.` }
    ),
  }
}

export function disputeResolvedEmail(
  email: string,
  verificationId: string,
  resolution: string,
  settledPriceCents: number
): EmailTemplate {
  const safeId = escapeHtml(verificationId)
  const formatted = formatCurrency(settledPriceCents)
  return {
    subject: sanitizeSubject(`Dispute resolved: #${verificationId}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Dispute Resolved</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The dispute on verification outcome <strong>#${safeId}</strong> has been resolved.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#166534;margin:0 0 4px;font-size:14px"><strong>Resolution:</strong> ${escapeHtml(resolution)}</p>
<p class="sg-text" style="color:#166534;margin:0;font-size:14px"><strong>Final price:</strong> ${formatted}</p>
</td></tr>
</table>
${ctaButton('View Outcome', 'https://settlegrid.ai/dashboard')}
`,
      { preheader: `Dispute #${safeId} has been resolved. Final price: ${formatted}.` }
    ),
  }
}

export function toolHealthDownEmail(
  email: string,
  toolName: string,
  downSince: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`Your tool ${toolName} is down`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Tool Health Alert</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your tool <strong>${escapeHtml(toolName)}</strong> has been detected as unhealthy and is not responding to health checks.</p>
${alertBanner('error', 'Tool is down', `${escapeHtml(toolName)} has been unreachable since ${escapeHtml(downSince)}. Consumers will receive errors until the tool is restored.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Tool', toolName)}
${dataRow('Down since', downSince)}
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Please check your health endpoint and ensure your tool is reachable.</p>
${ctaButton('Check Health', 'https://settlegrid.ai/dashboard/health')}
`,
      { preheader: `${escapeHtml(toolName)} is down since ${escapeHtml(downSince)}. Check your health endpoint.` }
    ),
  }
}

export function toolHealthRecoveredEmail(
  email: string,
  toolName: string,
  downtimeDuration: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`Your tool ${toolName} is back up`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Tool Recovered</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your tool <strong>${escapeHtml(toolName)}</strong> is back online and responding to health checks.</p>
${alertBanner('success', 'All clear', `${escapeHtml(toolName)} is healthy again. Total downtime: ${escapeHtml(downtimeDuration)}.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Tool', toolName)}
${dataRow('Downtime', downtimeDuration)}
</table>
${ctaButton('View Health', 'https://settlegrid.ai/dashboard/health')}
`,
      { preheader: `${escapeHtml(toolName)} is back up. Downtime was ${escapeHtml(downtimeDuration)}.` }
    ),
  }
}

export function featureAnnouncementEmail(
  email: string,
  featureTitle: string,
  featureDescription: string,
  ctaUrl: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`New on SettleGrid: ${featureTitle}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">New Feature: ${escapeHtml(featureTitle)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">${escapeHtml(featureDescription)}</p>
${alertBanner('info', 'Getting started', 'This feature is available now for all SettleGrid users. Try it out today.')}
${ctaButton('Try It Now', ctaUrl)}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `Introducing ${escapeHtml(featureTitle)} on SettleGrid.` }
    ),
  }
}

// ── Future templates ──────────────────────────────────────────────────────────

export function approachingRateLimitEmail(
  email: string,
  toolName: string,
  currentRate: number,
  limitRate: number
): EmailTemplate {
  return {
    subject: sanitizeSubject(`Approaching rate limit for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Rate Limit Warning</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your usage of <strong>${escapeHtml(toolName)}</strong> is approaching its rate limit.</p>
${alertBanner('warning', 'Approaching limit', `You are currently at ${currentRate} requests/min out of a ${limitRate} requests/min limit.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Current rate', `${currentRate} req/min`)}
${dataRow('Rate limit', `${limitRate} req/min`)}
${dataRow('Usage', `${Math.round((currentRate / limitRate) * 100)}%`)}
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Consider upgrading your plan or contacting the tool provider for higher limits.</p>
${ctaButton('View Usage', 'https://settlegrid.ai/consumer')}
`,
      { preheader: `${escapeHtml(toolName)} usage at ${currentRate}/${limitRate} req/min.` }
    ),
  }
}

export function settlementCompletedEmail(
  email: string,
  txHash: string,
  network: string,
  amountUsdc: string
): EmailTemplate {
  const explorerUrls: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    base: 'https://basescan.org/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
  }
  const baseUrl = explorerUrls[network.toLowerCase()] ?? 'https://etherscan.io/tx/'
  const txUrl = `${baseUrl}${txHash}`

  return {
    subject: sanitizeSubject(`Settlement confirmed on ${network}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Settlement Confirmed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your settlement has been confirmed on-chain.</p>
${alertBanner('success', 'Transaction confirmed', `${escapeHtml(amountUsdc)} USDC has been settled on ${escapeHtml(network)}.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Amount', `${amountUsdc} USDC`)}
${dataRow('Network', network)}
${dataRow('Transaction', txHash.slice(0, 10) + '...' + txHash.slice(-6))}
</table>
${ctaButton('View Transaction', txUrl)}
`,
      { preheader: `${escapeHtml(amountUsdc)} USDC settled on ${escapeHtml(network)}. Tx: ${txHash.slice(0, 10)}...` }
    ),
  }
}

export function settlementFailedEmail(
  email: string,
  reason: string,
  network: string
): EmailTemplate {
  return {
    subject: sanitizeSubject(`Settlement failed on ${network}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Settlement Failed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A settlement attempt on <strong>${escapeHtml(network)}</strong> has failed.</p>
${alertBanner('error', 'Settlement error', escapeHtml(reason))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Network', network)}
${dataRow('Error', reason)}
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">Please review the error and try again. If the issue persists, contact support.</p>
${ctaButton('Try Again', 'https://settlegrid.ai/consumer', '#ef4444')}
`,
      { preheader: `Settlement failed on ${escapeHtml(network)}: ${escapeHtml(reason)}` }
    ),
  }
}

export function newLoginEmail(
  email: string,
  ip: string,
  userAgent: string,
  timestamp: string
): EmailTemplate {
  return {
    subject: sanitizeSubject('New sign-in to your SettleGrid account'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">New Sign-In Detected</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">A new sign-in to your SettleGrid account was detected.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>IP address:</strong> <code class="sg-code" style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(ip)}</code></p>
<p class="sg-text" style="color:#374151;margin:0 0 4px;font-size:14px"><strong>Browser/Device:</strong> ${escapeHtml(userAgent.slice(0, 120))}</p>
<p class="sg-text" style="color:#374151;margin:0;font-size:14px"><strong>Time:</strong> ${escapeHtml(timestamp)}</p>
</td></tr>
</table>
${alertBanner('warning', 'Not you?', 'If you did not sign in, secure your account immediately by changing your password and revoking API keys.')}
${ctaButton('Secure Account', 'https://settlegrid.ai/dashboard/settings', '#d97706')}
`,
      { preheader: `New sign-in from ${escapeHtml(ip)} at ${escapeHtml(timestamp)}.` }
    ),
  }
}

// ── Security alert templates ─────────────────────────────────────────────────

export function passwordChangedEmail(
  email: string,
  options?: { preheader?: string }
): EmailTemplate {
  return {
    subject: sanitizeSubject('Your SettleGrid password was changed'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Password Changed</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your SettleGrid account password was successfully changed.</p>
${alertBanner('warning', 'Not you?', 'If you did not make this change, contact support immediately at support@settlegrid.ai. Your account may be compromised.')}
${ctaButton('Secure My Account', 'https://settlegrid.ai/dashboard/settings#security', '#d97706')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">If you made this change, you can safely ignore this email.</p>
`,
      { preheader: options?.preheader ?? 'Your SettleGrid password was changed. If this was not you, contact support immediately.' }
    ),
  }
}

export function accountLockedEmail(
  email: string,
  ip: string,
  reason: string,
  options?: { preheader?: string }
): EmailTemplate {
  return {
    subject: sanitizeSubject('Your SettleGrid account was temporarily locked'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Account Temporarily Locked</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your SettleGrid account was temporarily locked due to suspicious activity.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#991b1b;margin:0 0 4px;font-size:14px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p class="sg-text" style="color:#991b1b;margin:0;font-size:14px"><strong>IP address:</strong> <code class="sg-code" style="background:#fecaca;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">${escapeHtml(ip)}</code></p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6">The lock will automatically expire after 15 minutes. If you believe this was a mistake, contact support.</p>
${ctaButton('Contact Support', 'mailto:support@settlegrid.ai', '#ef4444')}
`,
      { preheader: options?.preheader ?? `Your account was temporarily locked due to ${reason} from IP ${ip}.` }
    ),
  }
}

// ── Usage Alert Templates ────────────────────────────────────────────────────

const TIER_DISPLAY_NAMES: Record<string, string> = {
  standard: 'Free',
  builder: 'Builder',
  starter: 'Builder', // legacy alias
  growth: 'Builder', // legacy alias
  scale: 'Scale',
  enterprise: 'Enterprise',
}

/**
 * Sent when a developer reaches 80% of their monthly operation limit.
 * Friendly heads-up with current stats and optional upgrade link.
 */
export function usageWarning80Email(
  name: string,
  currentOps: number,
  limit: number,
  tier: string
): EmailTemplate {
  const tierName = TIER_DISPLAY_NAMES[tier] ?? tier
  const opsFormatted = currentOps.toLocaleString()
  const limitFormatted = limit.toLocaleString()
  return {
    subject: sanitizeSubject("You've used 80% of your monthly operations"),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Approaching Your Monthly Limit</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your tools have used <strong>80%</strong> of your monthly operation limit on the <strong>${escapeHtml(tierName)}</strong> plan.</p>
<table role="presentation" class="sg-info-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:16px 0">
<tr><td style="padding:12px 16px">
<p class="sg-text" style="color:#92400e;margin:0 0 4px;font-size:14px"><strong>Current usage:</strong> ${opsFormatted} / ${limitFormatted} operations</p>
<p class="sg-text" style="color:#92400e;margin:0;font-size:14px"><strong>Plan:</strong> ${escapeHtml(tierName)}</p>
</td></tr>
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">No action is needed yet. This is just a heads-up so you can plan ahead. If you expect to exceed your limit, consider upgrading for more capacity.</p>
${ctaButton('View Usage', 'https://settlegrid.ai/dashboard')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">Your operations reset on the first of each month.</p>
`,
      { preheader: `You've used ${opsFormatted} of ${limitFormatted} operations this month (80%).` }
    ),
  }
}

/**
 * Sent when a developer reaches 90% of their monthly operation limit.
 * Stronger nudge with more prominent upgrade CTA.
 */
export function usageWarning90Email(
  name: string,
  currentOps: number,
  limit: number,
  tier: string
): EmailTemplate {
  const tierName = TIER_DISPLAY_NAMES[tier] ?? tier
  const opsFormatted = currentOps.toLocaleString()
  const limitFormatted = limit.toLocaleString()
  return {
    subject: sanitizeSubject("You've used 90% of your monthly operations"),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Nearing Your Monthly Limit</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your tools have used <strong>90%</strong> of your monthly operation limit on the <strong>${escapeHtml(tierName)}</strong> plan.</p>
${alertBanner('warning', '90% of limit reached', `You have used ${opsFormatted} of ${limitFormatted} operations this month. You are close to exceeding your plan limit.`)}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your tools will continue to work even if you exceed the limit, but upgrading gives you higher capacity and priority support.</p>
${ctaButton('Upgrade Plan', 'https://settlegrid.ai/dashboard/settings#plan', '#d97706')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">Your operations reset on the first of each month.</p>
`,
      { preheader: `You've used ${opsFormatted} of ${limitFormatted} operations this month (90%). Consider upgrading.` }
    ),
  }
}

/**
 * Sent when a developer exceeds 100% of their monthly operation limit.
 * Reassures tools still work (soft limit) with strong upgrade CTA.
 */
export function usageExceededEmail(
  name: string,
  currentOps: number,
  limit: number,
  tier: string
): EmailTemplate {
  const tierName = TIER_DISPLAY_NAMES[tier] ?? tier
  const opsFormatted = currentOps.toLocaleString()
  const limitFormatted = limit.toLocaleString()
  return {
    subject: sanitizeSubject("You've exceeded your monthly operation limit"),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Monthly Limit Exceeded</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, your tools have exceeded the monthly operation limit on the <strong>${escapeHtml(tierName)}</strong> plan.</p>
${alertBanner('error', 'Limit exceeded', `You have used ${opsFormatted} operations this month, exceeding your ${limitFormatted} limit.`)}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong>Your tools still work.</strong> SettleGrid uses soft limits, so your users will not experience any disruption. However, we recommend upgrading to ensure you have the capacity your tools need.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Current usage', `${opsFormatted} operations`)}
${dataRow('Plan limit', `${limitFormatted} operations`)}
${dataRow('Plan', tierName)}
</table>
${ctaButton('Upgrade Now', 'https://settlegrid.ai/dashboard/settings#plan', '#ef4444')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">Your operations reset on the first of each month. Upgrading takes effect immediately.</p>
`,
      { preheader: `You've used ${opsFormatted} operations, exceeding your ${limitFormatted} monthly limit. Your tools still work.` }
    ),
  }
}

export function newReviewNotificationEmail(
  developerName: string,
  toolName: string,
  rating: number,
  comment: string | null,
  reviewDashboardUrl: string,
): EmailTemplate {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const color = i < rating ? '#facc15' : '#d1d5db'
    return `<span style="color:${color};font-size:20px">&#9733;</span>`
  }).join('')

  const commentHtml = comment
    ? `<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0;padding:12px 16px;background:#f9fafb;border-radius:8px;border-left:3px solid #E5A336;font-style:italic">"${escapeHtml(comment)}"</p>`
    : `<p class="sg-muted" style="color:#9ca3af;font-size:13px;margin:16px 0;font-style:italic">No comment was left with this review.</p>`

  return {
    subject: sanitizeSubject(`New ${rating}-star review on ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">New Review on ${escapeHtml(toolName)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px">Hi ${escapeHtml(developerName)}, someone just left a review on your tool.</p>
<div style="text-align:center;margin:16px 0">${stars}</div>
${commentHtml}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Responding to reviews helps build trust with consumers and improves your tool's reputation score.</p>
${ctaButton('View & Respond', reviewDashboardUrl)}
`,
      { preheader: `${rating}-star review on ${toolName}${comment ? `: "${comment.slice(0, 60)}..."` : ''}` }
    ),
  }
}

// ── Onboarding Drip Templates ────────────────────────────────────────────────

/**
 * D2: Sent ~24h after signup if the developer has not created a tool yet.
 */
export function onboardingNudgeToolEmail(devName: string): EmailTemplate {
  return {
    subject: sanitizeSubject('Your first tool takes 2 minutes'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Create Your First Tool</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, getting your first tool live on SettleGrid takes about 2 minutes. Here is how:</p>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Open the dashboard and click <strong>New Tool</strong></li>
<li>Give it a name, description, and set a per-call price</li>
<li>Install <code class="sg-code" style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;font-family:${CODE_FONT}">@settlegrid/mcp</code> and wrap your handler</li>
</ol>
${codeBlock(`import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({ apiKey: 'sg_live_...' })
export default sg.wrap(myHandler)`)}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">That is it. Your tool will be live and discoverable in the directory.</p>
${ctaButton('Create Your Tool', 'https://settlegrid.ai/dashboard/tools/new')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: 'Create your first monetized tool in about 2 minutes.' }
    ),
  }
}

/**
 * D3: Sent ~2h after tool creation if pricing has not been configured.
 */
export function onboardingNudgePricingEmail(devName: string, toolName: string): EmailTemplate {
  return {
    subject: sanitizeSubject(`Set pricing for ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Set Pricing for ${escapeHtml(toolName)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, your tool <strong>${escapeHtml(toolName)}</strong> is created but does not have pricing set yet. Here are some common patterns:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Simple API call', '$0.001 - $0.01 per call')}
${dataRow('AI inference', '$0.01 - $0.10 per call')}
${dataRow('Heavy compute', '$0.10 - $1.00 per call')}
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">You can set per-method pricing for fine-grained control, or a flat rate for simplicity.</p>
${ctaButton('Set Pricing', 'https://settlegrid.ai/dashboard/tools')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `Configure pricing for ${toolName} so consumers can start using it.` }
    ),
  }
}

/**
 * D4: Sent ~24h after tool creation if Stripe is not connected.
 */
export function onboardingNudgeStripeEmail(devName: string): EmailTemplate {
  return {
    subject: sanitizeSubject('Connect Stripe to start earning'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Connect Stripe to Get Paid</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, you have a tool on SettleGrid but have not connected your Stripe account yet. Without Stripe, you cannot receive payouts.</p>
${alertBanner('info', 'Industry-low $1 minimum payout', 'SettleGrid has the lowest minimum payout in the industry. Free-tier developers keep 100% of revenue with a 0% take rate.')}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Connecting takes about 60 seconds through Stripe Connect Express.</p>
${ctaButton('Connect Stripe', 'https://settlegrid.ai/dashboard/settings#stripe')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: 'Connect Stripe to receive payouts from your SettleGrid tools.' }
    ),
  }
}

/**
 * D8: Sent ~7 days after signup if the developer has not created any tool.
 */
export function onboardingStuckEmail(devName: string): EmailTemplate {
  return {
    subject: sanitizeSubject('Need help getting started?'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Need Help Getting Started?</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, we noticed you signed up a week ago but have not created a tool yet. No worries — here are some ideas to get started:</p>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li><strong>Wrap an existing API</strong> — add metering and billing to any REST endpoint</li>
<li><strong>Build an AI tool</strong> — text generation, image analysis, embeddings</li>
<li><strong>Create a data service</strong> — weather, financial data, geocoding</li>
</ul>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Check out our open-source example servers for inspiration, or browse the directory to see what other developers have built.</p>
${ctaButton('Browse Examples', 'https://settlegrid.ai/directory')}
<p class="sg-muted" style="color:#9ca3af;font-size:13px;margin:16px 0 0">Need help? Reply to this email and we will get back to you.</p>
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: 'Ideas and examples to help you create your first SettleGrid tool.' }
    ),
  }
}

/**
 * R4: Sent ~7 days after tool creation if the tool is still in draft status.
 */
export function onboardingDraftToolEmail(devName: string, toolName: string, missing: string[]): EmailTemplate {
  const checklist = missing
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')

  return {
    subject: sanitizeSubject(`${toolName} is almost ready`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">${escapeHtml(toolName)} Is Almost Ready</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, your tool <strong>${escapeHtml(toolName)}</strong> is in draft status. Here is what is still needed to go live:</p>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
${checklist}
</ul>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Once these are completed, your tool will be discoverable in the SettleGrid directory and consumers can start using it.</p>
${ctaButton('Complete Setup', 'https://settlegrid.ai/dashboard/tools')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `${toolName} needs ${missing.length} more step${missing.length === 1 ? '' : 's'} to go live.` }
    ),
  }
}

/**
 * R7: Sent ~48h after Stripe onboarding was started but not completed.
 */
export function onboardingStripeIncompleteEmail(devName: string): EmailTemplate {
  return {
    subject: sanitizeSubject('Finish connecting Stripe — 60 seconds left'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Finish Connecting Stripe</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, it looks like you started connecting your Stripe account but did not finish. You can pick up right where you left off — it only takes about 60 seconds.</p>
${alertBanner('warning', 'Payouts are on hold', 'Until Stripe is fully connected, any revenue from your tools cannot be paid out to you.')}
${ctaButton('Finish Connecting', 'https://settlegrid.ai/dashboard/settings#stripe', '#d97706')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: 'Pick up where you left off — finish connecting Stripe to receive payouts.' }
    ),
  }
}

// ── Quality Check Email Templates ────────────────────────────────────────────

/**
 * Sent when a tool's average response time exceeds the 2000ms threshold.
 */
export function toolSlowResponseEmail(devName: string, toolName: string, avgMs: number): EmailTemplate {
  return {
    subject: sanitizeSubject(`Slow responses detected on ${toolName}`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Slow Response Times on ${escapeHtml(toolName)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, your tool <strong>${escapeHtml(toolName)}</strong> has been averaging <strong>${avgMs.toLocaleString()}ms</strong> response times over the last hour. This is above the recommended 2,000ms threshold.</p>
${alertBanner('warning', 'Performance degradation', `Average response time: ${avgMs.toLocaleString()}ms (threshold: 2,000ms)`)}
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Possible causes:</h3>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Upstream API latency or timeouts</li>
<li>Database query performance</li>
<li>Cold starts or resource limits on your hosting provider</li>
</ul>
${ctaButton('View Tool Dashboard', 'https://settlegrid.ai/dashboard/tools')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">You will not receive another alert for this tool within 24 hours.</p>
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `${toolName} is averaging ${avgMs.toLocaleString()}ms response times — above the 2,000ms threshold.` }
    ),
  }
}

/**
 * Sent when a tool's error rate exceeds 10%.
 */
export function toolHighErrorRateEmail(devName: string, toolName: string, errorRate: number): EmailTemplate {
  const pct = errorRate.toFixed(1)
  return {
    subject: sanitizeSubject(`High error rate on ${toolName} — ${pct}%`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">High Error Rate on ${escapeHtml(toolName)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, your tool <strong>${escapeHtml(toolName)}</strong> has a <strong>${pct}%</strong> error rate over the last hour. This exceeds the 10% threshold.</p>
${alertBanner('error', 'Error rate elevated', `Current error rate: ${pct}% (threshold: 10%)`)}
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Recommended actions:</h3>
<ol class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Check your invocation logs for recurring error patterns</li>
<li>Verify your health endpoint is responding correctly</li>
<li>Review any recent deployment changes</li>
</ol>
${ctaButton('View Invocation Logs', 'https://settlegrid.ai/dashboard/tools')}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">You will not receive another alert for this tool within 24 hours.</p>
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `${toolName} has a ${pct}% error rate — exceeding the 10% threshold.` }
    ),
  }
}

/**
 * Sent when a previously active tool has zero invocations for 7+ days.
 */
export function toolNoTrafficEmail(devName: string, toolName: string, lastInvocationDate: string): EmailTemplate {
  return {
    subject: sanitizeSubject(`No traffic on ${toolName} for 7 days`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">No Traffic on ${escapeHtml(toolName)}</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, your tool <strong>${escapeHtml(toolName)}</strong> has not received any invocations since <strong>${escapeHtml(lastInvocationDate)}</strong>.</p>
${alertBanner('info', 'Zero invocations for 7+ days', 'Your tool was previously active but has stopped receiving traffic.')}
<h3 class="sg-heading" style="color:#1A1F3A;margin:24px 0 8px;font-family:${FONT_STACK}">Things to check:</h3>
<ul class="sg-text" style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Verify your health endpoint is responding</li>
<li>Check if your pricing is competitive in the directory</li>
<li>Share your tool listing to attract new consumers</li>
</ul>
${ctaButton('View Tool Dashboard', 'https://settlegrid.ai/dashboard/tools')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `${toolName} has had no traffic since ${lastInvocationDate}. Check your tool health.` }
    ),
  }
}

// ── Monthly Developer Summary Template ───────────────────────────────────────

export interface MonthlySummaryData {
  totalRevenueCents: number
  totalInvocations: number
  topToolName: string | null
  topToolRevenueCents: number
  momRevenuePct: number | null // null if no previous month data
  momInvocationPct: number | null
}

/**
 * Sent on the 1st of each month to developers with at least 1 active tool.
 */
export function monthlyDeveloperSummaryEmail(
  devName: string,
  monthName: string,
  data: MonthlySummaryData
): EmailTemplate {
  const revenue = formatCurrency(data.totalRevenueCents)
  const invocations = data.totalInvocations.toLocaleString()

  const trendLabel = (pct: number | null): string => {
    if (pct === null) return 'N/A (first month)'
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}% vs last month`
  }

  const topToolHtml = data.topToolName
    ? `${dataRow('Top tool', escapeHtml(data.topToolName))}${dataRow('Top tool revenue', formatCurrency(data.topToolRevenueCents))}`
    : ''

  return {
    subject: sanitizeSubject(`Your ${monthName} summary — ${revenue} earned`),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Your ${escapeHtml(monthName)} Summary</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(devName)}, here is how your tools performed in ${escapeHtml(monthName)}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Total revenue', revenue)}
${dataRow('Total invocations', invocations)}
${dataRow('Revenue trend', trendLabel(data.momRevenuePct))}
${dataRow('Invocation trend', trendLabel(data.momInvocationPct))}
${topToolHtml}
</table>
${dividerLine()}
<p class="sg-text" style="color:#4b5563;line-height:1.6">Keep building great tools. Your next payout will be processed according to your payout schedule.</p>
${ctaButton('View Dashboard', 'https://settlegrid.ai/dashboard')}
${UNSUBSCRIBE_FOOTER}
`,
      { preheader: `You earned ${revenue} from ${invocations} invocations in ${escapeHtml(monthName)}.` }
    ),
  }
}

// ── First Invocation Celebration ──────────────────────────────────────────

/**
 * Celebration email when a tool receives its first real (non-test) invocation.
 * This is a milestone — the tool is live and earning.
 */
export function firstInvocationCelebrationEmail(
  devName: string,
  toolName: string,
  toolId: string
): EmailTemplate {
  const analyticsUrl = `https://settlegrid.ai/dashboard/tools/${encodeURIComponent(toolId)}`

  return {
    subject: sanitizeSubject('Your tool just got its first call!'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">First Invocation!</h2>
${alertBanner('success', 'Milestone reached', `${escapeHtml(toolName)} just received its first real invocation on SettleGrid.`)}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0">Hi ${escapeHtml(devName)}, this is a milestone &mdash; your tool is now live and earning.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Check your analytics to see who is using it and how much you are earning.</p>
${ctaButton('View Analytics', analyticsUrl)}
<p class="sg-muted" style="color:#9ca3af;font-size:12px;margin:16px 0 0">Keep building. The more tools you publish, the more you earn.</p>
`,
      { preheader: `${toolName} just got its first real call on SettleGrid!` }
    ),
  }
}

// ── Referral Bonus Notification ──────────────────────────────────────────

/**
 * Email sent to the referrer when someone signs up using their invite code
 * and both parties are credited bonus operations.
 */
export function referralBonusEmail(
  devName: string,
  totalBonusOps: number,
  inviteUrl: string
): EmailTemplate {
  const formattedOps = new Intl.NumberFormat('en-US').format(totalBonusOps)

  return {
    subject: sanitizeSubject('You earned 5,000 bonus operations!'),
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px;font-family:${FONT_STACK}">Referral Bonus Earned</h2>
${alertBanner('success', '+5,000 operations', 'Someone just signed up using your invite link.')}
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0">Hi ${escapeHtml(devName)}, you have been credited <strong style="color:#E5A336">5,000 free operations</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${dataRow('Bonus credited', '5,000 ops')}
${dataRow('Total bonus balance', `${escapeHtml(formattedOps)} ops`, true)}
</table>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Share your link to earn more:</p>
${codeBlock(escapeHtml(inviteUrl))}
${ctaButton('View Referrals', 'https://settlegrid.ai/dashboard/referrals')}
`,
      { preheader: 'Someone signed up with your invite link. You earned 5,000 bonus operations!' }
    ),
  }
}

// ── Claim Your Listing Templates ─────────────────────────────────────────────

/**
 * Build a CAN-SPAM compliant footer that names the specific tool/model/package.
 * Explains HOW the email was triggered (auto-indexed from a public registry)
 * to pre-empt "is this spam?" objections.
 */
function outreachFooter(itemName: string, recipientEmail?: string): string {
  const unsubUrl = recipientEmail
    ? `https://settlegrid.ai/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
    : 'https://settlegrid.ai/unsubscribe'
  return `<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:0;text-align:center">You received this because <strong>${escapeHtml(itemName)}</strong> was auto-indexed on SettleGrid from a public registry. <a href="${unsubUrl}" style="color:#E5A336;text-decoration:underline">Unsubscribe</a></p>
<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:4px 0 0;text-align:center">Alerterra, LLC &middot; 2810 N Church St, Wilmington, DE 19802, PMB #481712</p>`
}

// ── Claim Follow-Up Email Templates (E2, E3, E4) ────────────────────────────

function followUpFooter(itemName: string, recipientEmail?: string): string {
  const unsubUrl = recipientEmail
    ? `https://settlegrid.ai/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
    : 'https://settlegrid.ai/unsubscribe'
  return `<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:0;text-align:center">We contact you under legitimate interest as the creator of a publicly listed tool. <a href="${unsubUrl}" style="color:#E5A336;text-decoration:underline">Unsubscribe</a></p>
<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:4px 0 0;text-align:center">You received this because <strong>${escapeHtml(itemName)}</strong> was auto-indexed on SettleGrid from a public registry.</p>
<p class="sg-muted" style="color:#9ca3af;font-size:11px;margin:4px 0 0;text-align:center">Alerterra, LLC &middot; 2810 N Church St, Wilmington, DE 19802, PMB #481712</p>`
}

/**
 * Follow-up E2 (Day 3): "What agents see when they find {toolName}"
 *
 * Shows the listing URL and includes a "Reply Yes" alternative for low-friction claim.
 */
export function claimFollowUpE2(
  firstName: string,
  toolName: string,
  toolSlug: string,
  claimToken: string,
  recipientEmail?: string
): EmailTemplate {
  const listingUrl = `https://settlegrid.ai/tools/${encodeURIComponent(toolSlug)}`
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`

  return {
    subject: sanitizeSubject(`What agents see for ${toolName}`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">When an AI agent searches for tools like <strong style="color:#1A1F3A">${escapeHtml(toolName)}</strong>, this is the listing page they find:</p>
<p class="sg-text" style="margin:0 0 16px"><a href="${escapeHtml(listingUrl)}" style="color:#E5A336;text-decoration:underline;font-weight:600">${escapeHtml(listingUrl)}</a></p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Right now, agents can discover it but cannot pay for it. Claiming takes 90 seconds and lets you set per-call pricing. Or just reply "Yes" to this email and we will walk you through it.</p>
${ctaButton('Claim your listing', claimUrl)}
${badgeMarkdownSection(toolSlug)}
${dividerLine()}
${followUpFooter(toolName, recipientEmail)}
`,
      { preheader: `Here is what AI agents see when they find ${toolName}.` }
    ),
  }
}

/**
 * Follow-up E3 (Day 10): "{toolCount} tools now listed" — social proof with real marketplace count.
 */
export function claimFollowUpE3(
  firstName: string,
  toolName: string,
  claimToken: string,
  toolCount: number,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`
  const countDisplay = toolCount.toLocaleString()

  return {
    subject: sanitizeSubject(`${countDisplay} tools now listed`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">SettleGrid now lists <strong style="color:#1A1F3A">${countDisplay}</strong> AI tools. Developers who claim their listing earn 95&ndash;100% of per-call revenue via Stripe with zero infrastructure work.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(toolName)}</strong> is still unclaimed. If you would like to set pricing, it takes about 90 seconds.</p>
${ctaButton('Claim your listing', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
${dividerLine()}
${followUpFooter(toolName, recipientEmail)}
`,
      { preheader: `${countDisplay} tools listed on SettleGrid. ${toolName} is still unclaimed.` }
    ),
  }
}

/**
 * Follow-up E4 (Day 24): "Last note about {toolName}" — breakup email, 4 sentences max.
 */
export function claimFollowUpE4(
  firstName: string,
  toolName: string,
  claimToken: string,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`

  return {
    subject: sanitizeSubject(`Last note about ${toolName}`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">This is my last email about <strong style="color:#1A1F3A">${escapeHtml(toolName)}</strong>. The listing will stay live on SettleGrid either way. If you ever want to claim it, the link below will still work. No hard feelings.</p>
${ctaButton('Claim your listing', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
${dividerLine()}
${followUpFooter(toolName, recipientEmail)}
`,
      { preheader: `Last note about ${toolName}. No more follow-ups after this.` }
    ),
  }
}

/**
 * Badge markdown section for claim outreach emails.
 * Provides copy-paste badge markdown to encourage README backlinks.
 */
function badgeMarkdownSection(slug: string): string {
  const badgeUrl = `https://settlegrid.ai/api/badge/tool/${encodeURIComponent(slug)}`
  const toolUrl = `https://settlegrid.ai/tools/${encodeURIComponent(slug)}`
  const markdownText = `[![SettleGrid](${badgeUrl})](${toolUrl})`
  return `<div style="margin-top:16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
<p style="color:#374151;font-size:13px;margin:0 0 8px;font-weight:600">Add a SettleGrid badge to your README:</p>
<pre style="margin:0;padding:8px;background:#1A1F3A;color:#f9fafb;border-radius:4px;font-size:12px;line-height:1.4;font-family:${CODE_FONT};white-space:pre-wrap;word-break:break-all">${escapeHtml(markdownText)}</pre>
</div>`
}

// ── Claim Outreach Templates (Initial E1) ────────────────────────────────────

/**
 * Outreach email sent to developers whose MCP server has been auto-indexed.
 *
 * Design principles (apply to all 5 claim templates):
 * - Subject: <50 chars, tool name included, curiosity-driven
 * - Preheader: complements (never repeats) the subject
 * - Opening: developer-first hook in first 2 lines
 * - Body: 4-5 short sentences max, no bullet lists
 * - Social proof: registry count (credible pre-traction)
 * - CTA: single, low-friction ("See your listing")
 * - Objection: one line explaining why they got this email
 * - Footer: CAN-SPAM with physical address + unsubscribe
 */
export function claimToolOutreachEmail(
  firstName: string,
  toolName: string,
  claimToken: string,
  sourceRepoUrl: string | null,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`
  return {
    subject: sanitizeSubject(`${toolName} has a listing page`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(toolName)}</strong> already has a listing page on <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> — a marketplace where AI agents discover and pay for tools per call.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0 16px">If you claim it, you can set per-call pricing and get paid via Stripe whenever an AI agent uses it. You keep 95&ndash;100% of revenue. No code changes or infrastructure work required. Claiming takes about 90 seconds.</p>
${ctaButton('See your listing & start earning', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0">Not your project? No worries — just ignore this email and we won't follow up.</p>
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:8px 0 0;text-align:center"><a href="https://settlegrid.ai/marketplace" style="color:#E5A336;text-decoration:underline">Browse the marketplace</a> &nbsp;&middot;&nbsp; <a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:underline">How it works</a></p>
${dividerLine()}
${outreachFooter(toolName, recipientEmail)}
`,
      { preheader: `AI agents can discover ${toolName} right now. Claim it to set pricing.` }
    ),
  }
}

// ── Ecosystem Claim Outreach Templates ───────────────────────────────────────

/**
 * Outreach email for AI model creators (HuggingFace, Replicate, etc.).
 * Hooks on the "your model is already discoverable" angle.
 * Emphasizes zero infrastructure changes and per-inference billing.
 */
export function claimAiModelEmail(
  firstName: string,
  modelName: string,
  claimToken: string,
  sourceUrl: string | null,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`
  return {
    subject: sanitizeSubject(`${modelName} — your listing is live`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(modelName)}</strong> already has a listing page on <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> — a marketplace where AI agents discover and pay for models per inference.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:16px 0 16px">If you claim it, you can set per-inference pricing and receive payouts via Stripe. You keep 95&ndash;100% of revenue. No changes to your model hosting or deployment needed. Claiming takes about 90 seconds.</p>
${ctaButton('See your listing & start earning', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0">Not your model? No worries — just ignore this and we won't follow up.</p>
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:8px 0 0;text-align:center"><a href="https://settlegrid.ai/marketplace/ai-models" style="color:#E5A336;text-decoration:underline">Browse AI models</a> &nbsp;&middot;&nbsp; <a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:underline">How it works</a></p>
${dividerLine()}
${outreachFooter(modelName, recipientEmail)}
`,
      { preheader: `AI agents can already find ${modelName}. Set your pricing in 90 seconds.` }
    ),
  }
}

/**
 * Outreach email for package creators (npm, PyPI, etc.).
 * Hooks on the ecosystem name (npm/PyPI) for immediate recognition.
 * Emphasizes that their existing package gains a new revenue channel.
 */
export function claimPackageEmail(
  firstName: string,
  packageName: string,
  claimToken: string,
  ecosystem: string,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`
  const ecosystemDisplay = escapeHtml(ecosystem)

  return {
    subject: sanitizeSubject(`${packageName} on SettleGrid`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(packageName)}</strong> already has a listing page on <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> — a marketplace where AI agents discover and pay for ${ecosystemDisplay} tools per call.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">If you claim it, you can add per-call pricing for AI agent usage and get paid via Stripe. You keep 95&ndash;100% of the revenue. Nothing changes for your existing ${ecosystemDisplay} users&nbsp;&mdash; this is an additional revenue channel. Claiming takes about 90 seconds.</p>
${ctaButton('See your listing & start earning', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0">Not your package? No worries — just ignore this and we won't follow up.</p>
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:8px 0 0;text-align:center"><a href="https://settlegrid.ai/marketplace/packages" style="color:#E5A336;text-decoration:underline">Browse packages</a> &nbsp;&middot;&nbsp; <a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:underline">How it works</a></p>
${dividerLine()}
${outreachFooter(packageName, recipientEmail)}
`,
      { preheader: `AI agents are discovering ${ecosystemDisplay} packages like ${packageName}. Claim yours.` }
    ),
  }
}

/**
 * Outreach email for API/automation service creators (Apify, REST APIs).
 * Hooks on the "agents can already find your service" angle.
 * Emphasizes autonomous machine-to-machine billing as the value prop.
 */
export function claimApiServiceEmail(
  firstName: string,
  serviceName: string,
  claimToken: string,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`

  return {
    subject: sanitizeSubject(`${serviceName} — agents can find you`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(serviceName)}</strong> already has a listing page on <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> — a marketplace where AI agents discover and pay for services autonomously.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">If you claim it, agents can pay per call automatically via Stripe. You set the price, you keep 95&ndash;100% of revenue. No SDK integration required&nbsp;&mdash; agents handle billing through SettleGrid's protocol. Claiming takes about 90 seconds.</p>
${ctaButton('See your listing & start earning', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0">Not your service? No worries — just ignore this and we won't follow up.</p>
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:8px 0 0;text-align:center"><a href="https://settlegrid.ai/marketplace/apis" style="color:#E5A336;text-decoration:underline">Browse APIs</a> &nbsp;&middot;&nbsp; <a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:underline">How it works</a></p>
${dividerLine()}
${outreachFooter(serviceName, recipientEmail)}
`,
      { preheader: `AI agents can already discover ${serviceName}. Set your per-call pricing.` }
    ),
  }
}

/**
 * Outreach email for agent tool creators (LangChain, CrewAI, etc.).
 * Hooks on the framework name for immediate recognition.
 * Emphasizes cross-framework discovery as unique value.
 */
export function claimAgentToolEmail(
  firstName: string,
  toolName: string,
  claimToken: string,
  _framework: string,
  recipientEmail?: string,
  toolSlug?: string
): EmailTemplate {
  const claimUrl = `https://settlegrid.ai/claim/${encodeURIComponent(claimToken)}`

  return {
    subject: sanitizeSubject(`${toolName} has a listing page`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px"><strong style="color:#1A1F3A">${escapeHtml(toolName)}</strong> already has a listing page on <a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a> — a marketplace where AI agents across any framework can discover and pay for tools per call.</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">If you claim it, you set per-call pricing and receive payouts via Stripe. You keep 95&ndash;100% of revenue. Agents handle billing through SettleGrid's payment protocol&nbsp;&mdash; no changes to your tool code. Claiming takes about 90 seconds.</p>
${ctaButton('See your listing & start earning', claimUrl)}
${toolSlug ? badgeMarkdownSection(toolSlug) : ''}
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0">Not your tool? No worries — just ignore this and we won't follow up.</p>
<p class="sg-text" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:8px 0 0;text-align:center"><a href="https://settlegrid.ai/marketplace/agent-tools" style="color:#E5A336;text-decoration:underline">Browse agent tools</a> &nbsp;&middot;&nbsp; <a href="https://settlegrid.ai/docs" style="color:#E5A336;text-decoration:underline">How it works</a></p>
${dividerLine()}
${outreachFooter(toolName, recipientEmail)}
`,
      { preheader: `AI agents can already discover ${toolName}. Claim it to set pricing.` }
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

// ── Consumer Weekly Digest ──────────────────────────────────────────────────

export interface DigestToolUsage {
  name: string
  slug: string
  invocations: number
  spendCents: number
}

export interface DigestNewTool {
  name: string
  slug: string
  category: string | null
  description: string | null
}

export function consumerWeeklyDigest(
  consumerEmail: string,
  totalInvocations: number,
  totalSpendCents: number,
  topTools: DigestToolUsage[],
  newTools: DigestNewTool[]
): EmailTemplate {
  const spendFormatted = formatCurrency(totalSpendCents)
  const invocationsFormatted = totalInvocations.toLocaleString()

  const topToolRows = topTools
    .slice(0, 5)
    .map(
      (t) =>
        `<tr>
          <td style="padding:6px 8px;font-size:13px;color:#374151;font-family:${FONT_STACK};border-bottom:1px solid #e5e7eb">
            <a href="https://settlegrid.ai/tools/${encodeURIComponent(t.slug)}" style="color:#E5A336;text-decoration:none;font-weight:600">${escapeHtml(t.name)}</a>
          </td>
          <td align="right" style="padding:6px 8px;font-size:13px;color:#374151;font-family:${FONT_STACK};border-bottom:1px solid #e5e7eb">${t.invocations.toLocaleString()}</td>
          <td align="right" style="padding:6px 8px;font-size:13px;color:#374151;font-family:${FONT_STACK};border-bottom:1px solid #e5e7eb">${formatCurrency(t.spendCents)}</td>
        </tr>`
    )
    .join('')

  const newToolsList = newTools
    .slice(0, 5)
    .map(
      (t) =>
        `<li style="margin:0 0 8px;color:#4b5563;font-size:13px;font-family:${FONT_STACK}">
          <a href="https://settlegrid.ai/tools/${encodeURIComponent(t.slug)}" style="color:#E5A336;text-decoration:none;font-weight:600">${escapeHtml(t.name)}</a>
          ${t.category ? `<span style="color:#9ca3af"> &middot; ${escapeHtml(t.category)}</span>` : ''}
          ${t.description ? `<br/><span style="color:#6b7280;font-size:12px">${escapeHtml(t.description.slice(0, 120))}${t.description.length > 120 ? '...' : ''}</span>` : ''}
        </li>`
    )
    .join('')

  return {
    subject: sanitizeSubject(`Your week on SettleGrid: ${invocationsFormatted} invocations`),
    html: baseEmailTemplate(
      `
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">Here is your weekly usage summary.</p>

<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr>
      <td style="padding:4px 0;font-size:14px;color:#374151;font-family:${FONT_STACK}">Total invocations</td>
      <td align="right" style="padding:4px 0;font-size:14px;font-weight:700;color:#1A1F3A;font-family:${FONT_STACK}">${invocationsFormatted}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:14px;color:#374151;font-family:${FONT_STACK}">Total spend</td>
      <td align="right" style="padding:4px 0;font-size:14px;font-weight:700;color:#1A1F3A;font-family:${FONT_STACK}">${spendFormatted}</td>
    </tr>
  </table>
</div>

${topTools.length > 0 ? `
<p class="sg-text" style="color:#374151;font-size:14px;font-weight:600;margin:0 0 8px">Your top tools this week</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
  <tr>
    <th align="left" style="padding:6px 8px;font-size:11px;color:#9ca3af;font-family:${FONT_STACK};border-bottom:2px solid #e5e7eb;text-transform:uppercase">Tool</th>
    <th align="right" style="padding:6px 8px;font-size:11px;color:#9ca3af;font-family:${FONT_STACK};border-bottom:2px solid #e5e7eb;text-transform:uppercase">Calls</th>
    <th align="right" style="padding:6px 8px;font-size:11px;color:#9ca3af;font-family:${FONT_STACK};border-bottom:2px solid #e5e7eb;text-transform:uppercase">Spend</th>
  </tr>
  ${topToolRows}
</table>
` : ''}

${newTools.length > 0 ? `
<p class="sg-text" style="color:#374151;font-size:14px;font-weight:600;margin:0 0 8px">New tools you might like</p>
<ul style="padding-left:20px;margin:0 0 16px">
  ${newToolsList}
</ul>
` : ''}

${ctaButton('Explore the marketplace', 'https://settlegrid.ai/marketplace')}
${dividerLine()}
<p style="color:#9ca3af;font-size:11px;line-height:1.5;margin:8px 0 0;text-align:center;font-family:${FONT_STACK}">
  You are receiving this because you used tools on SettleGrid this week.
  <a href="https://settlegrid.ai/unsubscribe?email=${encodeURIComponent(consumerEmail)}&type=consumer-digest" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
</p>
`,
      { preheader: `${invocationsFormatted} invocations, ${spendFormatted} spent this week on SettleGrid.` }
    ),
  }
}

// ── Ecosystem Newsletter ──────────────────────────────────────────────────

export interface EcosystemNewsletterData {
  npmDownloads: number | null
  githubStars: number | null
  newToolsCount: number
  totalActiveTools: number
  trendingCategories: string[]
  highlightTools: Array<{ name: string; slug: string; description: string }>
  recipientEmail: string
}

export function ecosystemNewsletterEmail(data: EcosystemNewsletterData): EmailTemplate {
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const statsHtml = [
    data.npmDownloads !== null
      ? `<td align="center" style="padding:8px 12px"><div style="font-size:20px;font-weight:700;color:#E5A336;font-family:${FONT_STACK}">${data.npmDownloads.toLocaleString()}</div><div style="font-size:11px;color:#9ca3af;font-family:${FONT_STACK}">npm downloads/week</div></td>`
      : '',
    data.githubStars !== null
      ? `<td align="center" style="padding:8px 12px"><div style="font-size:20px;font-weight:700;color:#E5A336;font-family:${FONT_STACK}">${data.githubStars.toLocaleString()}</div><div style="font-size:11px;color:#9ca3af;font-family:${FONT_STACK}">GitHub stars</div></td>`
      : '',
    `<td align="center" style="padding:8px 12px"><div style="font-size:20px;font-weight:700;color:#E5A336;font-family:${FONT_STACK}">${data.totalActiveTools.toLocaleString()}</div><div style="font-size:11px;color:#9ca3af;font-family:${FONT_STACK}">active tools</div></td>`,
    `<td align="center" style="padding:8px 12px"><div style="font-size:20px;font-weight:700;color:#E5A336;font-family:${FONT_STACK}">+${data.newToolsCount}</div><div style="font-size:11px;color:#9ca3af;font-family:${FONT_STACK}">new this month</div></td>`,
  ]
    .filter(Boolean)
    .join('')

  const toolsListHtml = data.highlightTools.length > 0
    ? `<p class="sg-text" style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 8px;font-family:${FONT_STACK}">Notable new tools</p>
<ul style="padding-left:20px;margin:0 0 16px">${data.highlightTools
        .slice(0, 5)
        .map(
          (t) =>
            `<li style="margin-bottom:6px;font-size:13px;color:#374151;font-family:${FONT_STACK}"><a href="https://settlegrid.ai/tools/${escapeHtml(t.slug)}" style="color:#E5A336;text-decoration:none;font-weight:600">${escapeHtml(t.name)}</a> &mdash; ${escapeHtml(t.description.slice(0, 100))}</li>`,
        )
        .join('')}</ul>`
    : ''

  const categoriesHtml = data.trendingCategories.length > 0
    ? `<p class="sg-text" style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 8px;font-family:${FONT_STACK}">Trending categories</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 16px;font-family:${FONT_STACK}">${data.trendingCategories.map((c) => escapeHtml(c)).join(', ')}</p>`
    : ''

  return {
    subject: `State of AI Tools - ${month} | SettleGrid`,
    html: baseEmailTemplate(
      `
<h2 class="sg-heading" style="color:#1A1F3A;font-size:20px;font-weight:700;margin:0 0 8px;font-family:${FONT_STACK}">State of AI Tools - ${escapeHtml(month)}</h2>
<p class="sg-text" style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;font-family:${FONT_STACK}">
  Here is what happened in the AI tools ecosystem this month.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;background:#f9fafb;border-radius:8px">
  <tr>${statsHtml}</tr>
</table>

${toolsListHtml}
${categoriesHtml}

${ctaButton('Explore the marketplace', 'https://settlegrid.ai/marketplace')}
${dividerLine()}
<p style="color:#9ca3af;font-size:11px;line-height:1.5;margin:8px 0 0;text-align:center;font-family:${FONT_STACK}">
  You are receiving this because you subscribed to the SettleGrid newsletter.
  <a href="https://settlegrid.ai/api/newsletter/unsubscribe?email=${encodeURIComponent(data.recipientEmail)}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
</p>
`,
      { preheader: `${data.totalActiveTools} tools, +${data.newToolsCount} new this month on SettleGrid.` },
    ),
  }
}
