import { NextRequest, NextResponse } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getExportStatus } from '@/lib/settlement/compliance'

export const maxDuration = 30

/** GET /api/dashboard/developer/data-export/[id] — download a completed data export as JSON */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `data-export-download:${ip}`)
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

    const { id: exportId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(exportId)) {
      return errorResponse('Invalid export ID.', 400, 'INVALID_ID')
    }

    // Fetch the export record
    const exportRecord = await getExportStatus(exportId)

    if (!exportRecord) {
      return errorResponse('Export not found.', 404, 'NOT_FOUND')
    }

    // Verify ownership: the export must belong to the requesting developer
    if (exportRecord.entityId !== auth.id) {
      return errorResponse('Export not found.', 404, 'NOT_FOUND')
    }

    if (exportRecord.status !== 'completed') {
      return errorResponse('Export is not yet ready.', 400, 'EXPORT_NOT_READY')
    }

    if (!exportRecord.resultUrl) {
      return errorResponse('Export data is missing.', 500, 'EXPORT_DATA_MISSING')
    }

    // Decode the base64 data URL
    const dataUrlPrefix = 'data:application/json;base64,'
    let jsonData: string

    if (exportRecord.resultUrl.startsWith(dataUrlPrefix)) {
      const base64Data = exportRecord.resultUrl.slice(dataUrlPrefix.length)
      jsonData = Buffer.from(base64Data, 'base64').toString('utf-8')
    } else {
      // Fallback: if it's a plain URL, return a redirect (for future external storage)
      return NextResponse.redirect(exportRecord.resultUrl)
    }

    // Return as a JSON file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `settlegrid-export-${timestamp}.json`

    return new NextResponse(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
