import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 10

export async function GET(request: NextRequest) {
  try {
    // List all cookies
    const allCookies = request.cookies.getAll()
    const cookieNames = allCookies.map(c => c.name)
    const supabaseCookies = allCookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'))

    // Try to get user
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try { response.cookies.set(name, value, options) } catch {}
            })
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let developer = null
    if (user) {
      const [dev] = await db
        .select({ id: developers.id, email: developers.email })
        .from(developers)
        .where(eq(developers.supabaseUserId, user.id))
        .limit(1)
      developer = dev ?? null
    }

    return NextResponse.json({
      cookies: {
        total: allCookies.length,
        names: cookieNames,
        supabaseCount: supabaseCookies.length,
        supabaseNames: supabaseCookies.map(c => `${c.name} (${c.value.length} chars)`),
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
      user: user ? { id: user.id, email: user.email } : null,
      userError: userError?.message ?? null,
      developer,
      dbConnected: true,
    })
  } catch (err) {
    return NextResponse.json({
      error: (err as Error).message,
      stack: (err as Error).stack?.split('\n').slice(0, 3),
    }, { status: 500 })
  }
}
