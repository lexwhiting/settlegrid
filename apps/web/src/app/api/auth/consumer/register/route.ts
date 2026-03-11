import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { hashPassword, createToken, setSessionCookie } from '@/lib/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `con-register:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, registerSchema)

    // Check for existing consumer with this email
    const [existing] = await db
      .select({ id: consumers.id })
      .from(consumers)
      .where(eq(consumers.email, body.email))
      .limit(1)

    if (existing) {
      return errorResponse('A consumer account with this email already exists.', 409, 'EMAIL_EXISTS')
    }

    const passwordHash = await hashPassword(body.password)

    const [consumer] = await db
      .insert(consumers)
      .values({
        email: body.email,
        passwordHash,
      })
      .returning({
        id: consumers.id,
        email: consumers.email,
        createdAt: consumers.createdAt,
      })

    const token = await createToken({
      id: consumer.id,
      email: consumer.email,
      role: 'consumer',
    })

    const response = successResponse(
      {
        consumer: {
          id: consumer.id,
          email: consumer.email,
          createdAt: consumer.createdAt,
        },
        token,
      },
      201
    )

    return setSessionCookie(response, token)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
