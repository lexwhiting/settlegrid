/**
 * The monthly summary's figures, kept in Redis for the month's runs. They are
 * captured only while last month's logs are known complete: on the 1st, before the
 * daily 03:00 UTC log purge (vercel.json `data-retention`). Every later run sends from
 * the stored figures, so the reporting month and its figures stay the same whatever is
 * purged afterwards. A run that finds none outside that window captures nothing.
 *
 * Stored in chunks (at most CHUNK_SIZE entries each, ~100 KB) so no single value nears
 * Upstash's request-size limit. Each writer writes its chunks under its own id, then
 * the meta key naming that id and the chunk count: a reader sees a snapshot only once
 * it is complete. The meta key is set with NX, so when two first runs overlap, the
 * first one wins and the other run's chunks are never read (they expire). Only an
 * incomplete snapshot (a chunk gone) is replaced, and only by a capture.
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { MonthlySummaryData } from '@/lib/email'

export type SnapshotRedis = Pick<Redis, 'get' | 'set'>

export interface SnapshotEntry {
  developerId: string
  summary: MonthlySummaryData
}

export type SnapshotState =
  | { status: 'ok'; entries: SnapshotEntry[] }
  | { status: 'missing' }
  | { status: 'incomplete' }

export const CHUNK_SIZE = 400

/** The daily log purge's hour (vercel.json `data-retention`: `0 3 * * *`). */
export const PURGE_HOUR_UTC = 3

const metaKey = (monthKey: string) => `monthly-summary:snapshot:${monthKey}`
const chunkKey = (monthKey: string, writer: string, i: number) => `monthly-summary:snapshot:${monthKey}:${writer}:${i}`

/** Upstash returns stored JSON already parsed; other clients return the string. */
function parsed(raw: unknown): unknown {
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

/** True on the 1st before the log purge: last month's logs are all still there. */
export function inCaptureWindow(now: Date): boolean {
  return now.getUTCDate() === 1 && now.getUTCHours() < PURGE_HOUR_UTC
}

/**
 * The earliest instant whose invocations survive the most recent purge for a
 * developer keeping `logDays` days (0 = forever: null). The purge deletes rows older
 * than `logDays` days at 03:00 UTC daily.
 */
export function retainedSince(now: Date, logDays: number): Date | null {
  if (logDays === 0) return null
  const lastPurge = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), PURGE_HOUR_UTC))
  if (lastPurge > now) lastPurge.setUTCDate(lastPurge.getUTCDate() - 1)
  return new Date(lastPurge.getTime() - logDays * 24 * 60 * 60 * 1000)
}

export async function loadSnapshot(redis: SnapshotRedis, monthKey: string): Promise<SnapshotState> {
  const meta = parsed(await redis.get(metaKey(monthKey))) as { chunks?: number; writer?: string } | null
  if (meta == null) return { status: 'missing' }
  if (typeof meta.chunks !== 'number' || typeof meta.writer !== 'string') return { status: 'incomplete' }
  const entries: SnapshotEntry[] = []
  for (let i = 0; i < meta.chunks; i++) {
    const chunk = parsed(await redis.get(chunkKey(monthKey, meta.writer, i)))
    if (!Array.isArray(chunk)) return { status: 'incomplete' }
    entries.push(...(chunk as SnapshotEntry[]))
  }
  return { status: 'ok', entries }
}

/**
 * Publishes `entries` as the month's snapshot unless a complete one is already stored
 * (an incomplete one is replaced), and returns the published snapshot as read back.
 * Returns null if no complete snapshot can be read back: never unpublished entries.
 * Call it only while the source data is complete (inCaptureWindow).
 */
export async function storeSnapshot(
  redis: SnapshotRedis,
  monthKey: string,
  entries: SnapshotEntry[],
  ttlSecs: number,
  chunkSize = CHUNK_SIZE,
): Promise<SnapshotEntry[] | null> {
  const writer = randomUUID()
  const chunks = Math.ceil(entries.length / chunkSize)
  for (let i = 0; i < chunks; i++) {
    await redis.set(chunkKey(monthKey, writer, i), JSON.stringify(entries.slice(i * chunkSize, (i + 1) * chunkSize)), { ex: ttlSecs })
  }
  const before = await loadSnapshot(redis, monthKey)
  if (before.status === 'ok') return before.entries
  const meta = JSON.stringify({ chunks, writer })
  if (before.status === 'incomplete') await redis.set(metaKey(monthKey), meta, { ex: ttlSecs })
  else await redis.set(metaKey(monthKey), meta, { nx: true, ex: ttlSecs })
  const after = await loadSnapshot(redis, monthKey)
  return after.status === 'ok' ? after.entries : null
}
