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
 * - The send carries `key` as Resend's Idempotency-Key: if a killed run did get the
 *   email out, a retry within 24 hours with the same payload is not sent again.
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { NotificationOutcome } from '@/lib/notifications'

/** The subset of the Upstash client used here. */
export type DeliveryRedis = Pick<Redis, 'get' | 'set' | 'del'>

/** `delivered`: already sent or opted out earlier; `busy`: another run is sending it. */
export type DeliveryResult = NotificationOutcome | 'delivered' | 'busy'

/** Long enough for one send; shorter than the gap between runs. */
export const IN_FLIGHT_TTL_SECS = 10 * 60

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

  let outcome: NotificationOutcome = 'failed'
  try {
    // Another run may have sent and recorded it between the check above and the claim
    if (await redis.get(opts.key)) return 'delivered'
    outcome = await opts.send(opts.key)
    if (outcome !== 'failed') {
      await redis.set(opts.key, outcome, { ex: opts.recordTtlSecs })
    }
    return outcome
  } finally {
    // Released whatever happened (only if still ours): a failed send is retried by
    // the next run, and a sent one is recorded above (or, if recording threw, the
    // retry reuses the idempotency key and Resend doesn't send it again).
    try {
      if ((await redis.get(inFlight)) === token) await redis.del(inFlight)
    } catch {
      // The claim expires on its own
    }
  }
}
