/**
 * deliverOnce: once-per-period delivery that survives failed sends, overlapping runs
 * and a run killed mid-send. The Redis double honours NX and EX against a fake clock.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deliverOnce, IN_FLIGHT_TTL_SECS, type DeliveryRedis } from '../notification-delivery'

function fakeRedis() {
  const data = new Map<string, { value: string; expiresAt: number }>()
  const live = (k: string) => {
    const e = data.get(k)
    if (e && e.expiresAt <= Date.now()) data.delete(k)
    return data.get(k)
  }
  const redis = {
    get: async (k: string) => live(k)?.value ?? null,
    set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
      if (opts.nx && live(k)) return null
      data.set(k, { value: v, expiresAt: Date.now() + opts.ex * 1000 })
      return 'OK'
    },
    del: async (k: string) => (data.delete(k) ? 1 : 0),
  }
  return {
    redis: redis as unknown as DeliveryRedis,
    has: (k: string) => live(k) !== undefined,
    value: (k: string) => live(k)?.value,
    put: (k: string, v: string, ttlSecs: number) => data.set(k, { value: v, expiresAt: Date.now() + ttlSecs * 1000 }),
  }
}

const KEY = 'monthly-summary:dev-1:2026-11'
const DAY = 24 * 60 * 60

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-01T00:15:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('deliverOnce', () => {
  it('sends once with the key as the idempotency key, records it, and releases the claim', async () => {
    const r = fakeRedis()
    const send = vi.fn(async () => 'sent' as const)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: 40 * DAY, send })).toBe('sent')
    expect(send).toHaveBeenCalledWith(KEY)
    expect(r.value(KEY)).toBe('sent')
    expect(r.has(`${KEY}:inflight`)).toBe(false)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: 40 * DAY, send })).toBe('delivered')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('records an opt-out (no retry) but not a failure (retried by the next call)', async () => {
    const opted = fakeRedis()
    expect(await deliverOnce(opted.redis, { key: KEY, recordTtlSecs: DAY, send: async () => 'opted_out' })).toBe('opted_out')
    expect(opted.value(KEY)).toBe('opted_out')

    const r = fakeRedis()
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send: async () => 'failed' })).toBe('failed')
    expect(r.has(KEY)).toBe(false)
    expect(r.has(`${KEY}:inflight`)).toBe(false)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send: async () => 'sent' })).toBe('sent')
  })

  it('a send that throws is not recorded and releases the claim', async () => {
    const r = fakeRedis()
    await expect(deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send: async () => { throw new Error('boom') } })).rejects.toThrow('boom')
    expect(r.has(KEY)).toBe(false)
    expect(r.has(`${KEY}:inflight`)).toBe(false)
  })

  it('an overlapping run is told busy and does not send', async () => {
    const r = fakeRedis()
    let release!: () => void
    const first = deliverOnce(r.redis, {
      key: KEY, recordTtlSecs: DAY,
      send: () => new Promise((resolve) => { release = () => resolve('sent') }),
    })
    await vi.waitFor(() => expect(r.has(`${KEY}:inflight`)).toBe(true))
    const second = vi.fn(async () => 'sent' as const)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send: second })).toBe('busy')
    expect(second).not.toHaveBeenCalled()
    release()
    expect(await first).toBe('sent')
  })

  it('releases only its own claim', async () => {
    const r = fakeRedis()
    // While sending, this run's claim lapses and another run claims the key
    const result = await deliverOnce(r.redis, {
      key: KEY, recordTtlSecs: DAY,
      send: async () => { r.put(`${KEY}:inflight`, 'other-run', IN_FLIGHT_TTL_SECS); return 'failed' },
    })
    expect(result).toBe('failed')
    expect(r.value(`${KEY}:inflight`)).toBe('other-run') // not deleted
  })

  it('re-checks the record after claiming: one sent and recorded meanwhile is not sent again', async () => {
    const r = fakeRedis()
    const base = r.redis
    let firstGet = true
    const racing = {
      ...base,
      // The record appears between the first check and the claim (another run finished)
      get: async (k: string) => {
        if (k === KEY && firstGet) { firstGet = false; const v = await base.get(k); r.put(KEY, 'sent', DAY); return v }
        return base.get(k)
      },
    } as unknown as DeliveryRedis
    const send = vi.fn(async () => 'sent' as const)
    expect(await deliverOnce(racing, { key: KEY, recordTtlSecs: DAY, send })).toBe('delivered')
    expect(send).not.toHaveBeenCalled()
    expect(r.has(`${KEY}:inflight`)).toBe(false)
  })

  it('if recording fails after a send, the claim is released and the retry reuses the idempotency key', async () => {
    const r = fakeRedis()
    const failingRecord = {
      ...r.redis,
      set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
        if (k === KEY) throw new Error('redis down')
        return (r.redis.set as (k: string, v: string, o: object) => Promise<unknown>)(k, v, opts)
      },
    } as unknown as DeliveryRedis
    const send = vi.fn(async () => 'sent' as const)
    await expect(deliverOnce(failingRecord, { key: KEY, recordTtlSecs: DAY, send })).rejects.toThrow('redis down')
    expect(r.has(`${KEY}:inflight`)).toBe(false)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send })).toBe('sent')
    expect(send.mock.calls).toEqual([[KEY], [KEY]]) // same key both times: Resend doesn't send the retry again
  })

  it('a claim left by a killed run expires, and the retry reuses the idempotency key', async () => {
    const r = fakeRedis()
    // The killed run: claimed, never recorded, never released
    await r.redis.set(`${KEY}:inflight`, '1', { nx: true, ex: IN_FLIGHT_TTL_SECS })
    const send = vi.fn(async () => 'sent' as const)
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send })).toBe('busy')
    vi.setSystemTime(new Date(Date.now() + IN_FLIGHT_TTL_SECS * 1000 + 1))
    expect(await deliverOnce(r.redis, { key: KEY, recordTtlSecs: DAY, send })).toBe('sent')
    expect(send).toHaveBeenCalledWith(KEY)
    expect(IN_FLIGHT_TTL_SECS).toBeLessThan(20 * 60) // shorter than the gap between summary runs
  })
})
