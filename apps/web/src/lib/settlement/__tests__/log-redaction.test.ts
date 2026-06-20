/**
 * V-N3-log-redaction — unit pins for the pure payer/nonce redaction helpers
 * (handoff §9). `redactOpId` is the per-site META helper (anchored op_id →
 * `{rail}:{network}:anon`, everything else passthrough); `redactLogString` is
 * the free-text channel-B sanitizer (embedded op_id + standalone from/nonce hex).
 */
import { describe, it, expect } from 'vitest'
import { redactOpId, redactLogString } from '../log-redaction'

// A representative raw payer op_id for each on-chain rail. The payer is a 40-hex
// EVM address; the nonce a 64-hex EIP-3009 value.
const PAYER = '0x' + 'ab'.repeat(20) // 40 hex
const NONCE = '0x' + 'cd'.repeat(32) // 64 hex
const X402_OPID = `x402:eip155:8453:${PAYER}:${NONCE}`
const CIRCLE_OPID = `circle-nano:eip155:84532:${PAYER}:${NONCE}`

describe('redactOpId — per-site operation_id META helper', () => {
  it('redacts an x402 payer op_id to {rail}:{network}:anon (no 0x leaks)', () => {
    const out = redactOpId(X402_OPID)
    expect(out).toBe('x402:eip155:8453:anon')
    expect(out).not.toContain('0x')
    expect(out).not.toContain(PAYER)
    expect(out).not.toContain(NONCE)
  })

  it('redacts a circle-nano payer op_id, preserving the network', () => {
    expect(redactOpId(CIRCLE_OPID)).toBe('circle-nano:eip155:84532:anon')
  })

  it('passes a hop/ap2 UUID (non-payer shape) through UNCHANGED', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef0123456789'
    expect(redactOpId(uuid)).toBe(uuid)
  })

  it('passes another-rail op_id through UNCHANGED', () => {
    expect(redactOpId('ap2:tx-9f8e7d')).toBe('ap2:tx-9f8e7d')
  })

  it('does NOT redact a bare tx hash (0x<64>) or bare address (0x<40>) ALONE (no false redaction)', () => {
    expect(redactOpId(NONCE)).toBe(NONCE)
    expect(redactOpId(PAYER)).toBe(PAYER)
  })

  it('null / undefined → "unknown"', () => {
    expect(redactOpId(null)).toBe('unknown')
    expect(redactOpId(undefined)).toBe('unknown')
  })

  it('an already-anon op_id passes through (idempotent at the site)', () => {
    expect(redactOpId('x402:eip155:8453:anon')).toBe('x402:eip155:8453:anon')
  })
})

