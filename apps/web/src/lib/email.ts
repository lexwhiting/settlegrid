/**
 * Email templates for SettleGrid using Resend
 */

interface EmailTemplate {
  subject: string
  html: string
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Outfit',system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="text-align:center;margin-bottom:24px">
<div style="display:inline-block;font-size:22px;letter-spacing:-0.5px"><span style="font-weight:700;color:#1A1F3A">Settle</span><span style="font-weight:400;color:#10B981">Grid</span></div>
</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
${content}
</div>
<div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px">
<p>&copy; ${new Date().getFullYear()} SettleGrid. All rights reserved.</p>
<p><a href="https://settlegrid.ai" style="color:#10B981;text-decoration:none">settlegrid.ai</a></p>
</div>
</div>
</body>
</html>`
}

export function welcomeDeveloperEmail(name: string): EmailTemplate {
  return {
    subject: 'Welcome to SettleGrid — Start monetizing your tools',
    html: baseTemplate(`
<h2 style="color:#1A1F3A;margin:0 0 16px">Welcome, ${escapeHtml(name)}!</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">You're all set to start monetizing your MCP tools with per-call billing.</p>
<h3 style="color:#1A1F3A;margin:24px 0 8px">Next steps:</h3>
<ol style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Connect your Stripe account to receive payouts</li>
<li>Create your first tool in the dashboard</li>
<li>Install the <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">@settlegrid/mcp</code> SDK</li>
<li>Wrap your handler and go live</li>
</ol>
<div style="text-align:center;margin:24px 0">
<a href="https://settlegrid.ai/dashboard" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Go to Dashboard</a>
</div>
`),
  }
}

export function stripeConnectCompleteEmail(name: string): EmailTemplate {
  return {
    subject: 'Stripe Connect is active — You can now receive payouts',
    html: baseTemplate(`
<h2 style="color:#1A1F3A;margin:0 0 16px">Stripe Connect Active</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Great news, ${escapeHtml(name)}! Your Stripe Connect account is now active. You'll receive payouts automatically based on your payout schedule.</p>
<ul style="color:#4b5563;line-height:1.8;padding-left:20px">
<li>Revenue split: You keep 80%</li>
<li>Minimum payout: $25.00</li>
<li>Schedule: Based on your settings (weekly or monthly)</li>
</ul>
`),
  }
}

export function payoutNotificationEmail(name: string, amountCents: number): EmailTemplate {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)
  return {
    subject: `Payout of ${formatted} has been initiated`,
    html: baseTemplate(`
<h2 style="color:#1A1F3A;margin:0 0 16px">Payout Initiated</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)}, a payout of <strong style="color:#10B981">${formatted}</strong> has been initiated to your connected Stripe account.</p>
<p style="color:#4b5563;line-height:1.6">Funds typically arrive within 2-7 business days depending on your bank.</p>
<div style="text-align:center;margin:24px 0">
<a href="https://settlegrid.ai/dashboard/payouts" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View Payouts</a>
</div>
`),
  }
}

export function lowBalanceAlertEmail(email: string, toolName: string, balanceCents: number): EmailTemplate {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balanceCents / 100)
  return {
    subject: `Low balance alert: ${toolName} — ${formatted} remaining`,
    html: baseTemplate(`
<h2 style="color:#1A1F3A;margin:0 0 16px">Low Credit Balance</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your credit balance for <strong>${escapeHtml(toolName)}</strong> is running low at <strong style="color:#ef4444">${formatted}</strong>.</p>
<p style="color:#4b5563;line-height:1.6">Add credits to avoid service interruption.</p>
<div style="text-align:center;margin:24px 0">
<a href="https://settlegrid.ai/consumer" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Add Credits</a>
</div>
<p style="color:#9ca3af;font-size:12px">Tip: Enable auto-refill to automatically top up when your balance gets low.</p>
`),
  }
}

export function creditPurchaseConfirmationEmail(email: string, amountCents: number, toolName: string): EmailTemplate {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)
  return {
    subject: `Credit purchase confirmed: ${formatted} for ${toolName}`,
    html: baseTemplate(`
<h2 style="color:#1A1F3A;margin:0 0 16px">Purchase Confirmed</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Your purchase of <strong style="color:#10B981">${formatted}</strong> in credits for <strong>${escapeHtml(toolName)}</strong> has been confirmed.</p>
<p style="color:#4b5563;line-height:1.6">Credits have been added to your balance and are available immediately.</p>
<div style="text-align:center;margin:24px 0">
<a href="https://settlegrid.ai/consumer" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View Balance</a>
</div>
`),
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
