/**
 * POST /api/consumer/academic — claim the $500 academic credit.
 *
 * G3-1 hardening: the grant is keyed on the AUTHENTICATED + email-VERIFIED
 * Supabase session (never a body-supplied email — that was the $500 hole), is
 * gated to an academic institution email (real second-level-label match, not a
 * substring), and is minted EXACTLY ONCE per consumer via a conditional atomic
 * UPDATE (WHERE academic_granted_at IS NULL). `body.email` is ignored for
 * eligibility; institutionName is logged, useCase is accepted for form-compat
 * (neither affects eligibility or the grant).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { createRateLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

// ── Constants ────────────────────────────────────────────────────────────────

/** Credits granted to academic accounts (in cents): $500 */
const ACADEMIC_CREDIT_CENTS = 50_000

/** Rate limit: 3 academic claims per day per IP (pre-auth DoS guard) */
const academicLimiter = createRateLimiter(3, '1 d')

/** Rate limit: 2 academic claims per day per authenticated consumer */
const academicUserLimiter = createRateLimiter(2, '1 d')

// ── Validation ───────────────────────────────────────────────────────────────

/** Academic domain suffixes recognized worldwide (matched with endsWith). */
const ACADEMIC_SUFFIXES = [
  // Direct .edu (US)
  '.edu',
  // Country-code .edu variants
  '.edu.au', '.edu.cn', '.edu.br', '.edu.mx', '.edu.co', '.edu.ar',
  '.edu.in', '.edu.sg', '.edu.hk', '.edu.tw', '.edu.my', '.edu.pk',
  '.edu.ph', '.edu.ng', '.edu.gh', '.edu.eg', '.edu.za', '.edu.tr',
  '.edu.pl', '.edu.pe', '.edu.ve', '.edu.ec', '.edu.uy', '.edu.do',
  '.edu.gt', '.edu.hn', '.edu.sv', '.edu.ni', '.edu.bo', '.edu.py',
  '.edu.sa', '.edu.kw', '.edu.qa', '.edu.om', '.edu.bh', '.edu.lb',
  '.edu.jo', '.edu.vn', '.edu.kh', '.edu.mm',
  // .ac.* domains (UK, Japan, Korea, NZ, South Africa, Israel, Thailand, etc.)
  '.ac.uk', '.ac.jp', '.ac.kr', '.ac.nz', '.ac.za', '.ac.il', '.ac.th',
  '.ac.in', '.ac.at', '.ac.be', '.ac.id', '.ac.ir', '.ac.ke', '.ac.tz',
  '.ac.ug', '.ac.rw', '.ac.bd', '.ac.lk', '.ac.cy', '.ac.cr', '.ac.fj',
] as const

/**
 * European university domains: the SECOND-LEVEL label starts with one of these
 * (e.g. uni-heidelberg.de, stud.uni-muenchen.de, univ-paris.fr). Testing the
 * SLD — NOT "any label, and NOT a substring" — admits those while REJECTING
 * both x@myuni-hack.com (substring) and x@uni-hack.attacker.com (a non-SLD
 * label). Plain TS, no PSL dependency.
 *
 * ACCEPTED RESIDUAL (founder-decided; fast-follow = a curated allowlist): this
 * admits ANY `uni-*`/`univ-*` SLD in ANY TLD (uni-grant.com, univ-x.io), not
 * only academic ccTLDs. An attacker can register a ~$10 uni-* domain, confirm a
 * mailbox on it, and claim $500 — the "honest MINIMUM" reduces free-unauth abuse
 * to authed+audit-trailed per grant; it does not eliminate domain-purchase Sybil.
 */
const ACADEMIC_SLD_PREFIXES = ['uni-', 'univ-'] as const

/**
 * Validates that an email address belongs to an academic institution.
 * Runs on the VERIFIED SESSION email, never on a body-supplied address.
 */
function isAcademicEmail(email: string): boolean {
  // Require exactly one '@' — a malformed `a@harvard.edu@evil.com` must not have
  // its middle token treated as the (eligible) domain while mail routes to evil.com.
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const domain = parts[1]?.toLowerCase()
  if (!domain) return false

  for (const suffix of ACADEMIC_SUFFIXES) {
    if (domain.endsWith(suffix)) return true
  }

  const labels = domain.split('.')
  if (labels.length >= 2) {
    const sld = labels[labels.length - 2]
    if (ACADEMIC_SLD_PREFIXES.some((p) => sld.startsWith(p))) return true
  }

  return false
}

