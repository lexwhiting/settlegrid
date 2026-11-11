import { and, eq, ne, sql } from 'drizzle-orm'
import { invocations, tools } from '@/lib/db/schema'

/**
 * The tools that developer-dashboard activity metrics cover: every tool the
 * developer owns that is not deleted. Invocation counts, consumer counts,
 * method breakdowns, top consumers and the forecast all use this one scope, so
 * the dashboard home, Analytics and Consumer Insights agree.
 *
 * Earnings figures (all-time and month-to-date revenue) are the exception and
 * still cover every tool, because a deleted tool's earnings are still the
 * developer's. "Active Tools" counts status 'active' only, like Reputation.
 */
export function dashboardToolsWhere(developerId: string) {
  return and(eq(tools.developerId, developerId), ne(tools.status, 'deleted'))
}

/**
 * Invocations on any tool in the dashboard scope, as an uncapped SQL condition:
 * `invocations.tool_id IN (SELECT tools.id FROM tools WHERE <scope>)`. Routes use
 * this instead of fetching a tool-id list, so no row cap can drop tools from a metric.
 */
export function invocationsInDashboardScope(developerId: string) {
  return sql`${invocations.toolId} in (select ${tools.id} from ${tools} where ${dashboardToolsWhere(developerId)})`
}
