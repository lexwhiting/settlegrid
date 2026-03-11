import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
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
    const rateLimit = await checkRateLimit(authLimiter, `con-login:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, loginSchema)

    const [consumer] = await db
      .select({
        id: consumers.id,
        email: consumers.email,
        passwordHash: consumers.passwordHash,
        createdAt: consumers.createdAt,
      })
      .from(consumers)
      .where(eq(consumers.email, body.email))
      .limit(1)

    if (!consumer) {
      return errorResponse('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    const passwordValid = await comparePassword(body.password, consumer.passwordHash)
    if (!passwordValid) {
      return errorResponse('Invalid email or password.', 401, 'INVALID_CREDENTIALS')
    }

    const token = await createToken({
      id: consumer.id,
      email: consumer.email,
      role: 'consumer',
    })

    const response = successResponse({
      consumer: {
        id: consumer.id,
        email: consumer.email,
        createdAt: consumer.createdAt,
      },
      token,
    })

    return setSessionCookie(response, token)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
