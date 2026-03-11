import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, gte, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { csvEscape } from '@/lib/csv'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 30

/** GET /api/dashboard/developer/stats/export — CSV export of invocation data */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-export:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED', requestId)
    }

    // Parse days param (default 30, max 365 for enterprise, 90 for standard)
    const url = new URL(request.url)
    const daysParam = parseInt(url.searchParams.get('days') ?? '30', 10)
    const days = Math.min(Math.max(daysParam, 1), 365)

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get developer's tool IDs
    const developerTools = await db
      .select({ id: tools.id, name: tools.name })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    const toolIds = developerTools.map((t) => t.id)
    const toolNameMap = new Map(developerTools.map((t) => [t.id, t.name]))

    if (toolIds.length === 0) {
      const csv = 'timestamp,tool,method,cost_cents,latency_ms,status\n'
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="settlegrid-export-${days}d.csv"`,
          'x-request-id': requestId,
        },
      })
    }

    // Get invocations
    const rows = await db
      .select({
        createdAt: invocations.createdAt,
        toolId: invocations.toolId,
        method: invocations.method,
        costCents: invocations.costCents,
        latencyMs: invocations.latencyMs,
        status: invocations.status,
      })
      .from(invocations)
      .where(
        and(
          gte(invocations.createdAt, since),
          sql`${invocations.toolId} = ANY(${toolIds})`
        )
      )
      .orderBy(desc(invocations.createdAt))
      .limit(50000)

    // Build CSV with proper escaping
    const lines: string[] = ['timestamp,tool,method,cost_cents,latency_ms,status']
    for (const row of rows) {
      const toolName = toolNameMap.get(row.toolId) ?? row.toolId
      lines.push(
        [
          csvEscape(row.createdAt.toISOString()),
          csvEscape(toolName),
          csvEscape(row.method),
          csvEscape(String(row.costCents)),
          csvEscape(row.latencyMs != null ? String(row.latencyMs) : ''),
          csvEscape(row.status),
        ].join(',')
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="settlegrid-export-${days}d.csv"`,
        'x-request-id': requestId,
      },
    })
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
