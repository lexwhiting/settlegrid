import { NextRequest } from 'next/server'
import { eq, and, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `usage-analytics:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    // Fetch all invocations for the last 30 days
    const records = await db
      .select({
        toolId: invocations.toolId,
        toolName: tools.name,
        costCents: invocations.costCents,
        createdAt: invocations.createdAt,
      })
      .from(invocations)
      .innerJoin(tools, eq(invocations.toolId, tools.id))
      .where(
        and(
          eq(invocations.consumerId, auth.id),
          gte(invocations.createdAt, cutoff)
        )
      )
      .limit(2000)

    // ── Aggregate daily trend ───────────────────────────────────────────────
    const dailyMap = new Map<string, { count: number; totalCostCents: number }>()
    const toolMap = new Map<string, { toolId: string; toolName: string; count: number; totalCostCents: number }>()

    for (const record of records) {
      // Daily aggregation
      const dateStr = new Date(record.createdAt).toISOString().split('T')[0]
      const dayEntry = dailyMap.get(dateStr)
      if (dayEntry) {
        dayEntry.count += 1
        dayEntry.totalCostCents += record.costCents
      } else {
        dailyMap.set(dateStr, { count: 1, totalCostCents: record.costCents })
      }

      // By-tool aggregation
      const toolEntry = toolMap.get(record.toolId)
      if (toolEntry) {
        toolEntry.count += 1
        toolEntry.totalCostCents += record.costCents
      } else {
        toolMap.set(record.toolId, {
          toolId: record.toolId,
          toolName: record.toolName,
          count: 1,
          totalCostCents: record.costCents,
        })
      }
    }

    // Sort daily trend by date
    const dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, count: data.count, totalCostCents: data.totalCostCents }))

    const byTool = Array.from(toolMap.values())
      .sort((a, b) => b.totalCostCents - a.totalCostCents)

    // Calculate projections
    const totalCostCents = records.reduce((sum, r) => sum + r.costCents, 0)
    const daysWithData = dailyMap.size || 1
    const avgDailyCostCents = Math.round(totalCostCents / daysWithData)
    const projectedMonthlySpendCents = avgDailyCostCents * 30

    return successResponse({
      dailyTrend,
      byTool,
      projectedMonthlySpendCents,
      avgDailyCostCents,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
