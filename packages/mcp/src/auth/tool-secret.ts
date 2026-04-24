/**
 * P3.K4 — Tool-secret rotation + HMAC webhook signing.
 *
 * ## Naming disambiguation (spec-diff F5)
 *
 * The P3.K4 spec card refers to a `tool_secret` that the kernel
 * uses to HMAC-sign settlement webhooks. This is DISTINCT from the
 * existing `config.toolSecret` field on the kernel config
 * (packages/mcp/src/config.ts + kernel.ts line ~413), which is an
 * outbound Bearer token sent to the facilitator over HTTPS.
 *
 *   - `config.toolSecret`     — outbound Bearer auth credential;
 *                              used as `Authorization: Bearer <secret>`
 *                              when the kernel POSTs to the
 *                              facilitator's verify/settle endpoints.
 *   - This module's secret    — HMAC signing key for OUTBOUND
 *                              settlement webhooks the kernel sends
 *                              to the developer's settlement endpoint.
 *                              NEVER sent in plaintext (spec
 *                              requirement: "the kernel never sends
 *                              the secret in plaintext after
 *                              creation").
 *
 * The two could in principle share a value but carry different
 * lifetimes + usage surface; a future consolidation would rename
 * `config.toolSecret` → `config.facilitatorBearer` to remove the
 * collision. That rename is out of scope for P3.K4 (would require
 * migrating every existing caller that reads `config.toolSecret`).
 *
 * ## Summary
 *
 * Every developer's tool receives a long-lived `tool_secret` at
 * provisioning. SettleGrid HMAC-signs every outbound settlement
 * webhook with this secret; the developer's server verifies the
 * signature via {@link verifyPayloadSignature} (or the higher-level
 * `verifyWebhook` helper in the SDK).
 *
 * On rotation, the old secret stays valid for ≤60 seconds so in-
 * flight webhooks signed before the rotation still verify. After the
 * grace window elapses, only the new current secret is accepted —
 * this bounds the blast radius of a leaked old secret to at most
 * 60 seconds of residual acceptance.
 *
 * Signature format (Stripe-style, proven):
 *
 *   X-SettleGrid-Signature: t=<unix-seconds>,v1=<hex-hmac>
 *
 * Signing string: `${timestamp}.${raw-request-body}`
 * Algorithm:      HMAC-SHA256 with the tool secret
 * Encoding:       lowercase hex
 *
 * Hostile-review invariants:
 *   - `verifyPayloadSignature` uses {@link timingSafeEqual} on
 *     equal-length Buffers; length mismatch short-circuits false
 *     BEFORE any byte comparison so an attacker cannot use response
 *     timing to probe signature length.
 *   - Rotation grace is hard-coded at {@link ROTATION_GRACE_SEC};
 *     the card requires ≤60s.
 *   - Secrets are generated via `crypto.randomBytes(32)` — 256 bits
 *     of entropy, well above any HMAC brute-force bound.
 *   - Never log the raw secret; internal error messages redact via
 *     length-only signals when a mismatch is logged.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// ─── Constants ───────────────────────────────────────────────────────

/** Raw secret length in bytes (256 bits). */
export const TOOL_SECRET_BYTES = 32

/** Hex-encoded secret length (TOOL_SECRET_BYTES * 2). */
export const TOOL_SECRET_HEX_LENGTH = TOOL_SECRET_BYTES * 2

/** Signature version prefix. Hard-coded so a downgrade attack (attacker
 * substitutes `v0=<weaker-hash>`) cannot trick a lenient parser. */
export const SIGNATURE_VERSION = 'v1' as const

/** Clock skew tolerance for webhook verification — default 5 minutes.
 * Matches Stripe's default so operators moving from Stripe Connect
 * webhook handling have a familiar knob. */
export const DEFAULT_TIMESTAMP_TOLERANCE_SEC = 5 * 60

/**
 * Maximum FUTURE skew accepted at verify time — hard-coded at 5
 * seconds regardless of `toleranceSec`. Hostile fix H18: without
 * this, a caller who signed with a future timestamp (override)
 * could extend the valid-verification window by the full
 * `toleranceSec` ahead of `now`. Real clock skew between a
 * caller and verifier is typically milliseconds; 5 seconds is
 * generous headroom for NTP-desynced servers while still bounding
 * the forgery window.
 */
export const MAX_FUTURE_SKEW_SEC = 5

/** Rotation grace period — ≤60 seconds per the P3.K4 hostile-review
 * requirement (c). An old secret remains valid for AT MOST this long
 * after a rotation so the blast radius of a leaked old secret is
 * bounded. */
export const ROTATION_GRACE_SEC = 60

/** Max length of the raw signature header we'll accept. A realistic
 * header is `t=<10 digits>,v1=<64 hex>` = ~80 chars; capping at 512
 * defends against a caller parsing an adversarial multi-MB header
 * string through our split-heavy parser. */
const SIGNATURE_HEADER_MAX_CHARS = 512

// ─── Public types ────────────────────────────────────────────────────

/**
 * Rotation state. A tool has a `current` secret, optionally a
 * `previous` one that is still valid during the grace window, and a
 * `rotatedAt` timestamp (seconds since epoch) marking when the
 * rotation happened.
 */
