import { sql } from 'drizzle-orm'
import { tools, toolHealthChecks } from '@/lib/db/schema'

/** Same 30-day window as the reputation uptime dimension. */
const HEALTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/**
 * SQL boolean: the developer's active tools have at least one health check in
 * the last 30 days. developer_reputation.uptimePct is NOT NULL and stores 0
 * when there were no checks, so readers use this to tell "0%" from "no data".
 */
export function hasRecentHealthChecksSql(developerId: string) {
  const since = new Date(Date.now() - HEALTH_WINDOW_MS).toISOString()
  return sql<boolean>`exists(select 1 from ${toolHealthChecks} inner join ${tools} on ${tools.id} = ${toolHealthChecks.toolId} where ${tools.developerId} = ${developerId} and ${tools.status} = 'active' and ${toolHealthChecks.checkedAt} >= ${since}::timestamptz)`
}
