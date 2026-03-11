import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { hashPassword, createToken, setSessionCookie } from '@/lib/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(authLimiter, `dev-register:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, registerSchema)

    // Check for existing developer with this email
    const [existing] = await db
      .select({ id: developers.id })
      .from(developers)
      .where(eq(developers.email, body.email))
      .limit(1)

    if (existing) {
      return errorResponse('A developer account with this email already exists.', 409, 'EMAIL_EXISTS')
    }

    const passwordHash = await hashPassword(body.password)

    const [developer] = await db
      .insert(developers)
      .values({
        email: body.email,
        name: body.name,
        passwordHash,
      })
      .returning({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        stripeConnectStatus: developers.stripeConnectStatus,
        balanceCents: developers.balanceCents,
        payoutSchedule: developers.payoutSchedule,
        createdAt: developers.createdAt,
      })

    const token = await createToken({
      id: developer.id,
      email: developer.email,
      role: 'developer',
    })

    const response = successResponse(
      {
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
      },
      201
    )

    return setSessionCookie(response, token)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
