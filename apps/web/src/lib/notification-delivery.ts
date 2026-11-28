/**
 * At-most-once delivery of a notification email per key (for example one warning per
 * level and month): never sent twice, whatever runs overlap, stall or die.
 *
 * `key` is both the record and the lock. A run takes it before sending, in one atomic
 * `SET NX` holding `sending:<token>:<time>`, so no other run can send while it exists.
 * Afterwards, in one compare-and-set on its own token:
 * - sent or opted out: the record becomes `sent` / `opted_out`;
 * - provably refused by Resend (`not_sent`): nothing went out, so the key is deleted
 *   and a later run tries again;
 * - unknown (a 5xx, timeout, network error or throw): it may have gone out, so it is
 *   recorded `ambiguous` and never sent again; the caller logs it.
 * A run killed mid-send leaves `sending:…`; once that is STALE_SENDING_MS old, the next
 * run turns it into `ambiguous` (once, by compare-and-set), so it is logged too. A run
 * that resumes after that finds its token gone and changes nothing.
 *
 * The key is also sent as Resend's Idempotency-Key, which Resend honours for 24 hours.
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import type { SendEmailResult } from '@/lib/email'

/** The subset of the Upstash client used here. */
export type DeliveryRedis = Pick<Redis, 'get' | 'set' | 'eval'>

export interface DeliveryPayload {
  to: string
  subject: string
  html: string
}

/** What a send reports: the email's fate, or that the developer opted out. */
export type SendOutcome = 'opted_out' | SendEmailResult

/**
 * - `sent` / `opted_out`: done (recorded).
 * - `failed`: Resend refused it, nothing went out; a later run tries again.
 * - `delivered`: already sent, opted out or given up earlier.
 * - `busy`: another run is sending it.
 * - `ambiguous`: it may or may not have gone out; recorded, never sent again (log it).
 */
export type DeliveryResult = 'sent' | 'opted_out' | 'failed' | 'delivered' | 'busy' | 'ambiguous'

/** A `sending` mark older than this belongs to a run that died (runs last seconds). */
export const STALE_SENDING_MS = 60 * 60 * 1000

/** Sets KEYS[1] to ARGV[2] (TTL ARGV[3]) only if it still holds ARGV[1], atomically. */
export const SET_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 else return 0 end"

/** Deletes KEYS[1] only if it still holds ARGV[1], atomically. */
export const DELETE_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

export async function deliverOnce(
  redis: DeliveryRedis,
  opts: {
    key: string
    /** How long the record is kept (the period, plus a margin). */
    recordTtlSecs: number
    render: () => DeliveryPayload
    /** Sends `payload` with the given Resend idempotency key. */
    send: (payload: DeliveryPayload, idempotencyKey: string) => Promise<SendOutcome>
  },
): Promise<DeliveryResult> {
  const ttl = String(opts.recordTtlSecs)
  const payload = opts.render() // before taking the key: a failure here claims nothing
  const mark = `sending:${randomUUID()}:${Date.now()}`
  if ((await redis.set(opts.key, mark, { nx: true, ex: opts.recordTtlSecs })) === null) {
    const current = await redis.get<string>(opts.key)
    const since = typeof current === 'string' && current.startsWith('sending:') ? Number(current.split(':')[2]) : NaN
    if (Number.isNaN(since)) return 'delivered'
    if (Date.now() - since <= STALE_SENDING_MS) return 'busy'
    // A run that died mid-send: given up once, so it is logged
    const taken = await redis.eval(SET_IF_OWNER, [opts.key], [current as string, 'ambiguous', ttl])
    return taken === 1 ? 'ambiguous' : 'busy'
  }

  let outcome: SendOutcome
  try {
    outcome = await opts.send(payload, opts.key)
  } catch (err) {
    await redis.eval(SET_IF_OWNER, [opts.key], [mark, 'ambiguous', ttl])
    throw err
  }
  if (outcome === 'not_sent') {
    await redis.eval(DELETE_IF_OWNER, [opts.key], [mark])
    return 'failed'
  }
  const final = outcome === 'unknown' ? 'ambiguous' : outcome
  await redis.eval(SET_IF_OWNER, [opts.key], [mark, final, ttl])
  return final
}
