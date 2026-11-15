/**
 * Typed reader for the mcp_shadow_index table.
 * Server-side only — uses the Drizzle client from lib/db.
 */

import { db } from '@/lib/db'
import { mcpShadowIndex } from '@/lib/db/schema'
import { desc, eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export type ShadowEntry = typeof mcpShadowIndex.$inferSelect

/** Longest a shadow-index read may take before its reader returns the fallback. */
export const SHADOW_READ_TIMEOUT_MS = 10_000

/**
 * Resolves with the read's result, or with `fallback` once the read has taken
 * SHADOW_READ_TIMEOUT_MS. The directory pages run these reads while Next.js
 * prerenders them, and a page that takes more than 60 seconds fails the build.
 */
async function bounded<T>(read: string, query: () => Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      logger.warn('shadow-index.query_timeout', { read, timeoutMs: SHADOW_READ_TIMEOUT_MS })
      resolve(fallback)
    }, SHADOW_READ_TIMEOUT_MS)
  })
  try {
    return await Promise.race([query(), timedOut])
  } finally {
    clearTimeout(timer)
  }
}

export async function getAllShadowEntries(
  limit = 2000,
): Promise<ShadowEntry[]> {
  return bounded('entries', async () => {
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
  }, [])
}

export async function getShadowEntry(
  owner: string,
  repo: string,
): Promise<ShadowEntry | undefined> {
  return bounded('entry', async () => {
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
  }, undefined)
}

export async function listOwners(): Promise<string[]> {
  return bounded('owners', async () => {
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
  }, [])
}

export async function countShadowEntries(): Promise<number> {
  return bounded('count', async () => {
    try {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(mcpShadowIndex)
      return rows[0]?.count ?? 0
    } catch {
      return 0
    }
  }, 0)
}
