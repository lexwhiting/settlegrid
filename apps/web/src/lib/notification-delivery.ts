/**
 * Once-per-period delivery of a notification email, safe across overlapping runs,
 * failed sends and a run that dies mid-send. Keys:
 * - `key`, the record: set once the email was sent, the developer opted out, or the
 *   delivery was given up as 'ambiguous'. A failed send is retried by a later run.
 * - `${key}:inflight`, a 10-minute claim (SET NX, a random token), so two runs can't
 *   send at once; a killed run's claim expires. Every write that decides whether an
 *   email is sent is one atomic Lua script that checks the claim is still this run's:
 *   beginning (store or read the attempt), releasing the claim and clearing a refused
 *   attempt. A run whose claim ran out changes nothing.
 * - `${key}:attempt`, the first attempt that may have reached Resend: its time and the
 *   exact recipient, subject and HTML. Never replaced, so its time is never later
 *   than its first send. Every send of it uses `key` as Resend's Idempotency-Key,
 *   which Resend honours for 24 hours, and none goes out once it is SAFE_RETRY_MS old
 *   (recorded 'ambiguous', for the caller to log). A changed recipient is never sent
 *   to either address ('ambiguous'). A provable refusal (`not_sent`) clears the
 *   attempt it started, so a run of refusals (a bad API key) is simply retried.
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { SendEmailResult } from '@/lib/email'

/** The subset of the Upstash client used here. */
export type DeliveryRedis = Pick<Redis, 'get' | 'set' | 'del' | 'eval'>

export interface DeliveryPayload {
  /** The recipient address, kept with the attempt so a retry is identical. */
  to: string
  subject: string
  html: string
}

/** What a send reports: the email's fate, or that the developer opted out. */
export type SendOutcome = 'opted_out' | SendEmailResult

/**
 * - `sent` / `opted_out`: done (recorded).
 * - `failed`: not sent this time, or not known to be; a later run retries it.
 * - `delivered`: already sent, opted out or given up earlier.
 * - `busy`: another run is sending it.
 * - `ambiguous`: an earlier attempt's outcome is unknown and Resend's idempotency
 *   window has passed, so it is not sent again (recorded; the caller logs it).
 */
export type DeliveryResult = 'sent' | 'opted_out' | 'failed' | 'delivered' | 'busy' | 'ambiguous'

/** Long enough for one send; shorter than the gap between runs. */
export const IN_FLIGHT_TTL_SECS = 10 * 60

/**
 * Starts a delivery, atomically, only while the claim is still this run's. KEYS: the
 * record, the claim, the attempt; ARGV: the token, a freshly built attempt ('' if none
 * was built), its TTL.
 * - `{'delivered'}`: already recorded;
 * - `{'lost'}`: the claim is no longer this run's (it ran out): nothing is changed;
 * - `{'existing', attempt}`: an earlier attempt, to resend exactly (never replaced);
 * - `{'missing'}`: no attempt, and none was given: build one and begin again;
 * - `{'created'}`: no attempt existed, so this run's is stored.
 */
export const BEGIN_IF_OWNER =
  "if redis.call('exists', KEYS[1]) == 1 then return {'delivered'} end " +
  "if redis.call('get', KEYS[2]) ~= ARGV[1] then return {'lost'} end " +
  "local a = redis.call('get', KEYS[3]) if a then return {'existing', a} end " +
  "if ARGV[2] == '' then return {'missing'} end " +
  "redis.call('set', KEYS[3], ARGV[2], 'EX', ARGV[3]) return {'created'}"

/** Deletes KEYS[1] only if it still holds ARGV[1] (this run's token), atomically. */
export const RELEASE_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

/**
 * Deletes KEYS[2] (the attempt) only if KEYS[1] (the claim) still holds ARGV[1] (this
 * run's token) and KEYS[2] still holds ARGV[2] (the attempt this run wrote), atomically.
 */
export const CLEAR_ATTEMPT_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] and redis.call('get', KEYS[2]) == ARGV[2] then return redis.call('del', KEYS[2]) else return 0 end"

/** Retries reuse the idempotency key only inside Resend's 24 h window, with an hour's margin. */
export const SAFE_RETRY_MS = 23 * 60 * 60 * 1000

interface Attempt extends DeliveryPayload {
  at: number
}

