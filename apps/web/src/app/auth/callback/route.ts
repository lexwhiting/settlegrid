import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Ensure a developer record exists for this user (auto-create on first OAuth sign-in)
  const user = data.user
  const email = user.email ?? ''
  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    null

  const [existing] = await db
    .select({ id: developers.id })
    .from(developers)
    .where(eq(developers.supabaseUserId, user.id))
    .limit(1)

  if (!existing) {
    // Check if a developer record exists by email (may have been created via API)
    const [byEmail] = await db
      .select({ id: developers.id })
      .from(developers)
      .where(eq(developers.email, email))
      .limit(1)

    if (byEmail) {
      // Link existing developer to Supabase user
      await db
        .update(developers)
        .set({ supabaseUserId: user.id })
        .where(eq(developers.email, email))
    } else {
      // Create new developer record
      await db.insert(developers).values({
        email,
        name,
        supabaseUserId: user.id,
      })
    }
  }

  return response
}
