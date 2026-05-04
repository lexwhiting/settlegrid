/**
 * /dashboard/profile — smart redirect.
 *
 * The "Public Profile" link in the dashboard sidebar lands here.
 * If the developer has a slug AND publicProfile=true, send them to
 * their live public profile at /dev/[slug]. Otherwise drop them
 * into the Profile section of Settings so they can set it up.
 *
 * Why a route handler instead of a Link with conditional href: the
 * sidebar nav is static and can't read per-user state, and a Link
 * straight to /dev/[slug] would 404 for any developer who hasn't
 * picked a slug yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl
  // The query param is the signal Settings reads to surface a "set
  // up your public profile" banner — without it, this redirect is
  // visually indistinguishable from clicking the plain Settings link.
  const settingsUrl = `${origin}/dashboard/settings?setup=public-profile#profile`

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Read-only — this route only reads the session to look
          // up the developer; it never refreshes it.
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/dashboard/profile`)
  }

  const [dev] = await db
    .select({
      slug: developers.slug,
      publicProfile: developers.publicProfile,
    })
    .from(developers)
    .where(eq(developers.supabaseUserId, user.id))
    .limit(1)

  if (dev?.slug && dev.publicProfile) {
    return NextResponse.redirect(`${origin}/dev/${dev.slug}`)
  }

  return NextResponse.redirect(settingsUrl)
}
