import { and, eq, gte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools } from '@/lib/db/schema'

/**
 * The tools that developer-dashboard activity metrics cover: every tool the developer
 * owns that is not deleted. Home, Analytics, Consumer Insights and the forecast's
 * training data all use this one scope, so they agree. Earnings totals (all-time, this
 * month, the last 24 hours) are the exception and cover every tool: a deleted tool's
 * earnings are still the developer's. "Active Tools" counts status 'active' only.
 */
export function dashboardToolsWhere(developerId: string) {
  return and(eq(tools.developerId, developerId), ne(tools.status, 'deleted'))
}

/** Invocations on any tool in the dashboard scope, as an uncapped SQL condition (no fetched id list, no row cap). */
export function invocationsInDashboardScope(developerId: string) {
  return sql`${invocations.toolId} in (select ${tools.id} from ${tools} where ${dashboardToolsWhere(developerId)})`
}

/** Earnings this UTC calendar month over every tool the developer owns, deleted ones included. */
export async function monthEarningsCents(developerId: string): Promise<number> {
  const now = new Date()
  const monthStart = sql`${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()}::timestamptz`
  const [row] = await db
    .select({ revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::bigint` })
    .from(invocations)
    .innerJoin(tools, eq(invocations.toolId, tools.id))
    .where(and(eq(tools.developerId, developerId), gte(invocations.createdAt, monthStart)))
    .limit(1)
  return Number(row?.revenueCents ?? 0)
}