export interface ToolSecretState {
  current: string
  previous?: string
  /** Unix seconds; 0/undefined before any rotation. */
  rotatedAt?: number
}

/**
 * Output of {@link signPayload}. The `header` field is ready to drop
 * into `X-SettleGrid-Signature`; the individual pieces are exposed
 * for callers that need them separately (tests, custom transports).
 */
export interface SignedPayload {
  /** Full signature header value — `t=<t>,v1=<sig>`. */
  header: string
  /** Unix seconds at signing time. */
  timestamp: number
  /** Lowercase hex HMAC-SHA256 of `${timestamp}.${payload}`. */
  signature: string
}

/** Options accepted by the sign/verify helpers. */
export interface SignOptions {
  /** Override the signing timestamp. Defaults to `Date.now() / 1000 | 0`. */
  timestamp?: number
}

export interface VerifyOptions {
  /** Skew tolerance in seconds. Defaults to {@link DEFAULT_TIMESTAMP_TOLERANCE_SEC}. */
  toleranceSec?: number
  /** Clock override for tests. Returns unix seconds. */
  clock?: () => number
}

// ─── Public functions ────────────────────────────────────────────────

/**
 * Generate a cryptographically-random tool secret. 32 bytes
 * (256 bits) hex-encoded — 64 chars, `[0-9a-f]`.
 */
export function generateToolSecret(): string {
  return randomBytes(TOOL_SECRET_BYTES).toString('hex')
}

/**
 * True iff `candidate` is a plausibly-shaped tool secret: exactly
 * {@link TOOL_SECRET_HEX_LENGTH} lowercase hex characters. Callers
 * validating input (e.g., admin endpoints that accept rotated
 * secrets from the operator) should call this before persisting.
 */
export function isValidToolSecretShape(candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' &&
    candidate.length === TOOL_SECRET_HEX_LENGTH &&
    /^[0-9a-f]+$/.test(candidate)
  )
}

/**
 * HMAC-sign an outbound webhook payload. `payload` is the RAW request
 * body (byte-for-byte what the receiver will read) — NOT the parsed
 * JSON. Clients that serialize differently on the send/verify sides
 * will produce signatures that don't match, so the caller MUST feed
 * the same bytes to both sides.
 */
export function signPayload(
  payload: string,
  secret: string,
  opts: SignOptions = {},
): SignedPayload {
  requireSecret(secret, 'secret')
  if (typeof payload !== 'string') {
    throw new TypeError('signPayload: `payload` must be a string.')
  }
  const timestamp = opts.timestamp ?? nowUnixSec()
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new RangeError(
      `signPayload: \`timestamp\` must be a non-negative integer (unix seconds); got ${JSON.stringify(
        timestamp,
      )}.`,
    )
  }
  const signature = hmacHex(secret, `${timestamp}.${payload}`)
  const header = `t=${timestamp},${SIGNATURE_VERSION}=${signature}`
  return { header, timestamp, signature }
}

/**
 * Verify a signature against a payload. `header` is the raw value of
 * the `X-SettleGrid-Signature` header — we parse `t=<ts>,v1=<hex>`
 * ourselves to avoid trust assumptions about the transport layer.
 *
 * Returns `true` only if ALL of:
 *   - the header parses as `t=<int>,v1=<hex>`
 *   - `|now - t|` is within `toleranceSec` (replay protection)
 *   - `timingSafeEqual(expected, provided)` is true
 *
 * All false returns are indistinguishable to the caller — we never
 * reveal WHICH check failed, because a phased-failure oracle leaks
 * information to an attacker probing for valid signatures.
 */
export function verifyPayloadSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  opts: VerifyOptions = {},
): boolean {
  if (typeof payload !== 'string') return false
  if (typeof header !== 'string' || header.length === 0) return false
  if (header.length > SIGNATURE_HEADER_MAX_CHARS) return false
  if (!isValidToolSecretShape(secret)) return false

  const parsed = parseSignatureHeader(header)
  if (parsed === null) return false

  const tolerance =
    opts.toleranceSec ?? DEFAULT_TIMESTAMP_TOLERANCE_SEC
  if (!Number.isInteger(tolerance) || tolerance < 0) return false
  const now = opts.clock ? opts.clock() : nowUnixSec()
  // Hostile fix H18 — check past + future skew asymmetrically. The
  // old `Math.abs(...)` allowed a signer with a future-timestamp
  // override to extend the valid-verify window by `tolerance`
  // seconds ahead of `now`. The conventional semantics is:
  //   past: up to `tolerance` seconds (the freshness window)
  //   future: up to MAX_FUTURE_SKEW_SEC (tight clock-skew
  //           allowance; anything more indicates tampering)
  const delta = now - parsed.timestamp
  if (delta > tolerance) return false // stale
  if (-delta > MAX_FUTURE_SKEW_SEC) return false // too far in the future

  const expected = hmacHex(secret, `${parsed.timestamp}.${payload}`)
  return timingSafeHexEqual(expected, parsed.signature)
}