describe('redactLogString — free-text channel-B sanitizer', () => {
  it('rewrites an embedded payer op_id to :anon (a PG error echoing WHERE operationId=…)', () => {
    const msg = `error: duplicate key value violates ... operation_id=(${X402_OPID}) already exists`
    const out = redactLogString(msg)
    expect(out).toContain('x402:eip155:8453:anon')
    expect(out).not.toContain(PAYER)
    expect(out).not.toContain(NONCE)
  })

  it('redacts a standalone EVM address (0x<40>) to 0x<redacted>', () => {
    expect(redactLogString(`from ${PAYER} reverted`)).toBe('from 0x<redacted> reverted')
  })

  it('redacts a standalone EIP-3009 nonce (0x<64>) to 0x<redacted>', () => {
    expect(redactLogString(`nonce ${NONCE} consumed`)).toBe('nonce 0x<redacted> consumed')
  })

  it('redacts BOTH the from and nonce in a viem-style call-arg message', () => {
    const viem = `ContractFunctionExecutionError: transferWithAuthorization(address from = ${PAYER}, bytes32 nonce = ${NONCE})`
    const out = redactLogString(viem)
    expect(out).not.toContain(PAYER)
    expect(out).not.toContain(NONCE)
    expect(out.match(/0x<redacted>/g)).toHaveLength(2)
  })

  it('leaves a string with no sensitive shape UNCHANGED', () => {
    const s = 'connection refused: ECONNREFUSED 10.0.0.1:5432'
    expect(redactLogString(s)).toBe(s)
  })

  it('is idempotent (re-running redacts nothing new)', () => {
    const once = redactLogString(`from ${PAYER} nonce ${NONCE} op ${CIRCLE_OPID}`)
    expect(redactLogString(once)).toBe(once)
    expect(once).not.toContain(PAYER)
    expect(once).not.toContain(NONCE)
  })

  it('does not split a 64-hex nonce by greedily matching its first 40 chars', () => {
    // The 64-run is scrubbed whole — never left as a 40-redaction + 24-hex tail.
    expect(redactLogString(NONCE)).toBe('0x<redacted>')
  })

  // ── F1: a from/nonce PACKED inside one contiguous calldata/revert-data run ──
  // The OLD exact-length+trailing-lookahead standalone patterns left this UNTOUCHED
  // (every interior 40/64 window was blocked by the lookahead, and the whole run
  // matched neither length from its own `0x`), so the suite was GREEN while the real
  // viem shape leaked. The greedy ≥40 rule consumes the whole blob.
  it('redacts a from+nonce PACKED inside a single contiguous calldata hex run (F1)', () => {
    // `transferWithAuthorization` calldata: selector + ABI-padded address word +
    // the 64-hex nonce + trailing words — ONE unbroken `0x…` run, no separators.
    const packed =
      '0xe3ee160e' + '0'.repeat(24) + PAYER.slice(2) + NONCE.slice(2) + 'deadbeefcafe'
    const out = redactLogString(`viem revert: execution reverted, data=${packed}`)
    expect(out).not.toContain('ab'.repeat(20)) // the packed 40-hex payer nibbles
    expect(out).not.toContain('cd'.repeat(32)) // the packed 64-hex nonce nibbles
    expect(out).toBe('viem revert: execution reverted, data=0x<redacted>')
    expect(out.match(/0x<redacted>/g)).toHaveLength(1) // the whole run → ONE token
  })

  it('eats the trailing residue after a 0x<64> nonce (no leftover hex tail) (F1)', () => {
    // `0x<64>deadbeef` — the OLD `{64}(?![0-9a-fA-F])` failed (65th char still hex)
    // and leaked; the greedy rule swallows the residue.
    const out = redactLogString(`nonce ${NONCE}deadbeef consumed`)
    expect(out).toBe('nonce 0x<redacted> consumed')
    expect(out).not.toContain('cd'.repeat(32))
    expect(out).not.toContain('deadbeef')
  })

  it('redacts an UPPER-CASE 0X-prefixed address (F4)', () => {
    const upper = '0X' + 'AB'.repeat(20) // 0X + 40 hex
    const out = redactLogString(`from ${upper} reverted`)
    expect(out).toBe('from 0x<redacted> reverted')
    expect(out).not.toContain('AB'.repeat(20))
  })

  // ── B2: an oversized contiguous hex run must NOT throw out of the chokepoint ──
  // The greedy ≥40 rule overflows String.replace's call stack on a single ≈5.3 MB+
  // contiguous match (RangeError). redactLogString is the shared chokepoint (err
  // channel + M5-coerced + free-text keys + the seam), ALL outside emit()'s try, so
  // it MUST be incapable of throwing. The input cap (256 KB + marker) closes it.
  it('does NOT throw on an oversized contiguous hex run (≥6 MB) — caps + redacts (B2)', () => {
    const huge = '0x' + 'a'.repeat(6 * 1024 * 1024) // ~6 MB single hex run
    let out = ''
    expect(() => {
      out = redactLogString(`viem revert: execution reverted, data=${huge}`)
    }).not.toThrow()
    expect(out).toContain('0x<redacted>') // the run is redacted, not left raw
    expect(out).not.toContain('a'.repeat(41)) // no bare-hex tail residue survives
    expect(out.length).toBeLessThan(1024) // truncated far below the ~6 MB input
  })

  it('truncates an oversized non-hex string with a marker, without throwing (B2)', () => {
    const huge = 'x'.repeat(6 * 1024 * 1024)
    let out = ''
    expect(() => {
      out = redactLogString(huge)
    }).not.toThrow()
    expect(out).toContain('…[truncated]')
    expect(out.length).toBeLessThanOrEqual(256 * 1024 + '…[truncated]'.length)
  })
})

