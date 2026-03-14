import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
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
  '/tools',
  '/docs',
]

function isGatePublicPath(pathname: string): boolean {
  return gatePublicPatterns.some((pattern) => pathname.startsWith(pattern))
}

/** Routes that do NOT require Clerk authentication */
const isPublicRoute = createRouteMatcher([
  '/',
  '/gate',
  '/login',
  '/register',
  '/tools(.*)',
  '/docs(.*)',
  '/api/webhooks/(.*)',
  '/api/cron/(.*)',
  '/api/sdk/(.*)',
  '/api/hub/(.*)',
  '/api/health',
  '/api/ping',
])

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://img.clerk.com; font-src 'self' data:; connect-src 'self' https: https://*.clerk.accounts.dev; frame-src https://*.clerk.accounts.dev; frame-ancestors 'none'"
  )
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

export default clerkMiddleware(async (clerkAuth, request) => {
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

  // Protect non-public routes with Clerk
  if (!isPublicRoute(request)) {
    await clerkAuth.protect()
  }

  const response = NextResponse.next()
  addSecurityHeaders(response)
  return response
})

export const config = {
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
}
