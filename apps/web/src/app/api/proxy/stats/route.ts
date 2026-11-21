import { NextRequest } from 'next/server'
import { eq, sql, gte, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { invocationsOfDeveloper } from '@/lib/developer-invocations'

export const maxDuration = 60

/**
 * GET /api/proxy/stats
 *
 * Returns proxy usage statistics for the authenticated developer's tools.
 * Includes: total calls (today/week/month), average latency, error rate,
 * and top tools by proxy volume.
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `proxy-stats:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const userRl = await checkRateLimit(apiLimiter, `proxy-stats:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    // Every tool the developer owns (deleted ones included), counted in SQL with no cap
    const [toolCounts] = await db
      .select({
        totalTools: sql<number>`count(*)::int`,
        proxyEnabledTools: sql<number>`(count(*) filter (where ${tools.proxyEndpoint} is not null and ${tools.proxyEndpoint} <> ''))::int`,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))

    if (!toolCounts || toolCounts.totalTools === 0) {
      return successResponse(
        {
          data: {
            today: { totalCalls: 0, successCalls: 0, errorCalls: 0, totalCostCents: 0 },
            thisWeek: { totalCalls: 0, successCalls: 0, errorCalls: 0, totalCostCents: 0 },
            thisMonth: { totalCalls: 0, successCalls: 0, errorCalls: 0, totalCostCents: 0 },
            averageLatencyMs: 0,
            errorRate: 0,
            topTools: [],
            proxyEnabledTools: 0,
            totalTools: 0,
          },
        },
        200,
        requestId
      )
    }

    // The UTC day, week (from Sunday) and calendar month, whatever the server's time zone
    const now = new Date()
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const startOfWeek = new Date(startOfDay.getTime() - now.getUTCDay() * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    // Invocations on every tool the developer owns, through a subquery (no cap)
    const ownInvocations = invocationsOfDeveloper(auth.id)

    // Query proxy invocations for this month (covers today + week + month)
    // Proxy invocations are identified by method starting with 'proxy:'
    const monthlyStats = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        successCalls: sql<number>`count(*) filter (where ${invocations.status} = 'success')::int`,
        errorCalls: sql<number>`count(*) filter (where ${invocations.status} = 'error')::int`,
        totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          ownInvocations,
          gte(invocations.createdAt, startOfMonth),
          sql`${invocations.method} like 'proxy:%'`
        )
      )

    const weeklyStats = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        successCalls: sql<number>`count(*) filter (where ${invocations.status} = 'success')::int`,
        errorCalls: sql<number>`count(*) filter (where ${invocations.status} = 'error')::int`,
        totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          ownInvocations,
          gte(invocations.createdAt, startOfWeek),
          sql`${invocations.method} like 'proxy:%'`
        )
      )

    const dailyStats = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        successCalls: sql<number>`count(*) filter (where ${invocations.status} = 'success')::int`,
        errorCalls: sql<number>`count(*) filter (where ${invocations.status} = 'error')::int`,
        totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          ownInvocations,
          gte(invocations.createdAt, startOfDay),
          sql`${invocations.method} like 'proxy:%'`
        )
      )

    // Top tools by proxy volume this month
    const topToolsRaw = await db
      .select({
        toolId: invocations.toolId,
        totalCalls: sql<number>`count(*)::int`,
        totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${invocations.latencyMs}), 0)::int`,
        errorCount: sql<number>`count(*) filter (where ${invocations.status} = 'error')::int`,
      })
      .from(invocations)
      .where(
        and(
          ownInvocations,
          gte(invocations.createdAt, startOfMonth),
          sql`${invocations.method} like 'proxy:%'`
        )
      )
      .groupBy(invocations.toolId)
      .orderBy(sql`count(*) desc`)
      .limit(10)

    // Names and slugs of the top tools, only those the developer owns
    const topToolIds = topToolsRaw.map((row) => row.toolId)
    const topToolInfo = topToolIds.length > 0
      ? await db
          .select({ id: tools.id, name: tools.name, slug: tools.slug })
          .from(tools)
          .where(and(eq(tools.developerId, auth.id), inArray(tools.id, topToolIds)))
          .limit(topToolIds.length)
      : []
    const toolLookup = new Map(topToolInfo.map((t) => [t.id, t]))

    const topTools = topToolsRaw.map((row) => {
      const tool = toolLookup.get(row.toolId)
      return {
        toolId: row.toolId,
        toolName: tool?.name ?? 'Unknown',
        toolSlug: tool?.slug ?? 'unknown',
        totalCalls: row.totalCalls,
        totalCostCents: row.totalCostCents,
        avgLatencyMs: row.avgLatencyMs,
        errorRate: row.totalCalls > 0
          ? Math.round((row.errorCount / row.totalCalls) * 10000) / 100
          : 0,
      }
    })

    const monthly = monthlyStats[0]
    const weekly = weeklyStats[0]
    const daily = dailyStats[0]

    const monthlyTotal = monthly?.totalCalls ?? 0
    const monthlyErrors = monthly?.errorCalls ?? 0

    return successResponse(
      {
        data: {
          today: {
            totalCalls: daily?.totalCalls ?? 0,
            successCalls: daily?.successCalls ?? 0,
            errorCalls: daily?.errorCalls ?? 0,
            totalCostCents: daily?.totalCostCents ?? 0,
          },
          thisWeek: {
            totalCalls: weekly?.totalCalls ?? 0,
            successCalls: weekly?.successCalls ?? 0,
            errorCalls: weekly?.errorCalls ?? 0,
            totalCostCents: weekly?.totalCostCents ?? 0,
          },
          thisMonth: {
            totalCalls: monthly?.totalCalls ?? 0,
            successCalls: monthly?.successCalls ?? 0,
            errorCalls: monthly?.errorCalls ?? 0,
            totalCostCents: monthly?.totalCostCents ?? 0,
          },
          averageLatencyMs: monthly?.avgLatencyMs ?? 0,
          errorRate: monthlyTotal > 0
            ? Math.round((monthlyErrors / monthlyTotal) * 10000) / 100
            : 0,
          topTools,
          proxyEnabledTools: toolCounts.proxyEnabledTools,
          totalTools: toolCounts.totalTools,
        },
      },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
