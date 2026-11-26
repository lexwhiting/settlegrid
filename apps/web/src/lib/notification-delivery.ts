/**
 * Once-per-period delivery of a notification email, safe across overlapping runs,
 * failed sends and a run that dies mid-send.
 *
 * - `key` records the result: set only once the email was sent or the developer
 *   opted out, so a failed send is tried again by a later run.
 * - `${key}:inflight` is a short claim taken (SET NX) before sending, so two runs
 *   can't send at once. It holds a token, and a run releases only its own claim, in
 *   one atomic compare-and-delete (a Lua script): a claim that expired and was taken
 *   by another run is never deleted by the first. It expires on its own (10 minutes),
 *   so a run killed between claiming and recording (a timeout, a crash) doesn't block
 *   the next run. Should a run outlive its claim, a second run finds the stored attempt
 *   and resends it with the same Idempotency-Key, which Resend doesn't send twice.
 * - `${key}:attempt` keeps the first attempt that may have reached Resend: its time
 *   and the exact recipient, subject and HTML. A retry resends that same request with
 *   `key` as Resend's Idempotency-Key, which Resend honours for 24 hours: if an
 *   earlier attempt got the email out, the retry is not sent again.
 * - If the developer's address has changed since such an attempt, the retry is not
 *   sent at all (neither to the old address under the old key nor to the new one):
 *   the earlier email may have reached the old address. It is recorded as
 *   'ambiguous' and the caller logs it for reconciliation.
 * - A send Resend provably refused (`not_sent`) clears the attempt it started, so a
 *   long run of refusals (a bad API key) is simply retried. It is cleared only in one
 *   atomic step that checks the run still holds its claim and the attempt is the one
 *   it wrote: if the claim ran out meanwhile, another run may have resent that attempt
 *   with an unknown outcome, so the attempt stays. An attempt whose outcome
 *   is unknown (`unknown`, a throw, a killed run) stays. Retries go ahead only while
 *   it is under SAFE_RETRY_MS old, inside Resend's window. After that the delivery is
 *   recorded as 'ambiguous' and never sent again: the caller logs it for
 *   reconciliation rather than risk a second email. Callers run hourly or more often,
 *   so a retry normally lands well inside the window.
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
    /** Builds the email; called only when there is no earlier attempt to resend. */
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
    // Another run may have sent and recorded it between the check above and the claim
    if (await redis.get(opts.key)) return 'delivered'

    const attemptKey = `${opts.key}:attempt`
    let attempt = parsedAttempt(await redis.get(attemptKey))
    let startedHere: string | null = null // the attempt as written, if written by this run
    if (attempt) {
      if (Date.now() - attempt.at > SAFE_RETRY_MS) {
        await redis.set(opts.key, 'ambiguous', { ex: opts.recordTtlSecs })
        return 'ambiguous'
      }
      if (attempt.to !== opts.recipient) {
        await redis.set(opts.key, 'ambiguous:recipient_changed', { ex: opts.recordTtlSecs })
        return 'ambiguous'
      }
    } else {
      attempt = { at: Date.now(), ...opts.render() }
      startedHere = JSON.stringify(attempt)
      await redis.set(attemptKey, startedHere, { ex: opts.recordTtlSecs })
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
    // Released whatever happened (only if still ours): a failed send is retried by
    // the next run, and a sent one is recorded above (or, if recording threw, a retry
    // inside the window resends the same payload and key, which Resend doesn't send
    // again).
    try {
      await redis.eval(RELEASE_IF_OWNER, [inFlight], [token])
    } catch {
      // The claim expires on its own
    }
  }
}
