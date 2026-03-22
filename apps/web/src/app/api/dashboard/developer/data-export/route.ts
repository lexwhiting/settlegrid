import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { requestDataExport, processDataExport } from '@/lib/settlement/compliance'
import { dataExportReadyEmail, sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/env'
import { logger } from '@/lib/logger'

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

    // Create the export request record
    const { id: exportId } = await requestDataExport('provider', auth.id)

    // Process the export immediately (collects all data and stores as base64)
    const result = await processDataExport(exportId)

    if (result.status !== 'completed') {
      return errorResponse('Data export failed. Please try again later.', 500, 'EXPORT_FAILED')
    }

    // Send email notification with download link
    const appUrl = getAppUrl()
    const downloadUrl = `${appUrl}/api/dashboard/developer/data-export/${exportId}`
    const template = dataExportReadyEmail(auth.email, downloadUrl)

    sendEmail({ to: auth.email, subject: template.subject, html: template.html }).catch((err) =>
      logger.error('data_export.email_failed', { exportId, developerId: auth.id }, err)
    )

    return successResponse({ success: true, exportId })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
