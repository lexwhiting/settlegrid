import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { getGatePassword, getGateSecret, getGateAuthTimeoutHours, isProduction } from '@/lib/env'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

const gateSchema = z.object({
  password: z.string().min(1).max(256),
})


export async function POST(request: NextRequest) {
  try {
    // Rate limiting via Upstash Redis (consistent with other auth routes).
    // G4-3 FOLD 1 (LBD-2): fail-CLOSED — this app-side limiter is the SOLE throttle
    // on the gate-password guess surface (a low-entropy human secret with NO
    // upstream backstop, unlike mfa-verify's GoTrue throttle or claim-token's
    // 192-bit entropy). Closes the store-REJECTION path only; a HANGING store still
    // fails-OPEN via Upstash's built-in 5s timeout race. Fail-closed here briefly
    // blocks NEW gate entry during a store rejection — recoverable, no account/data
    // lockout, and the gate is removed at public launch. Pre-auth, so ONE bucket.
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(authLimiter, `gate:${ip}`, { failMode: 'closed' })
    if (!rl.success) {
      return errorResponse('Too many attempts. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let gatePassword: string
    let gateSecret: string
    try {
      gatePassword = getGatePassword()
      gateSecret = getGateSecret()
    } catch {
      return errorResponse('Gate not configured', 503, 'GATE_NOT_CONFIGURED')
    }

    const body = await parseBody(request, gateSchema)

    // Timing-safe comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(body.password)
    const gatePasswordBuffer = Buffer.from(gatePassword)

    const isValid =
      passwordBuffer.length === gatePasswordBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, gatePasswordBuffer)

    if (!isValid) {
      return errorResponse('Invalid password', 401, 'INVALID_PASSWORD')
    }

    // Generate HMAC-SHA256 signed token using the separate gate secret
    const token = crypto
      .createHmac('sha256', gateSecret)
      .update('settlegrid-access-granted')
      .digest('hex')

    const timeoutHours = getGateAuthTimeoutHours()
    const maxAge = timeoutHours * 60 * 60

    const response = successResponse({ success: true })
    response.cookies.set('settlegrid_access', token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge,
      path: '/',
    })

    return response
  } catch (error) {
    return internalErrorResponse(error)
  }
}
