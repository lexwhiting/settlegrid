import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, consumers } from '@/lib/db/schema'
import { newSignupNotificationEmail, sendEmail } from '@/lib/email'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/**
 * POST /api/auth/signup-notify
 *
 * Receives a Supabase auth webhook payload when a new user signs up.
 * Determines if the user is a developer or consumer (or both) and sends
 * a notification email to the admin emails.
 *
 * Supabase webhook payload shape:
 * {
 *   "type": "INSERT",
 *   "table": "users",
 *   "record": { "id": "...", "email": "...", "created_at": "...", "raw_user_meta_data": { "name": "..." } },
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `signup-notify:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let body: Record<string, unknown>
    try {
      body = await request.json() as Record<string, unknown>
    } catch {
      return errorResponse('Invalid JSON body.', 400, 'INVALID_BODY')
    }

    // Extract user data from Supabase webhook payload
    const record = (body.record ?? body) as Record<string, unknown>
    const email = (record.email as string) ?? ''
    const createdAt = (record.created_at as string) ?? new Date().toISOString()
    const metadata = (record.raw_user_meta_data ?? record.user_metadata ?? {}) as Record<string, unknown>
    const name = (metadata.full_name ?? metadata.name ?? null) as string | null

    if (!email) {
      return errorResponse('Missing email in webhook payload.', 400, 'MISSING_EMAIL')
    }

    // Determine user type by checking which table contains the email
    let type: 'developer' | 'consumer' = 'developer'

    const [dev] = await db
      .select({ id: developers.id })
      .from(developers)
      .where(eq(developers.email, email))
      .limit(1)

    if (!dev) {
      const [con] = await db
        .select({ id: consumers.id })
        .from(consumers)
        .where(eq(consumers.email, email))
        .limit(1)

      if (con) {
        type = 'consumer'
      }
      // If neither exists yet, default to 'developer' (the record may not have
      // been inserted yet depending on webhook timing)
    }

    // Send notification to all admin emails
    const template = newSignupNotificationEmail(type, email, name, createdAt)
    const results = await Promise.all(
      ADMIN_EMAILS.map((adminEmail) =>
        sendEmail({
          to: adminEmail,
          subject: template.subject,
          html: template.html,
        })
      )
    )

    const allSent = results.every(Boolean)
    logger.info('signup_notify.sent', { email, type, allSent })

    return successResponse({ ok: true, notified: ADMIN_EMAILS.length })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
