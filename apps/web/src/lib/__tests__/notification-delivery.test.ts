/**
 * deliverOnce: once-per-period delivery that survives failed sends, overlapping runs
 * and a run killed mid-send, never resends after Resend's idempotency window, and
 * resends exactly the first attempt's payload. The Redis double honours NX and EX
 * against a fake clock and, like Upstash, returns stored JSON parsed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  deliverOnce, IN_FLIGHT_TTL_SECS, SAFE_RETRY_MS,
  type DeliveryRedis, type DeliveryPayload, type SendOutcome,
} from '../notification-delivery'

function fakeRedis() {
  const data = new Map<string, { value: string; expiresAt: number }>()
  const live = (k: string) => {
    const e = data.get(k)
    if (e && e.expiresAt <= Date.now()) data.delete(k)
    return data.get(k)
  }
  const redis = {
    get: async (k: string) => {
      const v = live(k)?.value
      if (v === undefined) return null
      try { return JSON.parse(v) } catch { return v }
    },
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

const KEY = 'usage-alert:dev-1:2026-11:80'
const TO = 'dev@example.com'
const DAY = 24 * 60 * 60
const HOUR_MS = 60 * 60 * 1000

/** A render that changes with every call (like a figure that moves), so resends are checked. */
function renders() {
  let n = 0
  return vi.fn((): DeliveryPayload => { n++; return { to: TO, subject: `S${n}`, html: `<p>${n}</p>` } })
}
const sender = (...outcomes: SendOutcome[]) => {
  const queue = [...outcomes]
  return vi.fn(async (_p: DeliveryPayload, _k: string): Promise<SendOutcome> => queue.shift() ?? 'sent')
}
const deliver = (r: { redis: DeliveryRedis }, render: () => DeliveryPayload, send: ReturnType<typeof sender>, recordTtlSecs = 40 * DAY, recipient = TO) =>
  deliverOnce(r.redis, { key: KEY, recipient, recordTtlSecs, render, send })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-01T00:15:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('deliverOnce', () => {
  it('sends once with the key as the idempotency key, records it, and leaves no claim or attempt', async () => {
    const r = fakeRedis()
    const send = sender('sent')
    expect(await deliver(r, renders(), send)).toBe('sent')
    expect(send).toHaveBeenCalledWith({ to: TO, subject: 'S1', html: '<p>1</p>' }, KEY)
    expect(r.value(KEY)).toBe('sent')
    expect(r.has(`${KEY}:inflight`)).toBe(false)
    expect(r.has(`${KEY}:attempt`)).toBe(false)
    expect(await deliver(r, renders(), send)).toBe('delivered')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('records an opt-out (no retry)', async () => {
    const r = fakeRedis()
    expect(await deliver(r, renders(), sender('opted_out'))).toBe('opted_out')
    expect(r.value(KEY)).toBe('opted_out')
  })

  it('an unknown outcome is retried with exactly the first payload and key', async () => {
    const r = fakeRedis()
    const render = renders()
    const send = sender('unknown', 'sent')
    expect(await deliver(r, render, send)).toBe('failed')
    expect(r.has(KEY)).toBe(false)
    vi.setSystemTime(new Date(Date.now() + HOUR_MS))
    expect(await deliver(r, render, send)).toBe('sent')
    expect(render).toHaveBeenCalledTimes(1) // not re-rendered: the stored payload is resent
    expect(send.mock.calls).toEqual([[{ to: TO, subject: 'S1', html: '<p>1</p>' }, KEY], [{ to: TO, subject: 'S1', html: '<p>1</p>' }, KEY]])
  })

  it('a refused send (not_sent) is forgotten, so a long run of refusals is retried, not given up on', async () => {
    const r = fakeRedis()
    const send = sender('not_sent', 'not_sent', 'sent')
    expect(await deliver(r, renders(), send)).toBe('failed')
    expect(r.has(`${KEY}:attempt`)).toBe(false)
    vi.setSystemTime(new Date(Date.now() + 2 * DAY * 1000)) // two days of refusals (a bad API key)
    expect(await deliver(r, renders(), send)).toBe('failed')
    expect(await deliver(r, renders(), send)).toBe('sent')
  })

  it('a refusal after an unknown attempt keeps that attempt (it may have gone out)', async () => {
    const r = fakeRedis()
    const send = sender('unknown', 'not_sent')
    await deliver(r, renders(), send)
    const attempt = r.value(`${KEY}:attempt`)
    await deliver(r, renders(), send)
    expect(r.value(`${KEY}:attempt`)).toBe(attempt)
  })

  it('a send that throws is not recorded, releases its claim and keeps its attempt', async () => {
    const r = fakeRedis()
    const send = vi.fn(async (): Promise<SendOutcome> => { throw new Error('boom') })
    await expect(deliverOnce(r.redis, { key: KEY, recipient: TO, recordTtlSecs: DAY, render: renders(), send })).rejects.toThrow('boom')
    expect(r.has(KEY)).toBe(false)
    expect(r.has(`${KEY}:inflight`)).toBe(false)
    expect(r.has(`${KEY}:attempt`)).toBe(true)
  })

  it('an overlapping run is told busy and does not send', async () => {
    const r = fakeRedis()
    let release!: () => void
    const first = deliverOnce(r.redis, {
      key: KEY, recipient: TO, recordTtlSecs: DAY, render: renders(),
      send: () => new Promise((resolve) => { release = () => resolve('sent') }),
    })
    await vi.waitFor(() => expect(r.has(`${KEY}:inflight`)).toBe(true))
    const second = sender('sent')
    expect(await deliver(r, renders(), second, DAY)).toBe('busy')
    expect(second).not.toHaveBeenCalled()
    release()
    expect(await first).toBe('sent')
  })

  it('releases only its own claim', async () => {
    const r = fakeRedis()
    const send = vi.fn(async (): Promise<SendOutcome> => { r.put(`${KEY}:inflight`, 'other-run', IN_FLIGHT_TTL_SECS); return 'unknown' })
    expect(await deliverOnce(r.redis, { key: KEY, recipient: TO, recordTtlSecs: DAY, render: renders(), send })).toBe('failed')
    expect(r.value(`${KEY}:inflight`)).toBe('other-run')
  })

  it('re-checks the record after claiming: one recorded meanwhile is not sent again', async () => {
    const r = fakeRedis()
    let firstGet = true
    const racing = {
      ...r.redis,
      get: async (k: string) => {
        if (k === KEY && firstGet) { firstGet = false; const v = await r.redis.get(k); r.put(KEY, 'sent', DAY); return v }
        return r.redis.get(k)
      },
    } as unknown as DeliveryRedis
    const send = sender('sent')
    expect(await deliverOnce(racing, { key: KEY, recipient: TO, recordTtlSecs: DAY, render: renders(), send })).toBe('delivered')
    expect(send).not.toHaveBeenCalled()
  })

  it('Resend accepts, recording fails, the retry comes within the window: same payload and key (Resend replays)', async () => {
    const r = fakeRedis()
    const failingRecord = {
      ...r.redis,
      set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
        if (k === KEY) throw new Error('redis down')
        return (r.redis.set as (k: string, v: string, o: object) => Promise<unknown>)(k, v, opts)
      },
    } as unknown as DeliveryRedis
    const render = renders()
    const send = sender('sent', 'sent')
    await expect(deliverOnce(failingRecord, { key: KEY, recipient: TO, recordTtlSecs: DAY, render, send })).rejects.toThrow('redis down')
    vi.setSystemTime(new Date(Date.now() + HOUR_MS)) // the next hourly run
    expect(await deliver(r, render, send)).toBe('sent')
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]) // byte-identical retry
  })

  it('Resend accepts, recording fails, the retry comes more than 24 h later: not sent again (ambiguous)', async () => {
    const r = fakeRedis()
    const failingRecord = {
      ...r.redis,
      set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
        if (k === KEY) throw new Error('redis down')
        return (r.redis.set as (k: string, v: string, o: object) => Promise<unknown>)(k, v, opts)
      },
    } as unknown as DeliveryRedis
    const send = sender('sent')
    await expect(deliverOnce(failingRecord, { key: KEY, recipient: TO, recordTtlSecs: 40 * DAY, render: renders(), send })).rejects.toThrow('redis down')
    vi.setSystemTime(new Date(Date.now() + 25 * HOUR_MS)) // e.g. the cron was down for a day
    expect(await deliver(r, renders(), send)).toBe('ambiguous')
    expect(send).toHaveBeenCalledTimes(1) // not sent a second time
    expect(r.value(KEY)).toBe('ambiguous')
    expect(await deliver(r, renders(), send)).toBe('delivered')
  })

  it('an unknown attempt keeps its first time: retried inside the window, given up after it', async () => {
    const r = fakeRedis()
    const send = sender('unknown', 'unknown', 'sent')
    await deliver(r, renders(), send)
    const first = JSON.parse(r.value(`${KEY}:attempt`)!).at
    vi.setSystemTime(new Date(Date.now() + HOUR_MS))
    expect(await deliver(r, renders(), send)).toBe('failed')
    expect(JSON.parse(r.value(`${KEY}:attempt`)!).at).toBe(first)
    vi.setSystemTime(new Date(first + SAFE_RETRY_MS + 1))
    expect(await deliver(r, renders(), send)).toBe('ambiguous')
    expect(send).toHaveBeenCalledTimes(2)
    expect(SAFE_RETRY_MS).toBeLessThan(24 * HOUR_MS) // inside Resend's idempotency window
  })

  it('an unknown attempt is retried to the same recipient; if the address changed, nothing is sent (ambiguous, recorded)', async () => {
    const r = fakeRedis()
    const send = sender('unknown', 'sent')
    expect(await deliver(r, renders(), send)).toBe('failed')
    expect(JSON.parse(r.value(`${KEY}:attempt`)!).to).toBe(TO) // the recipient is kept with the attempt
    vi.setSystemTime(new Date(Date.now() + HOUR_MS))
    // The developer changed their address since: no resend to the old one (under the old key) or the new one
    expect(await deliver(r, renders(), send, 40 * DAY, 'new@example.com')).toBe('ambiguous')
    expect(send).toHaveBeenCalledTimes(1)
    expect(r.value(KEY)).toBe('ambiguous:recipient_changed')
    expect(await deliver(r, renders(), send, 40 * DAY, 'new@example.com')).toBe('delivered')
  })

  it('an unchanged recipient gets the identical retry (recipient, subject and HTML)', async () => {
    const r = fakeRedis()
    const send = sender('unknown', 'sent')
    await deliver(r, renders(), send)
    vi.setSystemTime(new Date(Date.now() + HOUR_MS))
    expect(await deliver(r, renders(), send)).toBe('sent')
    expect(send.mock.calls[1][0]).toEqual({ to: TO, subject: 'S1', html: '<p>1</p>' })
  })

  it('a claim left by a killed run expires, and the retry reuses the payload and key', async () => {
    const r = fakeRedis()
    await r.redis.set(`${KEY}:inflight`, '1', { nx: true, ex: IN_FLIGHT_TTL_SECS })
    const send = sender('sent')
    expect(await deliver(r, renders(), send, DAY)).toBe('busy')
    vi.setSystemTime(new Date(Date.now() + IN_FLIGHT_TTL_SECS * 1000 + 1))
    expect(await deliver(r, renders(), send, DAY)).toBe('sent')
    expect(send).toHaveBeenCalledWith({ to: TO, subject: 'S1', html: '<p>1</p>' }, KEY)
    expect(IN_FLIGHT_TTL_SECS).toBeLessThan(20 * 60) // well under the hour between usage runs
  })
})
