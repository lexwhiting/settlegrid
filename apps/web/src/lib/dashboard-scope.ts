import { and, eq, ne } from 'drizzle-orm'
import { tools } from '@/lib/db/schema'

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
