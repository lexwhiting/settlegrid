import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 30

// ── GET /api/auth/mfa — check MFA status ─────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `mfa-status:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const supabase = createSupabaseFromRequest(request)
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (error) {
      return errorResponse('Failed to retrieve MFA status.', 500, 'MFA_STATUS_ERROR')
    }

    // List enrolled factors to get factor details
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const totpFactors = factorsData?.totp ?? []

    return successResponse({
      enrolled: totpFactors.length > 0,
      currentLevel: data.currentLevel,
      nextLevel: data.nextLevel,
      factors: totpFactors.map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name,
        status: f.status,
        createdAt: f.created_at,
      })),
      developerId: auth.id,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── POST /api/auth/mfa — enroll TOTP factor ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `mfa-enroll:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    try {
      await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const supabase = createSupabaseFromRequest(request)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'SettleGrid',
    })

    if (error) {
      return errorResponse(error.message || 'Failed to start MFA enrollment.', 400, 'MFA_ENROLL_ERROR')
    }

    return successResponse({
      factorId: data.id,
      qrCode: data.totp.uri,
      secret: data.totp.secret,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── PUT /api/auth/mfa — verify and activate factor ───────────────────────────

const verifySchema = z.object({
  factorId: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be a 6-digit number'),
})

export async function PUT(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `mfa-verify:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, verifySchema)
    const supabase = createSupabaseFromRequest(request)

    // Create a challenge for the factor
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: body.factorId,
    })

    if (challengeError) {
      return errorResponse(challengeError.message || 'Failed to create MFA challenge.', 400, 'MFA_CHALLENGE_ERROR')
    }

    // Verify the TOTP code against the challenge
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId: body.factorId,
      challengeId: challengeData.id,
      code: body.code,
    })

    if (verifyError) {
      return errorResponse(verifyError.message || 'Invalid verification code.', 400, 'MFA_VERIFY_ERROR')
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'security.mfa_enabled',
      resourceType: 'mfa_factor',
      resourceId: body.factorId,
      details: { factorId: body.factorId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({
      verified: true,
      factorId: body.factorId,
      session: (verifyData as Record<string, unknown>).session ?? null,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── DELETE /api/auth/mfa — unenroll factor ───────────────────────────────────

const unenrollSchema = z.object({
  factorId: z.string().min(1),
})

export async function DELETE(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `mfa-unenroll:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // DELETE body parsing — read from URL search params as fallback
    let factorId: string
    try {
      const body = await parseBody(request, unenrollSchema)
      factorId = body.factorId
    } catch {
      // Fallback: try query param
      const url = new URL(request.url)
      factorId = url.searchParams.get('factorId') ?? ''
      if (!factorId) {
        return errorResponse('factorId is required.', 422, 'VALIDATION_ERROR')
      }
    }

    const supabase = createSupabaseFromRequest(request)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })

    if (error) {
      return errorResponse(error.message || 'Failed to unenroll MFA factor.', 400, 'MFA_UNENROLL_ERROR')
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'security.mfa_disabled',
      resourceType: 'mfa_factor',
      resourceId: factorId,
      details: { factorId },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({ unenrolled: true, factorId })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── Supabase client helper ───────────────────────────────────────────────────

function createSupabaseFromRequest(request: NextRequest) {
  const response = NextResponse.next()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { response.cookies.set(name, value, options) } catch { /* ignore */ }
          })
        },
      },
    }
  )
}
