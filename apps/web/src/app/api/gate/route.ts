import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'

const gateSchema = z.object({
  password: z.string().min(1).max(256),
})

export const maxDuration = 15

// Simple in-memory rate limiter: max 10 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = attempts.get(ip)
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  record.count++
  return record.count > MAX_ATTEMPTS
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const gatePassword = process.env.GATE_PASSWORD
    const gateSecret = process.env.GATE_SECRET
    if (!gatePassword || !gateSecret) {
      return NextResponse.json(
        { error: 'Gate not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const parsed = gateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }
    const { password } = parsed.data

    // Timing-safe comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password)
    const gatePasswordBuffer = Buffer.from(gatePassword)

    const isValid =
      passwordBuffer.length === gatePasswordBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, gatePasswordBuffer)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Generate HMAC-SHA256 signed token using the separate gate secret
    const token = crypto
      .createHmac('sha256', gateSecret)
      .update('settlegrid-access-granted')
      .digest('hex')

    const timeoutHours = parseInt(
      process.env.GATE_AUTH_TIMEOUT_HOURS || '24',
      10
    )
    const maxAge = timeoutHours * 60 * 60

    const response = NextResponse.json({ success: true })
    response.cookies.set('settlegrid_access', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
