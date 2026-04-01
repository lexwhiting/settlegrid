/**
 * POST /api/consumer/academic — Submit an academic verification request.
 *
 * Validates .edu email domain, creates a consumer with the academic tier,
 * provisions $500 in global credits, and sends a welcome email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

// ── Constants ────────────────────────────────────────────────────────────────

/** Credits granted to academic accounts (in cents): $500 */
const ACADEMIC_CREDIT_CENTS = 50_000

/** Rate limit: 3 academic signups per day per IP */
const academicLimiter = createRateLimiter(3, '1 d')

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates that an email address belongs to an academic institution.
 * Checks for .edu TLD and common international academic domains.
 */
function isAcademicEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  // Direct .edu domain
  if (domain.endsWith('.edu')) return true
  // Country-code .edu variants
  if (domain.endsWith('.edu.au')) return true
  if (domain.endsWith('.edu.cn')) return true
  if (domain.endsWith('.edu.br')) return true
  if (domain.endsWith('.edu.mx')) return true
  if (domain.endsWith('.edu.co')) return true
  if (domain.endsWith('.edu.ar')) return true
  if (domain.endsWith('.edu.in')) return true
  // UK academic domain
  if (domain.endsWith('.ac.uk')) return true
  // European academic domains
  if (domain.endsWith('.ac.jp')) return true
  if (domain.endsWith('.ac.kr')) return true
  if (domain.endsWith('.ac.nz')) return true
  if (domain.endsWith('.ac.za')) return true
  return false
}

const academicSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(320, 'Email too long')
    .transform((e) => e.toLowerCase()),
  institutionName: z
    .string()
    .trim()
    .min(2, 'Institution name is required')
    .max(200, 'Institution name too long'),
  useCase: z
    .string()
    .trim()
    .max(1000, 'Use case description too long')
    .optional(),
})

// ── Academic Welcome Email ───────────────────────────────────────────────────

function academicWelcomeEmail(email: string, institutionName: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to SettleGrid Academic Program',
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1F3A">
        <div style="padding:32px 24px;background:linear-gradient(135deg,#1A1F3A,#2A2D4E);border-radius:12px 12px 0 0">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Welcome to SettleGrid Academic</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">${institutionName}</p>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;line-height:1.6;color:#374151">
            Your academic account has been activated with <strong>$500 in free credits</strong>
            and Scale-tier features.
          </p>
          <div style="margin:20px 0;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px">
            <p style="margin:0;font-size:14px;color:#166534;font-weight:600">Your Academic Benefits:</p>
            <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#166534">
              <li>$500 in global credits (no expiration)</li>
              <li>Scale-tier features (advanced analytics, data export, audit logs)</li>
              <li>500,000 operations per month</li>
              <li>90-day log retention</li>
              <li>Access to all marketplace tools</li>
            </ul>
          </div>
          <p style="font-size:14px;line-height:1.6;color:#6b7280">
            Start exploring AI tools at
            <a href="https://settlegrid.ai/tools" style="color:#06B6D4;text-decoration:none">settlegrid.ai/tools</a>
            or use Ask SettleGrid to find the right tool for your research.
          </p>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
            <p style="margin:0">SettleGrid Academic Program &mdash; ${email}</p>
          </div>
        </div>
      </div>
    `,
  }
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Rate limit
    const rl = await checkRateLimit(academicLimiter, `academic:${ip}`)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Parse body
    let body: z.infer<typeof academicSchema>
    try {
      const raw = await request.json()
      body = academicSchema.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Please provide a valid .edu email and institution name.' },
        { status: 400 }
      )
    }

    // Validate academic email
    if (!isAcademicEmail(body.email)) {
      return NextResponse.json(
        {
          error: 'Academic email required. Please use your .edu or institutional email address.',
          code: 'NON_ACADEMIC_EMAIL',
        },
        { status: 422 }
      )
    }

    // Check if consumer already exists
    const existing = await db
      .select({ id: consumers.id, globalBalanceCents: consumers.globalBalanceCents })
      .from(consumers)
      .where(eq(consumers.email, body.email))
      .limit(1)

    if (existing.length > 0) {
      // Already registered — don't reveal details, return success
      logger.info('academic.existing_consumer', { email: body.email })
      return NextResponse.json({
        success: true,
        message: 'If this email is eligible, you will receive a confirmation shortly.',
      })
    }

    // Create consumer with academic credits
    const [newConsumer] = await db
      .insert(consumers)
      .values({
        email: body.email,
        globalBalanceCents: ACADEMIC_CREDIT_CENTS,
      })
      .returning({ id: consumers.id })

    logger.info('academic.signup', {
      consumerId: newConsumer.id,
      email: body.email,
      institutionName: body.institutionName,
      creditCents: ACADEMIC_CREDIT_CENTS,
    })

    // Send welcome email
    const template = academicWelcomeEmail(body.email, body.institutionName)
    await sendEmail({
      to: body.email,
      subject: template.subject,
      html: template.html,
    })

    return NextResponse.json({
      success: true,
      message: 'Academic account activated! Check your email for details.',
      creditAmount: '$500',
    })
  } catch (error) {
    logger.error('academic.signup_error', {}, error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
