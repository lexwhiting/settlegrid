import { and, eq, gte, inArray, sql, type AnyColumn } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations, tools } from '@/lib/db/schema'

/**
 * Rows whose tool the developer owns, deleted tools included, as a SQL
 * condition: `<column> IN (SELECT id FROM tools WHERE developer_id = …)`.
 * It has no row cap, so every tool counts however many the developer has.
 */
export function onToolsOfDeveloper(column: AnyColumn, developerId: string) {
  return sql`${column} in (select ${tools.id} from ${tools} where ${eq(tools.developerId, developerId)})`
}

/** Invocations on any tool the developer owns, deleted tools included (no row cap). */
export function invocationsOfDeveloper(developerId: string) {
  return onToolsOfDeveloper(invocations.toolId, developerId)
}

/** Whether the developer owns any tool, deleted ones included. */
export async function developerHasTools(developerId: string): Promise<boolean> {
  const rows = await db.select({ id: tools.id }).from(tools).where(eq(tools.developerId, developerId)).limit(1)
  return rows.length > 0
}

/** Names of the given tools, only those the developer owns, keyed by tool id. */
export async function toolNamesOf(developerId: string, toolIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(toolIds)]
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ id: tools.id, name: tools.name })
    .from(tools)
    .where(and(eq(tools.developerId, developerId), inArray(tools.id, ids)))
    .limit(ids.length)
  return new Map(rows.map((r) => [r.id, r.name]))
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