// ── ③ L-RESIDUE (post-seal deep-audit hardening) ──────────────────────────────
// The B2 input cap slices at a FIXED 256 KB offset. A naive `slice(MAX) + marker`
// left a sub-40-nibble RAW hex prefix when a payer/nonce `0x…` run straddled the
// cut (below LONG_HEX_RUN's floor-of-40), egressing raw — the L-RESIDUE the ③
// deep audit closed. The fix slices `…[truncated]`-short, redacts, then trims any
// trailing partial-hex run at the boundary. These pin BOTH the leak-close AND the
// idempotency/≤MAX property a naive trim regressed (the corrected one-liner left
// pass-1 output > MAX, so pass-2 re-truncated INTO the marker → `…[tru…[truncated]`).
describe('redactLogString — ③ truncation-boundary residue (L-RESIDUE) is closed', () => {
  const MAX = 256 * 1024
  const MARKER = '…[truncated]'
  // a bare `0x…` run that is NOT the redaction token (i.e. a raw-PII fragment)
  const rawHex = (out: string) => /0[xX][0-9a-fA-F]{1,}/.test(out.replace(/0x<redacted>/g, ''))

  it('does NOT leak a sub-40-nibble raw-hex prefix when a 0x-run straddles the 256 KB cut', () => {
    // place `0x` so the worst case — 39 of the 40 address nibbles — would fall just
    // before the cut under a naive slice(MAX); the fix must leave NO raw fragment.
    const input = 'z'.repeat(MAX - 2 - 39) + '0x' + 'a'.repeat(200)
    const out = redactLogString(input)
    expect(rawHex(out)).toBe(false)
    expect(out.endsWith(MARKER)).toBe(true)
  })

  it('does NOT expose the from when a payer op_id straddles the cut (cut lands mid-nonce)', () => {
    const from40 = '0x' + 'ab'.repeat(20) // the 40-hex EVM payer
    const head = `x402:eip155:8453:${from40}:0x` + 'cd'.repeat(5) // partial nonce at the cut
    const input = 'z'.repeat(MAX - head.length) + head + 'cd'.repeat(200)
    const out = redactLogString(input)
    expect(out).not.toContain('ab'.repeat(20)) // the 40-hex from never egresses raw
    expect(rawHex(out)).toBe(false)
  })

  it('stays idempotent and ≤ MAX on a cap-path input whose cut lands on a hex run', () => {
    // `0x` straddling the cut with a tiny prefix — the exact shape a naive trim
    // left > MAX (→ double marker on re-run). The fix keeps the result ≤ MAX.
    const input = 'z'.repeat(MAX - 2) + '0x' + 'a'.repeat(50)
    const once = redactLogString(input)
    expect(redactLogString(once)).toBe(once) // idempotent (no re-cap into the marker)
    expect(once.length).toBeLessThanOrEqual(MAX) // never exceeds the cap
    expect(once.endsWith(MARKER)).toBe(true)
    expect(once).not.toMatch(/…\[tru[^n]/) // no severed / doubled marker
  })

  it('still redacts a ≥40 boundary-straddling run to 0x<redacted> (not silently dropped)', () => {
    // redact-before-trim: a run that began ≥40 nibbles before the cut is consumed
    // whole by LONG_HEX_RUN; only a sub-floor straddling fragment is trimmed.
    const input = 'z'.repeat(MAX - 100) + '0x' + 'a'.repeat(5000)
    const out = redactLogString(input)
    expect(out).toContain('0x<redacted>')
    expect(rawHex(out)).toBe(false)
    expect(out.length).toBeLessThanOrEqual(MAX)
  })
})
