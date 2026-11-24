/**
 * The monthly summary's figures, kept in Redis for the month's runs: the first run
 * computes them (before the 03:00 log purge) and every later run sends from them, so
 * the reporting month and its figures stay the same whatever is purged afterwards.
 *
 * Stored in chunks (at most CHUNK_SIZE entries each, ~100 KB) so no single value nears
 * Upstash's request-size limit. Each writer writes its chunks under its own id, then
 * the meta key (SET NX) naming that id and the chunk count: a reader sees a snapshot
 * only once it is complete, and when two first runs overlap, the first meta written
 * wins and the other run's chunks are never read (they expire).
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { MonthlySummaryData } from '@/lib/email'

export type SnapshotRedis = Pick<Redis, 'get' | 'set'>

export interface SnapshotEntry {
  developerId: string
  summary: MonthlySummaryData
}

export const CHUNK_SIZE = 400

const metaKey = (monthKey: string) => `monthly-summary:snapshot:${monthKey}`
const chunkKey = (monthKey: string, writer: string, i: number) => `monthly-summary:snapshot:${monthKey}:${writer}:${i}`

/** Upstash returns stored JSON already parsed; other clients return the string. */
function parsed(raw: unknown): unknown {
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

/** The stored snapshot, or null if there is none (or it is incomplete). */
export async function loadSnapshot(redis: SnapshotRedis, monthKey: string): Promise<SnapshotEntry[] | null> {
  const meta = parsed(await redis.get(metaKey(monthKey))) as { chunks?: number; writer?: string } | null
  if (!meta || typeof meta.chunks !== 'number' || typeof meta.writer !== 'string') return null
  const entries: SnapshotEntry[] = []
  for (let i = 0; i < meta.chunks; i++) {
    const chunk = parsed(await redis.get(chunkKey(monthKey, meta.writer, i)))
    if (!Array.isArray(chunk)) return null // expired or missing: recompute
    entries.push(...(chunk as SnapshotEntry[]))
  }
  return entries
}

/**
 * Stores `entries` unless a snapshot is already stored, and returns the stored one
 * (this run's, or one an overlapping run stored first).
 */
export async function storeSnapshot(
  redis: SnapshotRedis,
  monthKey: string,
  entries: SnapshotEntry[],
  ttlSecs: number,
  chunkSize = CHUNK_SIZE,
): Promise<SnapshotEntry[]> {
  const writer = randomUUID()
  const chunks = Math.ceil(entries.length / chunkSize)
  for (let i = 0; i < chunks; i++) {
    await redis.set(chunkKey(monthKey, writer, i), JSON.stringify(entries.slice(i * chunkSize, (i + 1) * chunkSize)), { ex: ttlSecs })
  }
  await redis.set(metaKey(monthKey), JSON.stringify({ chunks, writer }), { nx: true, ex: ttlSecs })
  return (await loadSnapshot(redis, monthKey)) ?? entries
}
