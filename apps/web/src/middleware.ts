import { NextRequest, NextResponse } from 'next/server'

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
  const secret = process.env.GATE_SECRET
  if (!secret) return true // No secret configured = open access

  const token = request.cookies.get('settlegrid_access')?.value
  if (!token || token.length !== 64) return false

  const expectedToken = await computeExpectedToken(secret)
  return token === expectedToken
}

/** Paths that bypass the password gate entirely */
const publicPatterns = [
  '/api/sdk/',
  '/api/billing/webhook',
  '/api/gate',
  '/api/health',
  '/_next/',
  '/favicon',
  '/gate',
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
  const gatePassword = process.env.GATE_PASSWORD
  if (gatePassword && !(await verifyGateAccess(request))) {
    return NextResponse.redirect(new URL('/gate', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
