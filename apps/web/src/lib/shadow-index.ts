/**
 * Typed reader for the mcp_shadow_index table.
 * Server-side only — uses the Drizzle client from lib/db.
 */

import { db } from '@/lib/db'
import { mcpShadowIndex } from '@/lib/db/schema'
import { desc, eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export type ShadowEntry = typeof mcpShadowIndex.$inferSelect

export async function getAllShadowEntries(
  limit = 2000,
): Promise<ShadowEntry[]> {
  try {
    return await db
      .select()
      .from(mcpShadowIndex)
      .orderBy(desc(mcpShadowIndex.stars))
      .limit(limit)
  } catch (err) {
    logger.warn('shadow-index.query_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

export async function getShadowEntry(
  owner: string,
  repo: string,
): Promise<ShadowEntry | undefined> {
  try {
    const rows = await db
      .select()
      .from(mcpShadowIndex)
      .where(
        and(
          eq(mcpShadowIndex.owner, owner),
          eq(mcpShadowIndex.repo, repo),
        ),
      )
      .orderBy(desc(mcpShadowIndex.stars))
      .limit(1)
    return rows[0]
  } catch (err) {
    logger.warn('shadow-index.entry_query_failed', {
      owner,
      repo,
      error: err instanceof Error ? err.message : String(err),
    })
    return undefined
  }
}

export async function listOwners(): Promise<string[]> {
  try {
    const rows = await db
      .selectDistinct({ owner: mcpShadowIndex.owner })
      .from(mcpShadowIndex)
      .orderBy(mcpShadowIndex.owner)
    return rows.map((r) => r.owner)
  } catch (err) {
    logger.warn('shadow-index.owners_query_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

export async function countShadowEntries(): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpShadowIndex)
    return rows[0]?.count ?? 0
  } catch {
    return 0
  }
}
