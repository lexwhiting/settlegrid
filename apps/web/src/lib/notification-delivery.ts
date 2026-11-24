/**
 * Once-per-period delivery of a notification email, safe across overlapping runs,
 * failed sends and a run that dies mid-send.
 *
 * - `key` records the result: set only once the email was sent or the developer
 *   opted out, so a failed send is tried again by a later run.
 * - `${key}:inflight` is a short claim taken (SET NX) before sending, so two runs
 *   can't send at once. It holds a token, and a run releases only its own claim. It
 *   expires on its own (10 minutes, far longer than a run's 60 s limit), so a run
 *   killed between claiming and recording (a timeout, a crash) doesn't block the
 *   next run.
 * - The send carries `key` as Resend's Idempotency-Key, which Resend honours for 24
 *   hours: a retry within that window is not sent again if an earlier attempt got the
 *   email out.
 * - `${key}:attempt` keeps the time of the first attempt. If a send failed, threw or
 *   was cut off, its outcome is unknown (Resend may have accepted it). Retries go
 *   ahead only while the first attempt is under SAFE_RETRY_MS old, inside Resend's
 *   window. After that, the delivery is recorded as 'ambiguous' and never sent again:
 *   the caller logs it for reconciliation rather than risk a second email. Callers run
 *   often (hourly or more), so a retry normally lands well inside the window.
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { NotificationOutcome } from '@/lib/notifications'

/** The subset of the Upstash client used here. */
export type DeliveryRedis = Pick<Redis, 'get' | 'set' | 'del'>

/**
 * `delivered`: already sent, opted out or given up earlier; `busy`: another run is
 * sending it; `ambiguous`: an earlier attempt's outcome is unknown and Resend's
 * idempotency window has passed, so it is not sent again (logged by the caller).
 */
export type DeliveryResult = NotificationOutcome | 'delivered' | 'busy' | 'ambiguous'

/** Long enough for one send; shorter than the gap between runs. */
export const IN_FLIGHT_TTL_SECS = 10 * 60

/** Retries reuse the idempotency key only inside Resend's 24 h window, with an hour's margin. */
export const SAFE_RETRY_MS = 23 * 60 * 60 * 1000

export async function deliverOnce(
  redis: DeliveryRedis,
  opts: {
    key: string
    /** How long the result is remembered (the period, plus a margin). */
    recordTtlSecs: number
    /** Sends the email with the given Resend idempotency key. Should not throw. */
    send: (idempotencyKey: string) => Promise<NotificationOutcome>
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
    const firstAttempt = await redis.get(attemptKey)
    if (firstAttempt != null) {
      // An earlier attempt failed, threw or was cut off: it may have been accepted
      if (Date.now() - Number(firstAttempt) > SAFE_RETRY_MS) {
        await redis.set(opts.key, 'ambiguous', { ex: opts.recordTtlSecs })
        return 'ambiguous'
      }
    } else {
      await redis.set(attemptKey, String(Date.now()), { ex: opts.recordTtlSecs })
    }

    const outcome = await opts.send(opts.key)
    if (outcome !== 'failed') {
      await redis.set(opts.key, outcome, { ex: opts.recordTtlSecs })
      await redis.del(attemptKey)
    }
    return outcome
  } finally {
    // Released whatever happened (only if still ours): a failed send is retried by
    // the next run, and a sent one is recorded above (or, if recording threw, a retry
    // inside the window reuses the idempotency key and Resend doesn't send it again).
    try {
      if ((await redis.get(inFlight)) === token) await redis.del(inFlight)
    } catch {
      // The claim expires on its own
    }
  }
}
