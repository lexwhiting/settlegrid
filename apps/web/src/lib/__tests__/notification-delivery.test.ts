/**
 * deliverOnce: once-per-period delivery that survives failed sends, overlapping runs
 * and a run killed mid-send, never resends after Resend's idempotency window, and
 * resends exactly the first attempt's payload. The Redis double honours NX and EX
 * against a fake clock, like Upstash returns stored JSON parsed, and runs the claim
 * release script (compare-and-delete) as one atomic step.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  deliverOnce, IN_FLIGHT_TTL_SECS, SAFE_RETRY_MS, RELEASE_IF_OWNER, CLEAR_ATTEMPT_IF_OWNER, BEGIN_IF_OWNER,
  type DeliveryRedis, type DeliveryPayload, type SendOutcome,
} from '../notification-delivery'

const VERIFIED_BEGIN_SCRIPT =
  "if redis.call('exists', KEYS[1]) == 1 then return {'delivered'} end " +
  "if redis.call('get', KEYS[2]) ~= ARGV[1] then return {'lost'} end " +
  "local a = redis.call('get', KEYS[3]) if a then return {'existing', a} end " +
  "if ARGV[2] == '' then return {'missing'} end " +
  "redis.call('set', KEYS[3], ARGV[2], 'EX', ARGV[3]) return {'created'}"
const VERIFIED_RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
const VERIFIED_CLEAR_ATTEMPT_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] and redis.call('get', KEYS[2]) == ARGV[2] then return redis.call('del', KEYS[2]) else return 0 end"

function fakeRedis() {
  const data = new Map<string, { value: string; expiresAt: number }>()
  /** Runs once when a claim is released: after a plain read of it, or before the release script. */
  let onRelease: (() => void) | null = null
  const releasing = () => { const f = onRelease; onRelease = null; f?.() }
  /** Runs once when a run looks for the attempt: after a plain read of it, or before the begin script. */
  let onBegin: (() => Promise<void>) | null = null
  const beginning = async () => { const f = onBegin; onBegin = null; await f?.() }
  /** Runs once after the begin script has run, before its answer reaches the caller. */
  let onBegun: (() => Promise<void>) | null = null
  const begun = async () => { const f = onBegun; onBegun = null; await f?.() }
  const parsed = (v: string) => { try { return JSON.parse(v) } catch { return v } }
  const live = (k: string) => {
    const e = data.get(k)
    if (e && e.expiresAt <= Date.now()) data.delete(k)
    return data.get(k)
  }
  const redis = {
    get: async (k: string) => {
      const v = live(k)?.value
      if (k.endsWith(':inflight')) releasing() // the claim changes hands just after this read
      if (k.endsWith(':attempt')) await beginning() // other runs act before this read returns
      if (v === undefined) return null
      return parsed(v)
    },
    set: async (k: string, v: string, opts: { ex: number; nx?: boolean }) => {
      if (opts.nx && live(k)) return null
      data.set(k, { value: v, expiresAt: Date.now() + opts.ex * 1000 })
      return 'OK'
    },
    del: async (k: string) => (data.delete(k) ? 1 : 0),
    eval: async (script: string, keys: string[], args: string[]) => {
      // Only the exact scripts (checked against a real Redis server), whose effect this
      // double reproduces, each as one atomic step as in Redis
      if (script === VERIFIED_BEGIN_SCRIPT) {
        await beginning()
        if (live(keys[0])) return ['delivered']
        if (live(keys[1])?.value !== args[0]) return ['lost']
        const a = live(keys[2])?.value
        if (a !== undefined) return ['existing', parsed(a)] // like Upstash, stored JSON comes back parsed
        if (args[1] === '') return ['missing']
        data.set(keys[2], { value: args[1], expiresAt: Date.now() + Number(args[2]) * 1000 })
        await begun()
        return ['created']
      }
      if (script === VERIFIED_CLEAR_ATTEMPT_SCRIPT) {
        if (live(keys[0])?.value !== args[0] || live(keys[1])?.value !== args[1]) return 0
        data.delete(keys[1])
        return 1
      }
      if (script !== VERIFIED_RELEASE_SCRIPT) throw new Error('unexpected script')
      releasing()
      if (live(keys[0])?.value !== args[0]) return 0
      data.delete(keys[0])
      return 1
    },
  }
  return {
    redis: redis as unknown as DeliveryRedis,
    has: (k: string) => live(k) !== undefined,
    value: (k: string) => live(k)?.value,
    put: (k: string, v: string, ttlSecs: number) => data.set(k, { value: v, expiresAt: Date.now() + ttlSecs * 1000 }),
    whenReleasing: (f: () => void) => { onRelease = f },
    whenBeginning: (f: () => Promise<void>) => { onBegin = f },
    whenBegun: (f: () => Promise<void>) => { onBegun = f },
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

  it('begins, releases its claim and clears a refused attempt with the verified scripts', () => {
    expect(BEGIN_IF_OWNER).toBe(VERIFIED_BEGIN_SCRIPT)
    expect(RELEASE_IF_OWNER).toBe(VERIFIED_RELEASE_SCRIPT)
    expect(CLEAR_ATTEMPT_IF_OWNER).toBe(VERIFIED_CLEAR_ATTEMPT_SCRIPT)
  })

  it("a run whose claim ran out doesn't clear the attempt another run resent: a refusal then keeps it, and after 24 h it is ambiguous, not sent again", async () => {
    const r = fakeRedis()
    // Run A writes the attempt and its send hangs past the claim's 10 minutes
    let refuseA!: () => void
    const sendA = vi.fn((_p: DeliveryPayload, _k: string) => new Promise<SendOutcome>((resolve) => { refuseA = () => resolve('not_sent') }))
    const a = deliver(r, renders(), sendA)
    await vi.waitFor(() => expect(sendA).toHaveBeenCalled())
    vi.setSystemTime(Date.now() + (IN_FLIGHT_TTL_SECS + 60) * 1000)
    // Run B takes the expired claim and resends that attempt: Resend accepts it, but
    // B never learns so (unknown)
    const sendB = sender('unknown')
    expect(await deliver(r, renders(), sendB)).toBe('failed')
    expect(sendB).toHaveBeenCalledWith(sendA.mock.calls[0][0], KEY)
    // A's send is then refused: A no longer holds the claim, so the attempt stays
    refuseA()
    expect(await a).toBe('failed')
    expect(r.has(`${KEY}:attempt`)).toBe(true)
    // More than 24 h later, B's send may have gone out: given up on, not sent again
    vi.setSystemTime(Date.now() + 25 * HOUR_MS)
    const later = sender('sent')
    expect(await deliver(r, renders(), later)).toBe('ambiguous')
    expect(later).not.toHaveBeenCalled()
  })

  it("a run whose claim ran out before it began changes nothing: the other run's attempt keeps its payload and time, and nothing is sent after that attempt's window", async () => {
    const r = fakeRedis()
    const sendB = sender('unknown') // Resend accepted B's email, but B never learned so
    let attemptB: string | undefined
    // Run A takes the claim; before it gets to the attempt, it stalls past its claim
    // and run B takes the claim, makes its attempt and sends it
    r.whenBeginning(async () => {
      vi.setSystemTime(Date.now() + (IN_FLIGHT_TTL_SECS + 60) * 1000)
      expect(await deliver(r, renders(), sendB)).toBe('failed')
      attemptB = r.value(`${KEY}:attempt`)
      // A resumes two hours later
      vi.setSystemTime(Date.now() + 2 * HOUR_MS)
    })
    const renderA = vi.fn((): DeliveryPayload => ({ to: TO, subject: 'A', html: '<p>A</p>' }))
    const sendA = sender('unknown')
    expect(await deliver(r, renderA, sendA)).toBe('busy') // A no longer holds the claim
    expect(sendA).not.toHaveBeenCalled()
    expect(attemptB).toBeDefined()
    expect(r.value(`${KEY}:attempt`)).toBe(attemptB) // B's payload and time, unchanged
    // 24 h 20 min after B's send (22 h 20 min after A resumed): past B's window, so
    // given up on, not sent again
    const bAt = (JSON.parse(attemptB!) as { at: number }).at
    vi.setSystemTime(bAt + 24 * HOUR_MS + 20 * 60 * 1000)
    const later = sender('sent')
    expect(await deliver(r, renders(), later)).toBe('ambiguous')
    expect(later).not.toHaveBeenCalled()
  })

  it("a run whose own new attempt reaches it only after Resend's window sends nothing (another run may have sent it)", async () => {
    const r = fakeRedis()
    const sendB = sender('unknown') // Resend accepted B's resend, but B never learned so
    // A's attempt is stored, but A only hears so 25 h later; meanwhile its claim runs
    // out and run B resends that attempt
    r.whenBegun(async () => {
      vi.setSystemTime(Date.now() + (IN_FLIGHT_TTL_SECS + 60) * 1000)
      expect(await deliver(r, renders(), sendB)).toBe('failed')
      vi.setSystemTime(Date.now() + 25 * HOUR_MS)
    })
    const sendA = sender('sent')
    expect(await deliver(r, renders(), sendA)).toBe('ambiguous')
    expect(sendB).toHaveBeenCalledTimes(1)
    expect(sendA).not.toHaveBeenCalled()
    expect(r.value(KEY)).toBe('ambiguous')
  })

  it("an ambiguous verdict never overwrites a record another run wrote meanwhile", async () => {
    const r = fakeRedis()
    r.whenBegun(async () => {
      vi.setSystemTime(Date.now() + 25 * HOUR_MS)
      r.put(KEY, 'sent', DAY) // another run sent and recorded it
    })
    expect(await deliver(r, renders(), sender('sent'))).toBe('ambiguous')
    expect(r.value(KEY)).toBe('sent')
  })

  it("never deletes a claim that expired and was taken by another run while it was being released", async () => {
    const r = fakeRedis()
    // Our claim runs out and another run takes it, right as this run releases its own
    r.whenReleasing(() => {
      vi.setSystemTime(Date.now() + (IN_FLIGHT_TTL_SECS + 1) * 1000)
      expect(r.has(`${KEY}:inflight`)).toBe(false) // expired
      r.put(`${KEY}:inflight`, 'replacement-run', IN_FLIGHT_TTL_SECS)
    })
    expect(await deliver(r, renders(), sender('unknown'), DAY)).toBe('failed')
    // The replacement run's claim survives, so a third run stays out while it sends
    expect(r.value(`${KEY}:inflight`)).toBe('replacement-run')
    const third = sender('sent')
    expect(await deliver(r, renders(), third, DAY)).toBe('busy')
    expect(third).not.toHaveBeenCalled()
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