/** Upstash returns stored JSON already parsed; other clients return the string. */
function parsedAttempt(raw: unknown): Attempt | null {
  if (raw == null) return null
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw
  const a = value as Partial<Attempt> | null
  return a && typeof a === 'object' && typeof a.at === 'number' && typeof a.to === 'string' && typeof a.subject === 'string' && typeof a.html === 'string'
    ? (a as Attempt)
    : null
}

export async function deliverOnce(
  redis: DeliveryRedis,
  opts: {
    key: string
    /** How long the result is remembered (the period, plus a margin). */
    recordTtlSecs: number
    /** The developer's current address: a retry to a different one is not sent. */
    recipient: string
    /** Builds the email; used only when there is no earlier attempt to resend. */
    render: () => DeliveryPayload
    /** Sends `payload` with the given Resend idempotency key. Should not throw. */
    send: (payload: DeliveryPayload, idempotencyKey: string) => Promise<SendOutcome>
  },
): Promise<DeliveryResult> {
  if (await redis.get(opts.key)) return 'delivered'

  const inFlight = `${opts.key}:inflight`
  const token = randomUUID()
  const claimed = await redis.set(inFlight, token, { nx: true, ex: IN_FLIGHT_TTL_SECS })
  if (claimed === null) return 'busy'

  try {
    // One atomic step, only while the claim is still ours: re-check the record, then
    // reuse the stored attempt or store ours (BEGIN_IF_OWNER)
    const attemptKey = `${opts.key}:attempt`
    const build = (): Attempt => ({ at: Date.now(), ...opts.render() })
    const begin = async (attemptJson: string) => (await redis.eval(
      BEGIN_IF_OWNER,
      [opts.key, inFlight, attemptKey],
      [token, attemptJson, String(opts.recordTtlSecs)],
    )) as [string, unknown?]
    // The email is built only if there is no earlier attempt to resend (a hint; the
    // begin step decides)
    let fresh = (await redis.get(attemptKey)) == null ? build() : null
    let begun = await begin(fresh ? JSON.stringify(fresh) : '')
    if (begun[0] === 'missing') {
      fresh = build()
      begun = await begin(JSON.stringify(fresh))
    }
    if (begun[0] === 'delivered') return 'delivered'
    if (begun[0] === 'lost') return 'busy' // another run holds (or will take) the claim

    let attempt: Attempt
    let startedHere: string | null = null // the attempt as written, if written by this run
    if (begun[0] === 'created' && fresh) {
      attempt = fresh
      startedHere = JSON.stringify(fresh)
    } else {
      const stored = parsedAttempt(begun[1])
      if (!stored) throw new Error(`deliverOnce: unreadable attempt for ${opts.key}`)
      attempt = stored
      if (attempt.to !== opts.recipient) {
        await redis.set(opts.key, 'ambiguous:recipient_changed', { ex: opts.recordTtlSecs, nx: true })
        return 'ambiguous'
      }
    }

    // Never send past Resend's window for the attempt's first possible send, whichever
    // run stored it: this run's own may have waited since (another run may have sent it
    // meanwhile). The record is written only if none exists, so a 'sent' stays.
    if (Date.now() - attempt.at > SAFE_RETRY_MS) {
      await redis.set(opts.key, 'ambiguous', { ex: opts.recordTtlSecs, nx: true })
      return 'ambiguous'
    }

    const outcome = await opts.send({ to: attempt.to, subject: attempt.subject, html: attempt.html }, opts.key)
    if (outcome === 'sent' || outcome === 'opted_out') {
      // Safe whoever holds the claim now: the record stops every later send
      await redis.set(opts.key, outcome, { ex: opts.recordTtlSecs })
      await redis.del(attemptKey)
      return outcome
    }
    // Refused outright: nothing went out on this attempt. Forget it if it started here,
    // so a long run of refusals is retried rather than given up on; but only while this
    // run still holds its claim (another run may have resent it after the claim ran out).
    if (outcome === 'not_sent' && startedHere !== null) {
      await redis.eval(CLEAR_ATTEMPT_IF_OWNER, [inFlight, attemptKey], [token, startedHere])
    }
    return 'failed'
  } finally {
    // Released whatever happened, only if still ours; a later run retries what failed
    try {
      await redis.eval(RELEASE_IF_OWNER, [inFlight], [token])
    } catch {
      // The claim expires on its own
    }
  }
}
