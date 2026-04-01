import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { requestDataExport, processDataExport, ALL_EXPORT_CATEGORIES } from '@/lib/settlement/compliance'
import type { ExportCategory } from '@/lib/settlement/compliance'
import { dataExportReadyEmail, sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/env'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import { hasFeature } from '@/lib/tier-config'

const exportBodySchema = z.object({
  categories: z.array(z.enum(['profile', 'tools', 'invocations', 'payouts', 'webhooks', 'audit_logs'])).min(1).optional(),
  days: z.number().int().min(1).max(730).optional(),
}).optional()

export const maxDuration = 60

/** POST /api/dashboard/developer/data-export — initiate and process a GDPR data export */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `data-export:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // ── Tier gate: data_export requires Scale+ ─────────────────────────
    const [developer] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!developer) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND')
    }

    if (!hasFeature(developer.tier, 'data_export', developer.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Scale plan.',
        403,
        'TIER_REQUIRED',
        undefined,
        { requiredTier: 'scale', currentTier: developer.tier, upgradeUrl: '/pricing' }
      )
    }

    // Parse optional body for selective export
    let categories: ExportCategory[] | undefined
    let days: number | undefined
    try {
      const rawBody = await request.json().catch(() => undefined)
      if (rawBody) {
        const parsed = exportBodySchema.parse(rawBody)
        categories = parsed?.categories as ExportCategory[] | undefined
        days = parsed?.days
      }
    } catch {
      // If body parsing fails, fall back to full export
    }

    // Create the export request record
    const { id: exportId } = await requestDataExport('provider', auth.id)

    // Process the export (optionally filtered by categories and time range)
    const result = await processDataExport(exportId, categories, days)

    if (result.status !== 'completed') {
      return errorResponse('Data export failed. Please try again later.', 500, 'EXPORT_FAILED')
    }

    // Send email notification with download link
    const appUrl = getAppUrl()
    const downloadUrl = `${appUrl}/api/dashboard/developer/data-export/${exportId}`
    const template = dataExportReadyEmail(auth.email, downloadUrl)

    const emailSent = await sendEmail({ to: auth.email, subject: template.subject, html: template.html })

    if (!emailSent) {
      logger.error('data_export.email_failed', { exportId, developerId: auth.id, to: auth.email })
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'privacy.data_export_requested',
      resourceType: 'compliance_export',
      resourceId: exportId,
      details: { exportId, categories: categories ?? ALL_EXPORT_CATEGORIES, days: days ?? 90, emailSent },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({
      success: true,
      exportId,
      downloadUrl,
      emailSent,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
