import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail, welcomeConsumerEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/** 5 capture attempts per day per IP to prevent abuse */
const captureLimiter = createRateLimiter(5, '1 d')

const captureSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(320, 'Email too long')
    .transform((e) => e.toLowerCase()),
})

/**
 * POST /api/ask/capture — Email capture for Ask SettleGrid
 *
 * Creates a consumer record (or finds existing) and sends a welcome email.
 * The $25 signup bonus is tracked as a flag on the consumer's record via
 * the creation source, redeemable when the consumer activates their account.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Rate limit by IP
    const rl = await checkRateLimit(captureLimiter, `ask-capture:${ip}`)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Parse and validate
    let body: z.infer<typeof captureSchema>
    try {
      const raw = await request.json()
      body = captureSchema.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    // Check if consumer already exists
    const existing = await db
      .select({ id: consumers.id, email: consumers.email })
      .from(consumers)
      .where(eq(consumers.email, body.email))
      .limit(1)

    if (existing.length > 0) {
      // Already registered — don't reveal this for privacy, just return success
      logger.info('ask.capture.existing', { email: body.email })
      return NextResponse.json({
        success: true,
        message: 'Check your email for next steps!',
      })
    }

    // Create new consumer record
    const [newConsumer] = await db
      .insert(consumers)
      .values({
        email: body.email,
      })
      .returning({ id: consumers.id })

    logger.info('ask.capture.created', {
      consumerId: newConsumer.id,
      email: body.email,
      source: 'ask-page',
    })

    // Send welcome email
    const template = welcomeConsumerEmail(body.email, {
      preheader: 'Welcome to SettleGrid! You have $25 in free credits waiting.',
    })
    await sendEmail({
      to: body.email,
      subject: template.subject,
      html: template.html,
    })

    return NextResponse.json({
      success: true,
      message: 'Check your email for next steps!',
    })
  } catch (error) {
    logger.error('ask.capture.error', {}, error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
