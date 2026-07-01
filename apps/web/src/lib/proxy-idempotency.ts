import { createHash } from 'crypto'
import { getRedis, tryRedis } from './redis'

/**
 * Charge-idempotency gate for the metered proxy money rail (launch-gate G3-3).
 *
 * A client whose metered proxy call times out on THEIR side (while SettleGrid's
 * upstream still returned 2xx) and retries would otherwise run a fresh charge —
 * the consumer is debited twice for one logical request. This gate lets a
 * duplicate be detected BEFORE the debit (and before the upstream forward, so a
 * non-idempotent upstream is not re-executed either) so the money moves at most
 * once per logical request within the retry window.
 *
 * Guards the CHARGE (the atomic CAS debit in proxy/[slug]/route.ts), NOT the
 * fire-and-forget `invocations` record — that record is not where money moves
 * (LBD-1). A single claim placed before the cache check governs all three
 * debiting paths (cache-hit, main, SLA-failover) (FOLD 1).
 *
 * Store = Redis short-TTL `SET NX EX` (self-expiring, no schema migration),
 * mirroring the circle-nano settle lock shape (settle.ts:326-332) but with a
 * TRI-STATE result so a Redis outage is NOT mistaken for a duplicate.
 */

/** Retry window the gate covers (FOLD 5). Agent HTTP read-timeouts default to
 * 30/60/120s; SettleGrid always responds within maxDuration=90s. A 120s TTL
 * covers common timeouts; bounded above by the false-dedup / poll-collapse cost.
 *
 * LOAD-BEARING INVARIANT (③ F2): this MUST stay strictly greater than the proxy
 * route's `maxDuration` (90s, proxy/[slug]/route.ts). A winner holds its key for
 * this TTL and, because a request can never run longer than maxDuration, it
 * always reaches its release (at a no-charge exit) before its own claim could
 * expire and be re-won by a concurrent retry. If TTL ≤ maxDuration a slow winner
 * could `del` a key a retry already re-claimed → double-charge. Do not lower
 * below maxDuration without switching releaseCharge to a fencing-token
 * compare-and-del (store the requestId, delete only if it still matches). */
export const CHARGE_IDEM_TTL_SECONDS = 120

/** Universal namespace prefix for the charge-dedup keys (FOLD 8). */
const KEY_PREFIX = 'idem:charge:'

/**
 * - `'won'`         → the SET NX succeeded → this request owns the charge; proceed.
 * - `'duplicate'`   → the key is already held → a logically-identical charge is
 *                     in-flight or recently settled → skip the debit + forward.
 * - `'unavailable'` → Redis is down (tryRedis returned null) → the caller decides
 *                     the fail direction (route.ts fails OPEN + alerts, FOLD 3).
 */
export type ChargeClaimResult = 'won' | 'duplicate' | 'unavailable'

/**
 * Builds the namespaced Redis key that gates a single logical charge (FOLD 4).
 *
 * - `clientKey` (an explicit `Idempotency-Key` header) is preferred when present —
 *   the client declares "this is the same logical request". It is UNTRUSTED input,
 *   so it is scoped to the consumer AND the tool, then hashed: a hostile value
 *   cannot escape the namespace or collide with another consumer's key, and the
 *   same key sent to two DIFFERENT tools does not collapse (the money rail is
 *   per-tool — collapsing would skip the 2nd tool's debit AND forward, mis-serving
 *   a genuinely different request). The key intentionally ignores method/body so a
 *   retrier that reuses the key is deduped even if it varies the body.
 * - Otherwise a server-derived key from the request identity closes live retries
 *   today (no caller sends a header yet, F9). `bodyHash` is
 *   `hashBody(method + requestBody)` computed by the caller so we reuse the body
 *   already captured for the cache key and never re-read the request stream.
 */
export function chargeIdemKey(params: {
  consumerId: string
  toolId: string
  method: string
  bodyHash: string
  clientKey?: string | null
}): string {
  const { consumerId, toolId, method, bodyHash, clientKey } = params
  const material = clientKey
    ? `${consumerId}:${toolId}:hdr:${clientKey}`
    : `${consumerId}:${toolId}:${method}:${bodyHash}`
  return KEY_PREFIX + createHash('sha256').update(material).digest('hex')
}

/**
 * Atomically claim the charge key. Mirrors the circle-nano lock (settle.ts:327)
 * but disambiguates Redis-down from duplicate (FOLD 2): `getRedis().set(k,'1',
 * {nx:true})` returns `'OK'` (won) or `null` (key exists = duplicate), while
 * `tryRedis` ALSO returns `null` on a Redis outage — so the `=== 'OK'` compare is
 * computed INSIDE the closure, and only a `tryRedis`-null (outage) surfaces as
 * `'unavailable'`. A 2-state helper that mapped `null → duplicate` would dedup
 * EVERY request during an outage; `null → won` would double-charge every retry.
 */
export async function claimCharge(
  key: string,
  ttlSec: number
): Promise<ChargeClaimResult> {
  const won = await tryRedis(async () => {
    const res = await getRedis().set(key, '1', { nx: true, ex: ttlSec })
    return res === 'OK'
  })
  if (won === null) return 'unavailable'
  return won ? 'won' : 'duplicate'
}

/**
 * Release a claimed key so a legitimate later retry can charge (FOLD 6 / DC-06).
 * Called ONLY at known no-charge exits (upstream error, SSRF block,
 * non-2xx-without-failover, pre-debit returns) — NEVER on a successful charge
 * (that would re-open the double-charge) and NEVER on a debit-time CAS-miss
 * (accept the TTL-bounded missed charge). Best-effort: a Redis outage here just
 * leaves the key to self-expire at the TTL.
 */
export async function releaseCharge(key: string): Promise<void> {
  await tryRedis(() => getRedis().del(key))
}
