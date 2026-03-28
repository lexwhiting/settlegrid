/**
 * SettleGrid Service Template: Email Sender
 *
 * Wraps the Resend email API with per-email billing through SettleGrid.
 * Callers can send transactional emails without managing their own
 * email infrastructure or Resend account.
 *
 * Pricing: $0.01 per email sent (configurable)
 *
 * Usage:
 *   1. `npm install settlegrid resend`
 *   2. Set SETTLEGRID_SECRET and RESEND_API_KEY in your environment
 *   3. Configure your verified sending domain in Resend
 *   4. Deploy and register on SettleGrid dashboard
 */

import { SettleGrid } from 'settlegrid'
import { Resend } from 'resend'

// ─── Initialize ─────────────────────────────────────────────────────────────

const sg = new SettleGrid({
  secret: process.env.SETTLEGRID_SECRET!,
})

const resend = new Resend(process.env.RESEND_API_KEY!)

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max email body size to prevent abuse */
const MAX_BODY_LENGTH = 100_000

/** Allowed sender domain (configure per your Resend verified domain) */
const SENDER_DOMAIN = process.env.SENDER_DOMAIN ?? 'mail.example.com'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailRequest {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string   // Must be on the verified domain
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
}

interface EmailResponse {
  id: string
  from: string
  to: string[]
  subject: string
  sentAt: string
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleSendEmail(input: EmailRequest): Promise<EmailResponse> {
  // Validate required fields
  if (!input.to) throw new Error('to is required')
  if (!input.subject || typeof input.subject !== 'string') {
    throw new Error('subject is required')
  }
  if (!input.html && !input.text) {
    throw new Error('Either html or text body is required')
  }

  // Normalize recipients
  const recipients = Array.isArray(input.to) ? input.to : [input.to]
  if (recipients.length === 0) throw new Error('At least one recipient is required')
  if (recipients.length > 50) throw new Error('Maximum 50 recipients per request')

  // Validate body size
  const bodyLength = (input.html?.length ?? 0) + (input.text?.length ?? 0)
  if (bodyLength > MAX_BODY_LENGTH) {
    throw new Error(`Email body too large (${bodyLength} chars, max ${MAX_BODY_LENGTH})`)
  }

  // Build from address (force to verified domain)
  const fromName = input.from ?? 'noreply'
  const from = fromName.includes('@') ? fromName : `${fromName}@${SENDER_DOMAIN}`

  const result = await resend.emails.send({
    from,
    to: recipients,
    subject: input.subject.slice(0, 998), // RFC 2822 subject limit
    html: input.html,
    text: input.text,
    reply_to: input.replyTo,
    tags: input.tags?.slice(0, 10), // Resend limits tags
  })

  if (result.error) {
    throw new Error(`Email send failed: ${result.error.message}`)
  }

  return {
    id: result.data?.id ?? 'unknown',
    from,
    to: recipients,
    subject: input.subject,
    sentAt: new Date().toISOString(),
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-email, and records usage on the SettleGrid ledger.
 */
export default sg.wrap(handleSendEmail, {
  name: 'email-sender',
  pricing: {
    model: 'per-call',
    costCentsPerCall: 1, // $0.01 per email
  },
  rateLimit: {
    requests: 100,
    window: '1m',
  },
})
