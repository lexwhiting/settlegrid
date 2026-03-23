import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { developers, consumers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { welcomeDeveloperEmail, welcomeConsumerEmail, sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
      logger.error('auth.exchange_failed', { error: error?.message })
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const user = data.user
    const email = user.email ?? ''
    const name =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      null

    // Ensure developer record exists
    let developerId: string | undefined
    try {
      const [existing] = await db
        .select({ id: developers.id })
        .from(developers)
        .where(eq(developers.supabaseUserId, user.id))
        .limit(1)

      if (!existing) {
        const [byEmail] = await db
          .select({ id: developers.id })
          .from(developers)
          .where(eq(developers.email, email))
          .limit(1)

        if (byEmail) {
          developerId = byEmail.id
          await db
            .update(developers)
            .set({ supabaseUserId: user.id, updatedAt: new Date() })
            .where(eq(developers.email, email))
        } else {
          const [inserted] = await db.insert(developers).values({
            email,
            name,
            supabaseUserId: user.id,
            updatedAt: new Date(),
          }).returning({ id: developers.id })

          developerId = inserted?.id

          const displayName = name ?? email
          const template = welcomeDeveloperEmail(displayName)
          sendEmail({ to: email, subject: template.subject, html: template.html }).catch((err) => {
            logger.error('auth.welcome_email_failed', { email }, err)
          })
        }
      } else {
        developerId = existing.id
      }

      if (developerId) {
        writeAuditLog({
          developerId,
          action: 'auth.login',
          resourceType: 'session',
          details: { provider: user.app_metadata?.provider ?? 'email', email: user.email },
          ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
          userAgent: request.headers.get('user-agent') ?? undefined,
        }).catch(() => {/* fire-and-forget */})
      }
    } catch (dbErr) {
      logger.error('auth.developer_record_failed', { email, userId: user.id }, dbErr as Error)
      // Don't block login — the developer record can be created later
    }

    // Ensure consumer record exists
    try {
      const [existingConsumer] = await db
        .select({ id: consumers.id })
        .from(consumers)
        .where(eq(consumers.supabaseUserId, user.id))
        .limit(1)

      if (!existingConsumer) {
        const [byConsumerEmail] = await db
          .select({ id: consumers.id })
          .from(consumers)
          .where(eq(consumers.email, email))
          .limit(1)

        if (byConsumerEmail) {
          await db
            .update(consumers)
            .set({ supabaseUserId: user.id })
            .where(eq(consumers.email, email))
        } else {
          await db.insert(consumers).values({
            email,
            supabaseUserId: user.id,
          })

          const consumerTemplate = welcomeConsumerEmail(email)
          sendEmail({ to: email, subject: consumerTemplate.subject, html: consumerTemplate.html }).catch((err) => {
            logger.error('auth.welcome_consumer_email_failed', { email }, err)
          })
        }
      }
    } catch (dbErr) {
      logger.error('auth.consumer_record_failed', { email, userId: user.id }, dbErr as Error)
      // Don't block login
    }

    return response
  } catch (err) {
    logger.error('auth.callback_failed', {}, err as Error)
    return NextResponse.redirect(`${origin}/login?error=server_error`)
  }
}