const academicSchema = z.object({
  // Kept for form compatibility + logging. IGNORED for eligibility — the
  // eligible email is the verified session email, not this field.
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
    const ip = getClientIp(request.headers)

    // Pre-auth IP rate limit (cheap DoS guard).
    const rl = await checkRateLimit(academicLimiter, `academic:${ip}`)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Require an authenticated + email-VERIFIED consumer session. Eligibility
    // is keyed on `auth.verifiedEmail` (the live confirmed session email),
    // NEVER a body field — that was the unauthenticated $500 hole.
    let auth
    try {
      auth = await requireConsumer(request, { requireEmailVerified: true })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Authentication required. Please sign in.' },
        { status: 401 }
      )
    }

    // Per-consumer rate limit.
    const userRl = await checkRateLimit(academicUserLimiter, `academic:uid:${auth.id}`)
    if (!userRl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Parse body (institutionName/useCase are metadata; email is ignored).
    let body: z.infer<typeof academicSchema>
    try {
      const raw = await request.json()
      body = academicSchema.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Please provide a valid institution name.' },
        { status: 400 }
      )
    }

    // Eligibility runs on the VERIFIED session email.
    if (!isAcademicEmail(auth.verifiedEmail)) {
      return NextResponse.json(
        {
          error: 'Academic email required. Sign in with your .edu or institutional email address to claim.',
          code: 'NON_ACADEMIC_EMAIL',
        },
        { status: 422 }
      )
    }

    // Defense-in-depth tripwire, evaluated at GRANT time (an academic-eligible
    // session about to mint): if the Supabase project auto-confirms email
    // (Confirm-email DISABLED), `email_confirmed_at` proves NO mailbox control
    // and the whole verify gate is toothless — a $500 mint to anyone@harvard.edu.
    // Fail CLOSED (do not silently grant) + loud money_loss alert. The operator
    // §P item "Confirm email = REQUIRED" is the real fix; this is the tripwire.
    if (auth.emailAutoConfirmSuspected) {
      logger.error('academic.autoconfirm_blocked', {
        money_loss: true,
        consumerId: auth.id,
        verifiedEmail: auth.verifiedEmail,
        message: 'email_confirmed_at === created_at (auto-confirm signature); refusing academic grant. Verify Supabase "Confirm email = REQUIRED".',
      })
      return NextResponse.json(
        { error: 'Academic verification is temporarily unavailable. Please contact support.', code: 'EMAIL_VERIFICATION_UNAVAILABLE' },
        { status: 403 }
      )
    }

    // Atomic, idempotent grant: credit + set the marker in ONE conditional
    // UPDATE on the authed consumer's own row. Under PG READ COMMITTED this is
    // exactly-once — a concurrent second claim re-evaluates the WHERE against
    // the committed row and matches 0 rows (no double-grant, no SELECT FOR
    // UPDATE needed). length === 1 ⇒ granted; length === 0 ⇒ already granted.
    const granted = await db
      .update(consumers)
      .set({
        globalBalanceCents: sql`${consumers.globalBalanceCents} + ${ACADEMIC_CREDIT_CENTS}`,
        academicGrantedAt: sql`now()`,
      })
      .where(and(eq(consumers.id, auth.id), isNull(consumers.academicGrantedAt)))
      .returning({ id: consumers.id })

    if (granted.length !== 1) {
      // Already granted — idempotent success, NO re-credit.
      logger.info('academic.already_granted', { consumerId: auth.id })
      return NextResponse.json({
        success: true,
        message: 'Your academic credit is already active.',
      })
    }

    logger.info('academic.granted', {
      consumerId: auth.id,
      verifiedEmail: auth.verifiedEmail,
      institutionName: body.institutionName,
      creditCents: ACADEMIC_CREDIT_CENTS,
    })

    // Welcome email: OUTSIDE any transaction, ONLY on a fresh grant, non-fatal
    // (an email-provider outage must not undo a correct grant), to the VERIFIED
    // SESSION email (never body.email — that would let an authed user make
    // SettleGrid email an arbitrary address).
    try {
      const template = academicWelcomeEmail(auth.verifiedEmail, body.institutionName)
      await sendEmail({
        to: auth.verifiedEmail,
        subject: template.subject,
        html: template.html,
      })
    } catch (emailErr) {
      logger.error('academic.welcome_email_failed', { consumerId: auth.id }, emailErr)
    }

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
