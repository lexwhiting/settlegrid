import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getResendApiKey } from '@/lib/env'
import { sanitizeSubject } from '@/lib/email'
import { logger } from '@/lib/logger'

export const maxDuration = 10

const supportSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(320),
  subject: z.string().min(1, 'Subject is required').max(300),
  message: z.string().min(1, 'Message is required').max(5000),
  pageUrl: z.string().max(500).optional(),
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `support:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(req, supportSchema)

    let resendApiKey: string | null = null
    try {
      resendApiKey = getResendApiKey()
    } catch {
      // Resend not configured — log and return success anyway
    }

    if (resendApiKey) {
      // Send support email to team
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SettleGrid Support <support@settlegrid.ai>',
          to: ['support@settlegrid.ai'],
          subject: sanitizeSubject(`[Support] ${body.subject}`),
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:'Outfit',system-ui,sans-serif;background:#f9fafb">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
<h2 style="color:#1A1F3A;margin:0 0 16px">New Support Request</h2>
<p style="color:#4b5563"><strong>From:</strong> ${escapeHtml(body.name)} &lt;${escapeHtml(body.email)}&gt;</p>
<p style="color:#4b5563"><strong>Subject:</strong> ${escapeHtml(body.subject)}</p>
${body.pageUrl ? `<p style="color:#4b5563"><strong>Page:</strong> ${escapeHtml(body.pageUrl)}</p>` : ''}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
<div style="color:#374151;line-height:1.6;white-space:pre-wrap">${escapeHtml(body.message)}</div>
</div>
</body>
</html>`,
        }),
      })

      // Send auto-response to user
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SettleGrid Support <support@settlegrid.ai>',
          to: [body.email],
          subject: sanitizeSubject(`Re: ${body.subject} — We received your message`),
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Outfit',system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="text-align:center;margin-bottom:24px">
<div style="display:inline-block;font-size:22px;letter-spacing:-0.5px"><span style="font-weight:700;color:#1A1F3A">Settle</span><span style="font-weight:400;color:#10B981">Grid</span></div>
</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
<h2 style="color:#1A1F3A;margin:0 0 16px">We received your message</h2>
<p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(body.name)}, thanks for reaching out! We've received your support request and will get back to you within 24 hours.</p>
<p style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Your message:</strong></p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#4b5563;line-height:1.6;white-space:pre-wrap">${escapeHtml(body.message)}</div>
</div>
<div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px">
<p>&copy; ${new Date().getFullYear()} SettleGrid. All rights reserved.</p>
<p><a href="https://settlegrid.ai" style="color:#10B981;text-decoration:none">settlegrid.ai</a></p>
</div>
</div>
</body>
</html>`,
        }),
      })
    }

    logger.info('support.request_received', {
      email: body.email,
      subject: body.subject,
      pageUrl: body.pageUrl,
    })

    return successResponse({ success: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
