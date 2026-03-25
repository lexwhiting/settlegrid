import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getGateSecret, getGatePassword } from '@/lib/env'

/**
 * Constant-time string comparison for Edge runtime (no Node crypto.timingSafeEqual).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function computeExpectedToken(secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode('settlegrid-access-granted')
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyGateAccess(request: NextRequest): Promise<boolean> {
  let secret: string
  try {
    secret = getGateSecret()
  } catch {
    return true // No secret configured = open access
  }

  const token = request.cookies.get('settlegrid_access')?.value
  if (!token || token.length !== 64) return false

  const expectedToken = await computeExpectedToken(secret)
  return timingSafeEqual(token, expectedToken)
}

/** Paths that bypass the password gate entirely */
const gatePublicPatterns = [
  '/api/',
  '/_next/',
  '/favicon',
  '/gate',
  '/login',
  '/register',
  '/auth/',
  '/tools',
  '/docs',
]

function isGatePublicPath(pathname: string): boolean {
  return gatePublicPatterns.some((pattern) => pathname.startsWith(pattern))
}

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // In production, omit 'unsafe-eval' from script-src. Next.js needs it in dev for
  // fast-refresh / eval-based source maps, but it is unnecessary in production builds.
  const scriptSrc = process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: https://ncqjvmpruutwhilldcjp.supabase.co https://auth.settlegrid.ai; frame-src https://ncqjvmpruutwhilldcjp.supabase.co https://auth.settlegrid.ai; frame-ancestors 'none'`
  )
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Gate check for non-public paths
  if (!isGatePublicPath(pathname)) {
    let gatePassword: string | undefined
    try {
      gatePassword = getGatePassword()
    } catch {
      gatePassword = undefined
    }
    if (gatePassword && !(await verifyGateAccess(request))) {
      return NextResponse.redirect(new URL('/gate', request.url))
    }
  }

  // Refresh Supabase session via middleware helper
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes: redirect unauthenticated users to /login
  // Only dashboard and consumer routes require auth — everything else is public
  // (API routes handle their own auth and return 401)
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/consumer')
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user is logged in and visits /login or /register, redirect to /dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  addSecurityHeaders(supabaseResponse)
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
