/**
 * The monthly summary snapshot: chunked storage, complete-or-nothing reads, one
 * snapshot when two first runs overlap, recovery of an incomplete one, never
 * returning unpublished figures, Upstash's parsed-JSON reads, and the capture window
 * and purge coverage the route relies on.
 */
import { describe, it, expect } from 'vitest'
import {
  loadSnapshot, storeSnapshot, inCaptureWindow, retainedSince, keptSince,
  type SnapshotEntry, type SnapshotRedis,
} from '../monthly-summary-snapshot'

/** Like Upstash: values stored as JSON strings come back parsed; NX honoured. */
function fakeRedis() {
  const store = new Map<string, string>()
  const redis = {
    get: async (k: string) => {
      const v = store.get(k)
      if (v === undefined) return null
      try { return JSON.parse(v) } catch { return v }
    },
    set: async (k: string, v: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(k)) return null
      store.set(k, v)
      return 'OK'
    },
  }
  return { redis: redis as unknown as SnapshotRedis, store }
}

const META = 'monthly-summary:snapshot:2026-11'
const entry = (n: number): SnapshotEntry => ({
  developerId: `d${n}`,
  summary: { totalRevenueCents: n, totalInvocations: n, topToolName: 't', topToolRevenueCents: n, momRevenuePct: null, momInvocationPct: null },
})
const entries = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => entry(i + offset))
const writerOf = (store: Map<string, string>) => JSON.parse(store.get(META)!).writer as string

describe('monthly summary snapshot storage', () => {
  it('stores in chunks under a meta key and reads back every entry in order', async () => {
    const r = fakeRedis()
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'missing' })
    expect(await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)).toEqual(entries(5))
    const w = writerOf(r.store)
    expect(JSON.parse(r.store.get(META)!).chunks).toBe(3)
    expect([...r.store.keys()].sort()).toEqual([META, `${META}:${w}:0`, `${META}:${w}:1`, `${META}:${w}:2`])
    expect(JSON.parse(r.store.get(`${META}:${w}:0`)!)).toHaveLength(2)
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'ok', entries: entries(5) })
  })

  it('an empty month stores an empty snapshot (not "missing")', async () => {
    const r = fakeRedis()
    expect(await storeSnapshot(r.redis, '2026-11', [], 3600)).toEqual([])
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'ok', entries: [] })
  })

  it('a missing chunk reads as incomplete', async () => {
    const r = fakeRedis()
    await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)
    r.store.delete(`${META}:${writerOf(r.store)}:1`)
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'incomplete' })
  })

  it('an incomplete snapshot is replaced, and later loads return the same complete stored snapshot', async () => {
    const r = fakeRedis()
    await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)
    r.store.delete(`${META}:${writerOf(r.store)}:1`)
    const recovered = await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)
    expect(recovered).toEqual(entries(5))
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'ok', entries: entries(5) })
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'ok', entries: recovered })
  })

  it('a second store keeps the first complete snapshot and returns it', async () => {
    const r = fakeRedis()
    await storeSnapshot(r.redis, '2026-11', entries(3), 3600, 2)
    const firstMeta = r.store.get(META)
    // A late overlapping first run with (in theory) different figures and chunking
    expect(await storeSnapshot(r.redis, '2026-11', entries(1, 100), 3600, 2)).toEqual(entries(3))
    expect(r.store.get(META)).toBe(firstMeta)
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual({ status: 'ok', entries: entries(3) })
  })

  it('never returns figures it could not publish', async () => {
    const r = fakeRedis()
    const metaLost = {
      ...r.redis,
      set: async (k: string, v: string, o: object) => (k === META ? 'OK' : (r.redis.set as (k: string, v: string, o: object) => Promise<unknown>)(k, v, o)),
    } as unknown as SnapshotRedis
    expect(await storeSnapshot(metaLost, '2026-11', entries(3), 3600, 2)).toBeNull()
  })
})

describe('capture window and purge coverage', () => {
  it('captures only on the 1st before the 03:00 UTC purge', () => {
    expect(inCaptureWindow(new Date('2026-12-01T00:15:00Z'))).toBe(true)
    expect(inCaptureWindow(new Date('2026-12-01T02:55:00Z'))).toBe(true)
    expect(inCaptureWindow(new Date('2026-12-01T03:00:00Z'))).toBe(false)
    expect(inCaptureWindow(new Date('2026-12-02T00:15:00Z'))).toBe(false)
    expect(inCaptureWindow(new Date('2026-11-15T01:00:00Z'))).toBe(false) // mid-month deploy
  })

  it('reports what the last purge kept: whole 30-day months survive, 31-day ones lose day 1', () => {
    // 1 Dec 00:15: last purge 30 Nov 03:00 → 30 days keeps from 31 Oct 03:00 (all of November)
    expect(retainedSince(new Date('2026-12-01T00:15:00Z'), 30)?.toISOString()).toBe('2026-10-31T03:00:00.000Z')
    // 1 Jan 00:15: last purge 31 Dec 03:00 → 30 days keeps from 1 Dec 03:00 (December's first 3 h gone)
    expect(retainedSince(new Date('2027-01-01T00:15:00Z'), 30)?.toISOString()).toBe('2026-12-01T03:00:00.000Z')
    // After the day's purge: from that purge
    expect(retainedSince(new Date('2026-12-01T03:30:00Z'), 30)?.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(retainedSince(new Date('2026-12-01T00:15:00Z'), 0)).toBeNull() // kept forever
  })

  it('takes the later of the recorded purge cutoff and the modelled one', () => {
    const now = new Date('2026-12-01T00:15:00Z') // modelled 90-day cutoff: 1 Sep 03:00
    expect(keptSince(now, 90, null)?.toISOString()).toBe('2026-09-01T03:00:00.000Z')
    // A purge that ran with a shorter retention, or off schedule, deleted more
    expect(keptSince(now, 90, new Date('2026-11-05T00:00:00Z'))?.toISOString()).toBe('2026-11-05T00:00:00.000Z')
    // A recorded cutoff older than the model doesn't loosen it
    expect(keptSince(now, 30, new Date('2026-09-01T00:00:00Z'))?.toISOString()).toBe('2026-10-31T03:00:00.000Z')
    // Keep-forever now, but an earlier purge already ran
    expect(keptSince(now, 0, new Date('2026-11-05T00:00:00Z'))?.toISOString()).toBe('2026-11-05T00:00:00.000Z')
    expect(keptSince(now, 0, null)).toBeNull()
  })
})
