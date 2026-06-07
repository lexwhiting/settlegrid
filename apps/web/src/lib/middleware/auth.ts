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
export async function requireConsumer(
  request?: NextRequest
): Promise<AuthenticatedConsumer> {
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

  return { id: consumer.id, email: consumer.email }
}
