/**
 * The monthly summary snapshot: chunked storage, complete-or-nothing reads, one
 * snapshot when two first runs overlap, and Upstash's parsed-JSON reads.
 */
import { describe, it, expect } from 'vitest'
import { loadSnapshot, storeSnapshot, type SnapshotEntry, type SnapshotRedis } from '../monthly-summary-snapshot'

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

const entry = (n: number): SnapshotEntry => ({
  developerId: `d${n}`,
  summary: { totalRevenueCents: n, totalInvocations: n, topToolName: 't', topToolRevenueCents: n, momRevenuePct: null, momInvocationPct: null },
})
const entries = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => entry(i + offset))

describe('monthly summary snapshot', () => {
  it('stores in chunks under a meta key and reads back every entry in order', async () => {
    const r = fakeRedis()
    expect(await loadSnapshot(r.redis, '2026-11')).toBeNull()
    const stored = await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)
    expect(stored).toEqual(entries(5))
    const meta = JSON.parse(r.store.get('monthly-summary:snapshot:2026-11')!)
    expect(meta.chunks).toBe(3)
    expect([...r.store.keys()].sort()).toEqual([
      'monthly-summary:snapshot:2026-11',
      `monthly-summary:snapshot:2026-11:${meta.writer}:0`,
      `monthly-summary:snapshot:2026-11:${meta.writer}:1`,
      `monthly-summary:snapshot:2026-11:${meta.writer}:2`,
    ])
    expect(JSON.parse(r.store.get(`monthly-summary:snapshot:2026-11:${meta.writer}:0`)!)).toHaveLength(2)
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual(entries(5))
  })

  it('an empty month stores an empty snapshot (not "missing")', async () => {
    const r = fakeRedis()
    expect(await storeSnapshot(r.redis, '2026-11', [], 3600)).toEqual([])
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual([])
  })

  it('a snapshot with a missing chunk reads as missing (recomputed)', async () => {
    const r = fakeRedis()
    await storeSnapshot(r.redis, '2026-11', entries(5), 3600, 2)
    const { writer } = JSON.parse(r.store.get('monthly-summary:snapshot:2026-11')!)
    r.store.delete(`monthly-summary:snapshot:2026-11:${writer}:1`)
    expect(await loadSnapshot(r.redis, '2026-11')).toBeNull()
  })

  it('a second store keeps the first snapshot and returns it', async () => {
    const r = fakeRedis()
    await storeSnapshot(r.redis, '2026-11', entries(3), 3600, 2)
    const firstMeta = r.store.get('monthly-summary:snapshot:2026-11')
    // A late overlapping first run with (in theory) different figures and chunking
    const second = await storeSnapshot(r.redis, '2026-11', entries(1, 100), 3600, 2)
    expect(r.store.get('monthly-summary:snapshot:2026-11')).toBe(firstMeta)
    expect(second).toEqual(entries(3)) // the first snapshot, untouched by the second run's chunks
    expect(await loadSnapshot(r.redis, '2026-11')).toEqual(entries(3))
  })
})
