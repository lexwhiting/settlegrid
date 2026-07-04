import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
  ParseBodyError,
} from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { normalizeEmail, suppressBestEffort } from '@/lib/email-suppression'
import { z } from 'zod'

// Runtime pin: writes to Postgres (consumers, email_suppressions) — Node, not edge.
export const runtime = 'nodejs'
export const maxDuration = 15

const unsubscribeSchema = z.object({
  email: z.string().email().max(320),
})

/**
 * Persist a newsletter opt-out.
 *
 * DURABLE FALLBACK FIRST (FOLD #4): flip `consumers.newsletter_subscribed`
 * false — the audience flag the newsletter cron's SQL filter reads — so the
 * opt-out sticks even before email_suppressions exists (deploy window). The
 * match is CASE-INSENSITIVE because consumers.email is stored trimmed but NOT
 * lowercased (ensure-twin: `email.trim()`), so an exact lowercased match would
 * silently miss a mixed-case row (DECISION-1 seam). THEN mirror into the
 * canonical table best-effort (never throws / 500s the click).
 */
async function persistNewsletterUnsub(email: string, source: 'link' | 'list-unsub-post') {
  await db
    .update(consumers)
    .set({ newsletterSubscribed: false })
    .where(sql`lower(${consumers.email}) = ${email}`)
  await suppressBestEffort(email, 'newsletter', 'unsubscribe', source)
}

function validEmail(email: string): boolean {
  return !!email && email.includes('@') && email.length <= 254
}

/**
 * GET /api/newsletter/unsubscribe?email=... — the visible footer link + the
 * List-Unsubscribe header target (a GET click). Persists the opt-out and
 * returns a friendly branded confirmation page (fixes the G6-1 405).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `newsletter-unsubscribe:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const email = normalizeEmail(request.nextUrl.searchParams.get('email') ?? '')
    if (!validEmail(email)) {
      return new NextResponse(confirmationHtml(false), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    await persistNewsletterUnsub(email, 'link')
    logger.info('newsletter.unsubscribed', { email: email.slice(0, 3) + '***', source: 'link' })
    return new NextResponse(confirmationHtml(true), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * POST /api/newsletter/unsubscribe — the RFC-8058 one-click target AND the
 * legacy JSON API. The mailbox provider POSTs `List-Unsubscribe=One-Click` as
 * application/x-www-form-urlencoded with the address in the URL QUERY — so
 * read the query FIRST and do NOT route that through the JSON parseBody (which
 * would 400 on the form body — FOLD #8). A no-query POST is the legacy JSON
 * caller and keeps working.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `newsletter-unsubscribe:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const queryEmail = request.nextUrl.searchParams.get('email')
    let rawEmail: string
    let source: 'link' | 'list-unsub-post'

    if (queryEmail) {
      // One-click (RFC-8058) / query-carried address — never touch the body.
      rawEmail = queryEmail
      source = 'list-unsub-post'
    } else {
      let parsed: z.infer<typeof unsubscribeSchema>
      try {
        parsed = await parseBody(request, unsubscribeSchema)
      } catch (err) {
        if (err instanceof ParseBodyError) {
          return errorResponse(err.message, err.statusCode, 'VALIDATION_ERROR')
        }
        return errorResponse('Invalid request body.', 400, 'VALIDATION_ERROR')
      }
      rawEmail = parsed.email
      source = 'link'
    }

    const email = normalizeEmail(rawEmail)
    if (!validEmail(email)) {
      return errorResponse('Invalid email address.', 400, 'INVALID_EMAIL')
    }

    await persistNewsletterUnsub(email, source)
    logger.info('newsletter.unsubscribed', { email: email.slice(0, 3) + '***', source })
    return successResponse({ message: 'Unsubscribed.', subscribed: false })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

function confirmationHtml(ok: boolean): string {
  const heading = ok ? "You've been unsubscribed" : 'Unsubscribe'
  const body = ok
    ? "You won't receive the SettleGrid ecosystem newsletter anymore."
    : 'If you received the SettleGrid newsletter and would like to unsubscribe, please use the unsubscribe link in that email, or contact support@settlegrid.ai.'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SettleGrid — Unsubscribe</title></head>
<body style="margin:0;background:#1A1F3A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;text-align:center">
<div style="margin-bottom:24px;font-size:20px;font-weight:700"><span style="color:#e5e7eb">Settle</span><span style="color:#E5A336">Grid</span></div>
<h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#f9fafb">${heading}</h1>
<p style="font-size:15px;line-height:1.6;color:#9ca3af;margin:0 0 24px">${body}</p>
<p style="font-size:13px;margin:0"><a href="https://settlegrid.ai" style="color:#E5A336;text-decoration:underline">settlegrid.ai</a></p>
</div></div></body></html>`
}