/**
 * Rotate a tool secret. The caller provides the current state; we
 * return a new state with:
 *   - `current` = freshly-generated secret
 *   - `previous` = the prior `current` (for the grace window)
 *   - `rotatedAt` = now, unix seconds
 *
 * If the caller never had a prior secret (first rotation),
 * `previous` is omitted. The returned state is caller-owned — persist
 * it to durable storage BEFORE emitting any webhook signed with the
 * new secret, or a receiver may reject the signature on first sight.
 */
export function rotateToolSecret(
  current?: ToolSecretState,
  clock?: () => number,
): ToolSecretState {
  const nextCurrent = generateToolSecret()
  const rotatedAt = (clock ?? nowUnixSec)()
  // Hostile fix H15 — reject storing a malformed prior secret as
  // `previous`. If the caller hands us junk, we rotate to a clean
  // state WITHOUT a previous so a future verifyWithRotation can't
  // accept signatures forged against the bad previous.
  if (!current || !isValidToolSecretShape(current.current)) {
    return { current: nextCurrent, rotatedAt }
  }
  return {
    current: nextCurrent,
    previous: current.current,
    rotatedAt,
  }
}

/**
 * Verify a signature against a rotation state. Tries `current` first;
 * if that fails AND `previous` exists AND `now - rotatedAt <=
 * {@link ROTATION_GRACE_SEC}`, retries against `previous`. A
 * signature valid under a previous secret OUTSIDE the grace window
 * returns false — the rotation's blast-radius bound is enforced
 * here.
 */
export function verifyWithRotation(
  state: ToolSecretState,
  payload: string,
  header: string | null | undefined,
  opts: VerifyOptions = {},
): boolean {
  if (
    state === null ||
    typeof state !== 'object' ||
    typeof state.current !== 'string'
  ) {
    return false
  }
  if (verifyPayloadSignature(payload, header, state.current, opts)) {
    return true
  }
  if (
    typeof state.previous !== 'string' ||
    typeof state.rotatedAt !== 'number'
  ) {
    return false
  }
  const now = opts.clock ? opts.clock() : nowUnixSec()
  // Hostile fix H16 — reject `rotatedAt` in the future. Without
  // this, a state with `rotatedAt > now` produces a negative
  // `now - rotatedAt`, which passes the `<= ROTATION_GRACE_SEC`
  // check and keeps the old secret valid for far longer than the
  // intended 60-second window. A legitimate state never has a
  // future rotatedAt (rotateToolSecret always writes `nowUnixSec()`).
  if (state.rotatedAt > now) {
    return false
  }
  if (now - state.rotatedAt > ROTATION_GRACE_SEC) {
    return false
  }
  return verifyPayloadSignature(payload, header, state.previous, opts)
}

// ─── Internal helpers ────────────────────────────────────────────────

function nowUnixSec(): number {
  return Math.floor(Date.now() / 1000)
}

function requireSecret(secret: unknown, field: string): void {
  if (!isValidToolSecretShape(secret)) {
    throw new TypeError(
      `${field} must be a ${TOOL_SECRET_HEX_LENGTH}-char lowercase-hex string ` +
        `(generated via generateToolSecret).`,
    )
  }
}

function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

interface ParsedSignature {
  timestamp: number
  signature: string
}

/**
 * Parse `t=<int>,v1=<hex>`. Tolerates reordered parts
 * (`v1=...,t=...`) but rejects anything else (extra components,
 * wrong version tag, malformed ints, non-hex signature). Returns
 * null on any parse failure — the caller treats null as "invalid
 * signature", not as a distinct error, so no oracle emerges.
 */
function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts = header.split(',').map((p) => p.trim())
  // Stripe allows extra rotated-version tags (v0, v2, ...) in the same
  // header. We strictly accept exactly two — t + v1 — to keep the
  // attack surface small. Loosen later if a real migration needs it.
  if (parts.length !== 2) return null

  let timestamp: number | null = null
  let signature: string | null = null
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq <= 0 || eq === part.length - 1) return null
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      if (!/^\d+$/.test(value)) return null
      const asNum = Number.parseInt(value, 10)
      if (!Number.isSafeInteger(asNum) || asNum < 0) return null
      timestamp = asNum
    } else if (key === SIGNATURE_VERSION) {
      if (!/^[0-9a-f]+$/.test(value)) return null
      signature = value
    } else {
      // Unknown tag → reject. We do NOT accept unknown tags silently
      // because a caller who upgrades to v2 must explicitly decide
      // how to handle the old header format.
      return null
    }
  }
  if (timestamp === null || signature === null) return null
  return { timestamp, signature }
}

/**
 * Timing-safe hex-string equality. Converts both sides to Buffers
 * and delegates to {@link timingSafeEqual}. Length mismatch
 * short-circuits false so `timingSafeEqual` never throws.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  // Even with equal lengths, Buffer.from with a malformed hex string
  // silently produces a shorter buffer — compare byte lengths after
  // conversion to catch that corner case before timingSafeEqual.
  const aBuf = Buffer.from(a, 'hex')
  const bBuf = Buffer.from(b, 'hex')
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}
