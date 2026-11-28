/**
 * deliverOnce: at most one email per key, whatever runs overlap, stall or die. A
 * refused send is retried; an uncertain one is recorded as ambiguous and never resent.
 * The Redis double honours NX and EX against a fake clock and runs only the exact
 * compare-and-set scripts (checked against a real Redis server), each atomically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  deliverOnce, STALE_SENDING_MS, SET_IF_OWNER, DELETE_IF_OWNER,
  type DeliveryRedis, type DeliveryPayload, type SendOutcome,
} from '../notification-delivery'

const VERIFIED_SET_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 else return 0 end"
const VERIFIED_DELETE_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

function fakeRedis() {
  const data = new Map<string, { value: string; expiresAt: number }>()
  const live = (k: string) => {
    const e = data.get(k)
    if (e && e.expiresAt <= Date.now()) data.delete(k)
    return data.get(k)
  }
  const put = (k: string, v: string, ttlSecs: number) => data.set(k, { value: v, expiresAt: Date.now() + ttlSecs * 1000 })
  const redis = {
    get: async (k: string) => live(k)?.value ?? null,
    set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
      if (opts.nx && live(k)) return null
      put(k, v, opts.ex)
      return 'OK'
    },
    eval: async (script: string, keys: string[], args: string[]) => {
      if (live(keys[0])?.value !== args[0]) return 0
      if (script === VERIFIED_SET_IF_OWNER) { put(keys[0], args[1], Number(args[2])); return 1 }
      if (script === VERIFIED_DELETE_IF_OWNER) { data.delete(keys[0]); return 1 }
      throw new Error('unexpected script')
    },
  }
  return {
    redis: redis as unknown as DeliveryRedis,
    value: (k: string) => live(k)?.value,
    ttlSecs: (k: string) => Math.round(((live(k)?.expiresAt ?? 0) - Date.now()) / 1000),
    put,
  }
}

const KEY = 'usage-alert:dev-1:2026-11:80'
const TTL = 40 * 24 * 60 * 60
const HOUR_MS = 60 * 60 * 1000
const EMAIL: DeliveryPayload = { to: 'dev@example.com', subject: 'S', html: '<p>1</p>' }

const sender = (...outcomes: SendOutcome[]) => {
  const queue = [...outcomes]
  return vi.fn(async (_p: DeliveryPayload, _k: string): Promise<SendOutcome> => queue.shift() ?? 'sent')
}
/** A send that waits until released, to stage overlapping runs. */
function stalledSender() {
  let finish!: (o: SendOutcome) => void
  const send = vi.fn((_p: DeliveryPayload, _k: string) => new Promise<SendOutcome>((resolve) => { finish = resolve }))
  return { send, finish: (o: SendOutcome) => finish(o) }
}
const deliver = (r: { redis: DeliveryRedis }, send: (p: DeliveryPayload, k: string) => Promise<SendOutcome>, render = () => EMAIL) =>
  deliverOnce(r.redis, { key: KEY, recordTtlSecs: TTL, render, send })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-01T00:15:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('deliverOnce', () => {
  it('runs only the verified compare-and-set scripts', () => {
    expect(SET_IF_OWNER).toBe(VERIFIED_SET_IF_OWNER)
    expect(DELETE_IF_OWNER).toBe(VERIFIED_DELETE_IF_OWNER)
  })

  it('sends once with the key as the idempotency key and records it for the record TTL', async () => {
    const r = fakeRedis()
    const send = sender('sent')
    expect(await deliver(r, send)).toBe('sent')
    expect(send).toHaveBeenCalledWith(EMAIL, KEY)
    expect(r.value(KEY)).toBe('sent')
    expect(r.ttlSecs(KEY)).toBe(TTL)
    expect(await deliver(r, send)).toBe('delivered')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('records an opt-out, and does not send later', async () => {
    const r = fakeRedis()
    const send = sender('opted_out', 'sent')
    expect(await deliver(r, send)).toBe('opted_out')
    expect(r.value(KEY)).toBe('opted_out')
    expect(await deliver(r, send)).toBe('delivered')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('a refused send (nothing went out) frees the key, so a later run sends it', async () => {
    const r = fakeRedis()
    const send = sender('not_sent', 'not_sent', 'sent')
    expect(await deliver(r, send)).toBe('failed')
    expect(r.value(KEY)).toBeUndefined()
    expect(await deliver(r, send)).toBe('failed')
    expect(await deliver(r, send)).toBe('sent')
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('an unknown outcome is recorded as ambiguous and never sent again', async () => {
    const r = fakeRedis()
    const send = sender('unknown', 'sent')
    expect(await deliver(r, send)).toBe('ambiguous')
    expect(r.value(KEY)).toBe('ambiguous')
    vi.setSystemTime(Date.now() + 30 * HOUR_MS)
    expect(await deliver(r, send)).toBe('delivered')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('a send that throws is recorded as ambiguous (it may have gone out) and the error passes on', async () => {
    const r = fakeRedis()
    const send = vi.fn(async (): Promise<SendOutcome> => { throw new Error('boom') })
    await expect(deliver(r, send)).rejects.toThrow('boom')
    expect(r.value(KEY)).toBe('ambiguous')
    const later = sender('sent')
    expect(await deliver(r, later)).toBe('delivered')
    expect(later).not.toHaveBeenCalled()
  })

  it('a render that throws claims nothing', async () => {
    const r = fakeRedis()
    const send = sender('sent')
    await expect(deliver(r, send, () => { throw new Error('render') })).rejects.toThrow('render')
    expect(r.value(KEY)).toBeUndefined()
    expect(send).not.toHaveBeenCalled()
  })

  it('an overlapping run is told busy and does not send', async () => {
    const r = fakeRedis()
    const a = stalledSender()
    const first = deliver(r, a.send)
    await vi.waitFor(() => expect(a.send).toHaveBeenCalled())
    const b = sender('sent')
    expect(await deliver(r, b)).toBe('busy')
    expect(b).not.toHaveBeenCalled()
    a.finish('sent')
    expect(await first).toBe('sent')
    expect(await deliver(r, b)).toBe('delivered')
    expect(b).not.toHaveBeenCalled()
  })

  it('a run that stalls mid-send for over a day: no other run ever sends, and its late result changes nothing', async () => {
    const r = fakeRedis()
    const a = stalledSender()
    const first = deliver(r, a.send)
    await vi.waitFor(() => expect(a.send).toHaveBeenCalled())
    const others = sender('sent')
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    expect(await deliver(r, others)).toBe('busy')
    vi.setSystemTime(Date.now() + 2 * HOUR_MS) // past STALE_SENDING_MS: given up once, logged
    expect(await deliver(r, others)).toBe('ambiguous')
    vi.setSystemTime(Date.now() + 24 * HOUR_MS)
    expect(await deliver(r, others)).toBe('delivered')
    expect(others).not.toHaveBeenCalled()
    a.finish('not_sent') // A finally hears back: its token is gone, so the key stays
    expect(await first).toBe('failed')
    expect(r.value(KEY)).toBe('ambiguous')
    expect(await deliver(r, others)).toBe('delivered')
    expect(others).not.toHaveBeenCalled()
  })

  it("a stalled run's late success doesn't overwrite the ambiguous verdict either", async () => {
    const r = fakeRedis()
    const a = stalledSender()
    const first = deliver(r, a.send)
    await vi.waitFor(() => expect(a.send).toHaveBeenCalled())
    vi.setSystemTime(Date.now() + STALE_SENDING_MS + 60 * 1000)
    expect(await deliver(r, sender('sent'))).toBe('ambiguous')
    a.finish('sent')
    await first
    expect(r.value(KEY)).toBe('ambiguous')
  })

  it("a dead run's mark is given up exactly once, then counts as delivered", async () => {
    const r = fakeRedis()
    r.put(KEY, `sending:dead-run:${Date.now() - STALE_SENDING_MS - 1000}`, TTL)
    const send = sender('sent')
    const [x, y] = await Promise.all([deliver(r, send), deliver(r, send)])
    expect([x, y].sort()).toEqual(['ambiguous', 'busy'])
    expect(r.value(KEY)).toBe('ambiguous')
    expect(await deliver(r, send)).toBe('delivered')
    expect(send).not.toHaveBeenCalled()
  })

  it("a fresh mark from another run is busy, right up to the stale limit", async () => {
    const r = fakeRedis()
    r.put(KEY, `sending:other-run:${Date.now() - STALE_SENDING_MS}`, TTL)
    const send = sender('sent')
    expect(await deliver(r, send)).toBe('busy')
    expect(send).not.toHaveBeenCalled()
    expect(r.value(KEY)).toMatch(/^sending:other-run:/)
  })
})
