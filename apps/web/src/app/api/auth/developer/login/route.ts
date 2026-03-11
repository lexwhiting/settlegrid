import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { comparePassword, createToken, setSessionCookie } from '@/lib/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `dev-login:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, loginSchema)

    const [developer] = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        passwordHash: developers.passwordHash,
        stripeConnectStatus: developers.stripeConnectStatus,
        balanceCents: developers.balanceCents,
        payoutSchedule: developers.payoutSchedule,
        createdAt: developers.createdAt,
      })
      .from(developers)
      .where(eq(developers.email, body.email))
      .limit(1)

    if (!developer) {
      return errorResponse('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    const passwordValid = await comparePassword(body.password, developer.passwordHash)
    if (!passwordValid) {
      return errorResponse('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    const token = await createToken({
      id: developer.id,
      email: developer.email,
      role: 'developer',
    })

    const response = successResponse({
      developer: {
        id: developer.id,
        email: developer.email,
        name: developer.name,
        stripeConnectStatus: developer.stripeConnectStatus,
        balanceCents: developer.balanceCents,
        payoutSchedule: developer.payoutSchedule,
        createdAt: developer.createdAt,
      },
      token,
    })

    return setSessionCookie(response, token)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
