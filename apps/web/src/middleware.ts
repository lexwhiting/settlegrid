import { NextRequest, NextResponse } from 'next/server'
import { getGateSecret, getGatePassword } from '@/lib/env'

/**
 * Constant-time string comparison for Edge runtime (no Node crypto.timingSafeEqual).
 * Both strings must be the same length — caller must pre-check length.
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
const publicPatterns = [
  '/api/',
  '/_next/',
  '/favicon',
  '/gate',
  '/login',
  '/register',
  '/tools',
  '/docs',
]

function isPublicPath(pathname: string): boolean {
  return publicPatterns.some((pattern) => pathname.startsWith(pattern))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip gate check for public / API paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Enforce password gate
  let gatePassword: string | undefined
  try {
    gatePassword = getGatePassword()
  } catch {
    gatePassword = undefined
  }
  if (gatePassword && !(await verifyGateAccess(request))) {
    return NextResponse.redirect(new URL('/gate', request.url))
  }

  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'"
  )
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  return response
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
