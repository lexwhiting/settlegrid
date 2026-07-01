import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, consumers } from '@/lib/db/schema'

export interface AuthenticatedDeveloper {
  id: string
  email: string
}

export interface AuthenticatedConsumer {
  id: string
  email: string
}

/**
 * Returned by `requireConsumer(request, { requireEmailVerified: true })`.
 * Additive over AuthenticatedConsumer — only the email-verified opt-in yields it.
 */
export interface VerifiedAuthenticatedConsumer extends AuthenticatedConsumer {
  /**
   * The LIVE, currently-confirmed email from the Supabase session (getUser),
   * NOT the DB `consumers.email` (which is set at creation and never updated on
   * a Supabase email change → it drifts). Eligibility checks (e.g. academic
   * suffix matching) MUST key on this, never on `.email`.
   */
  verifiedEmail: string
  /**
   * True when `email_confirmed_at === created_at` — the Supabase auto-confirm
   * signature (Confirm-email DISABLED). When set, `email_confirmed_at` proves
   * NO mailbox control; a money grant MUST NOT silently proceed (fail-closed +
   * alert at the call site).
   */
  emailAutoConfirmSuspected: boolean
}

export interface RequireConsumerOptions {
  /**
   * G3-1 opt-in: require the Supabase session email to be verified — present,
   * `email_confirmed_at` set, AND the CURRENT email backed by a verified
   * identity (defeats the M4 email-swap when "Secure email change" is off).
   * Yields a VerifiedAuthenticatedConsumer with the live confirmed email.
   * Defaults OFF; existing callers are unchanged.
   */
  requireEmailVerified?: boolean
}

/** Structural view of the fields we read off the Supabase `getUser()` user. */
type SupabaseUserLike = {
  email?: string | null
  email_confirmed_at?: string | null
  created_at?: string | null
  identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null
}

/**
 * True iff the user's CURRENT primary email is a confirmed, verified identity.
 * Requires: an email present, `email_confirmed_at` set, AND an identity whose
 * `identity_data.email` matches the current email with `email_verified === true`.
 * The identity match is the M4 defense: a bare truthy `email_confirmed_at` can
 * reflect a PRIOR email if "Secure email change" is off, so we additionally
 * require the current email itself to be a verified identity. Fail-closed.
 */
export function currentEmailIsVerified(user: SupabaseUserLike): boolean {
  const email = user.email?.toLowerCase()
  if (!email) return false
  if (!user.email_confirmed_at) return false
  const identities = user.identities ?? []
  return identities.some((idn) => {
    const data = idn.identity_data ?? {}
    const idnEmail = typeof data.email === 'string' ? data.email.toLowerCase() : null
    return idnEmail === email && data.email_verified === true
  })
}

/**
 * Auto-confirm signature: Supabase with Confirm-email DISABLED sets
 * `email_confirmed_at` in the SAME insert as `created_at` → byte-identical
 * timestamps. In a confirm-REQUIRED flow the confirm click is a later, distinct
 * write, so equality is essentially exclusive to auto-confirm.
 */
export function emailAutoConfirmSuspected(user: SupabaseUserLike): boolean {
  return (
    !!user.email_confirmed_at &&
    !!user.created_at &&
    user.email_confirmed_at === user.created_at
  )
}

/**
 * Create a Supabase client from the request cookies.
 * Uses request.cookies.getAll() directly — proven to work in the debug endpoint.
 */
function createSupabaseFromRequest(request: NextRequest) {
  const response = NextResponse.next()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { response.cookies.set(name, value, options) } catch {}
          })
        },
      },
    }
  )
}

/**
 * Authenticates via Supabase session and confirms a developer record exists.
 * Pass the NextRequest from the route handler.
 */
export async function requireDeveloper(
  request?: NextRequest
): Promise<AuthenticatedDeveloper> {
  let user = null

  if (request) {
    // Use request.cookies directly (reliable in all contexts)
    const supabase = createSupabaseFromRequest(request)
    const result = await supabase.auth.getUser()
    user = result.data.user
  } else {
    // Fallback: use cookies() from next/headers
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options) } catch {}
            })
          },
        },
      }
    )
    const result = await supabase.auth.getUser()
    user = result.data.user
  }

  if (!user) {
    throw new Error('Authentication required. Please sign in.')
  }

  const [developer] = await db
    .select({ id: developers.id, email: developers.email })
    .from(developers)
    .where(eq(developers.supabaseUserId, user.id))
    .limit(1)

  if (!developer) {
    throw new Error('Developer account not found. Please complete registration.')
  }

  return { id: developer.id, email: developer.email }
}

/**
 * Authenticates via Supabase session and confirms a consumer record exists.
 * Pass the NextRequest from the route handler.
 */
export function requireConsumer(request?: NextRequest): Promise<AuthenticatedConsumer>
export function requireConsumer(
  request: NextRequest | undefined,
  opts: { requireEmailVerified: true }
): Promise<VerifiedAuthenticatedConsumer>
export async function requireConsumer(
  request?: NextRequest,
  opts?: RequireConsumerOptions
): Promise<AuthenticatedConsumer | VerifiedAuthenticatedConsumer> {
  let user = null

  if (request) {
    const supabase = createSupabaseFromRequest(request)
    const result = await supabase.auth.getUser()
    user = result.data.user
  } else {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options) } catch {}
            })
          },
        },
      }
    )
    const result = await supabase.auth.getUser()
    user = result.data.user
  }

  if (!user) {
    throw new Error('Authentication required. Please sign in.')
  }

  const [consumer] = await db
    .select({ id: consumers.id, email: consumers.email })
    .from(consumers)
    .where(eq(consumers.supabaseUserId, user.id))
    .limit(1)

  if (!consumer) {
    throw new Error('Consumer account not found. Please complete registration.')
  }

  if (opts?.requireEmailVerified) {
    if (!user.email || !currentEmailIsVerified(user)) {
      throw new Error('Email verification required. Please confirm your email address.')
    }
    return {
      id: consumer.id,
      email: consumer.email,
      verifiedEmail: user.email,
      emailAutoConfirmSuspected: emailAutoConfirmSuspected(user),
    }
  }

  return { id: consumer.id, email: consumer.email }
}
