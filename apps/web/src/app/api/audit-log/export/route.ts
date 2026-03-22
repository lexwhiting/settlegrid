import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


/** GET /api/audit-log/export — CSV export of audit log entries */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `audit-export:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    // Parse days param (default 30, max 365)
    const url = new URL(request.url)
    const daysParam = parseInt(url.searchParams.get('days') ?? '30', 10)
    const days = Math.min(Math.max(daysParam, 1), 365)

    const since = new Date()
    since.setDate(since.getDate() - days)

    const conditions = [
      eq(auditLogs.developerId, auth.id),
      gte(auditLogs.createdAt, since),
    ]

    const action = url.searchParams.get('action')
    if (action) {
      conditions.push(eq(auditLogs.action, action))
    }

    const resourceType = url.searchParams.get('resourceType')
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType))
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(2000)

    // Build CSV
    const lines: string[] = ['timestamp,action,resource_type,resource_id,ip_address,details']
    for (const row of rows) {
      const details = row.details ? JSON.stringify(row.details).replace(/,/g, ';').replace(/"/g, "'") : ''
      const resourceId = row.resourceId ?? ''
      const ipAddress = row.ipAddress ?? ''
      lines.push(
        `${row.createdAt.toISOString()},${row.action},${row.resourceType},${resourceId},${ipAddress},${details}`
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="settlegrid-audit-log-${days}d.csv"`,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
