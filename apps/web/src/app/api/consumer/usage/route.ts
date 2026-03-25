import { NextRequest } from 'next/server'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `usage:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const url = new URL(request.url)
    const toolId = url.searchParams.get('toolId')
    const daysParam = url.searchParams.get('days')
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365) : 30

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const conditions = [
      eq(invocations.consumerId, auth.id),
      gte(invocations.createdAt, sql`${cutoff.toISOString()}::timestamptz`),
    ]

    if (toolId) {
      if (!UUID_REGEX.test(toolId)) {
        return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
      }
      conditions.push(eq(invocations.toolId, toolId))
    }

    const usageRecords = await db
      .select({
        id: invocations.id,
        toolId: invocations.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        method: invocations.method,
        costCents: invocations.costCents,
        latencyMs: invocations.latencyMs,
        status: invocations.status,
        createdAt: invocations.createdAt,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(and(...conditions))
      .orderBy(desc(invocations.createdAt))
      .limit(500)

    // Calculate summary per tool
    const summaryMap = new Map<
      string,
      { toolId: string; toolName: string; toolSlug: string; totalInvocations: number; totalCostCents: number }
    >()

    for (const record of usageRecords) {
      const existing = summaryMap.get(record.toolId)
      if (existing) {
        existing.totalInvocations += 1
        existing.totalCostCents += record.costCents
      } else {
        summaryMap.set(record.toolId, {
          toolId: record.toolId,
          toolName: record.toolName,
          toolSlug: record.toolSlug,
          totalInvocations: 1,
          totalCostCents: record.costCents,
        })
      }
    }

    return successResponse({
      invocations: usageRecords,
      summary: Array.from(summaryMap.values()),
      period: { days, from: cutoff.toISOString(), to: new Date().toISOString() },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
