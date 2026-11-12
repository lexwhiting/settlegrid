import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools } from '@/lib/db/schema'

/**
 * Invocations on any tool the developer owns, deleted tools included, as a SQL
 * condition: `invocations.tool_id IN (SELECT id FROM tools WHERE developer_id = …)`.
 * It has no row cap, so every tool counts however many the developer has.
 */
export function invocationsOfDeveloper(developerId: string) {
  return sql`${invocations.toolId} in (select ${tools.id} from ${tools} where ${eq(tools.developerId, developerId)})`
}

/** Revenue this UTC calendar month over every tool the developer owns. */
export async function monthEarningsCents(developerId: string): Promise<number> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [row] = await db
    .select({ revenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::bigint` })
    .from(invocations)
    .where(and(invocationsOfDeveloper(developerId), gte(invocations.createdAt, sql`${monthStart.toISOString()}::timestamptz`)))
    .limit(1)
  return Number(row?.revenueCents ?? 0)
}
