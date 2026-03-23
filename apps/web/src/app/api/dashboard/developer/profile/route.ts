import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'settings', 'dashboard', 'login', 'register',
  'docs', 'tools', 'learn', 'faq', 'privacy', 'terms', 'support',
  'help', 'billing', 'pricing', 'about', 'contact', 'blog',
  'settlegrid', 'system', 'null', 'undefined', 'new',
])

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(3).max(30).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase letters, numbers, and hyphens only. No leading/trailing hyphens.').optional(),
  publicProfile: z.boolean().optional(),
  publicBio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
})

/** PATCH /api/dashboard/developer/profile — update developer profile settings */
export async function PATCH(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-profile-update:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, updateProfileSchema)

    // Build update fields (only include provided fields)
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.name !== undefined) {
      updates.name = body.name
    }
    if (body.slug !== undefined) {
      const normalizedSlug = body.slug.toLowerCase()

      // Check reserved slugs
      if (RESERVED_SLUGS.has(normalizedSlug)) {
        return errorResponse('This profile URL is reserved.', 409, 'SLUG_RESERVED')
      }

      // Check uniqueness (exclude current developer)
      const [existing] = await db
        .select({ id: developers.id })
        .from(developers)
        .where(and(eq(developers.slug, normalizedSlug), ne(developers.id, auth.id)))
        .limit(1)

      if (existing) {
        return errorResponse('This profile URL is already taken.', 409, 'SLUG_TAKEN')
      }

      updates.slug = normalizedSlug
    }
    if (body.publicProfile !== undefined) {
      updates.publicProfile = body.publicProfile
    }
    if (body.publicBio !== undefined) {
      updates.publicBio = body.publicBio
    }
    if (body.avatarUrl !== undefined) {
      updates.avatarUrl = body.avatarUrl
    }

    const [updated] = await db
      .update(developers)
      .set(updates)
      .where(eq(developers.id, auth.id))
      .returning({
        name: developers.name,
        slug: developers.slug,
        publicProfile: developers.publicProfile,
        publicBio: developers.publicBio,
        avatarUrl: developers.avatarUrl,
        updatedAt: developers.updatedAt,
      })

    if (!updated) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    return successResponse({ profile: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
