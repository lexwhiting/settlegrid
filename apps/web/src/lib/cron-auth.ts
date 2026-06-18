import { timingSafeEqual, createHash } from 'node:crypto'
import { getCronSecret } from '@/lib/env'

// DC-11: cap the untrusted header BEFORE hashing. The cap is a CONSTANT — it leaks
// nothing about the secret (unlike a length-vs-secret pre-check). Platform header
// limits (~16KB) already bound this; the cap is explicit defense-in-depth.
const MAX_AUTH_HEADER_LEN = 4096

export type CronAuthResult = 'ok' | 'no-secret' | 'unauthorized'

// SHA-256 both operands to fixed 32-byte digests so timingSafeEqual never throws on a
// length mismatch (RangeError) AND the byte-length side-channel is gone. Plain SHA-256
// (NOT HMAC): used only to equalize length for a constant-time EQUALITY check, never as
// a MAC — do not "upgrade" this to HMAC.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Constant-time CRON_SECRET bearer check. Returns an enum; the CALLER owns the
 *  response + logging (so each route preserves its existing contract). Never throws. */
export function verifyCronAuth(headers: Headers): CronAuthResult {
  const secret = getCronSecret()?.trim()
  if (!secret) return 'no-secret' // unset/empty/whitespace-only → fail-closed (DC-08)
  const raw = headers.get('authorization') ?? '' // '' on missing header → 'unauthorized', never null→throw
  if (raw.length > MAX_AUTH_HEADER_LEN) return 'unauthorized'
  const authHeader = raw.trim() // SYMMETRIC trim (see handoff §5 LB note) — no Vercel lockout
  return safeEqual(authHeader, `Bearer ${secret}`) ? 'ok' : 'unauthorized'
}
