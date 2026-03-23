import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

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
  // Data retention settings
  logRetentionDays: z.number().int().refine((v) => v === 0 || (v >= 30 && v <= 365), 'Must be 0 (forever) or 30-365').optional(),
  webhookLogRetentionDays: z.number().int().min(7, 'Minimum 7 days').max(90, 'Maximum 90 days').optional(),
  auditLogRetentionDays: z.number().int().min(90, 'Minimum 90 days').max(730, 'Maximum 730 days').optional(),
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
    if (body.logRetentionDays !== undefined) {
      updates.logRetentionDays = body.logRetentionDays
    }
    if (body.webhookLogRetentionDays !== undefined) {
      updates.webhookLogRetentionDays = body.webhookLogRetentionDays
    }
    if (body.auditLogRetentionDays !== undefined) {
      updates.auditLogRetentionDays = body.auditLogRetentionDays
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
        logRetentionDays: developers.logRetentionDays,
        webhookLogRetentionDays: developers.webhookLogRetentionDays,
        auditLogRetentionDays: developers.auditLogRetentionDays,
        updatedAt: developers.updatedAt,
      })

    if (!updated) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'settings.profile_updated',
      resourceType: 'developer',
      resourceId: auth.id,
      details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({ profile: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
