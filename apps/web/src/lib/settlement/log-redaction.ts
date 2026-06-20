/**
 * V-N3-log-redaction — settlement-log + Sentry payer/nonce redaction helpers.
 *
 * The settlement subsystem's `operation_id` is `{rail}:{network}:{payer}:{nonce}`
 * for the two on-chain rails (x402 / circle-nano), embedding the raw EVM payer
 * address (`0x<40>`) and the EIP-3009 nonce (`0x<64>`). These pure helpers strip
 * that PII from the log + Sentry egress on BOTH channels:
 *   - {@link redactOpId}      — a per-site META helper for an `operation_id` string field.
 *   - {@link redactLogString} — the free-text sanitizer the central `emit()`
 *     err/stack channel (and the free-text error meta keys) apply.
 *
 * Correlation note (DC-18): `redactOpId` collapses EVERY settlement on a
 * rail/network to one string (`{rail}:{network}:anon`), DESTROYING the operator's
 * grep-by-op_id incident timeline. So it is NOT the primary replacement at
 * payer-bearing op_id log sites — the de-identified, row-unique PK key
 * `settlementEntryId(operationId)` (ledger.ts) is. `redactOpId` is the FALLBACK
 * for non-payer / mixed op_id shapes (it passes a non-matching string through
 * UNCHANGED, e.g. an ap2/hop UUID) and for array elements.
 *
 * Both helpers are PURE and idempotent. The grammar mirrors reconcile.ts:107-108
 * (`CIRCLE_NANO_OPID` / `X402_OPID`) and anonymize-payer.ts — keep in sync if
 * those payer-op_id shapes ever change.
 */

/**
 * Anchored payer-op_id grammar with two capture groups (rail, network) so the
 * network is recoverable for the redacted return. Mirrors reconcile.ts:107-108.
 */
const ANCHORED_PAYER_OPID =
  /^(x402|circle-nano):(eip155:\d+):0x[0-9a-fA-F]{40}:0x[0-9a-fA-F]{64}$/

/** EMBEDDED (un-anchored) variant for free-text scrubbing, with a trailing
 *  non-hex lookahead so the nonce matches a COMPLETE 64-hex run (never a prefix
 *  of a longer one). */
const EMBEDDED_PAYER_OPID =
  /(x402|circle-nano):(eip155:\d+):0x[0-9a-fA-F]{40}:0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g

/** Any `0x`/`0X` hex run of ≥40 nibbles. This is GREEDY and carries NO trailing
 *  lookahead, so it consumes the WHOLE run in one match — a bare EVM address (40)
 *  or EIP-3009 nonce (64), AND a from/nonce PACKED inside a single contiguous
 *  hex blob (ABI calldata / revert `data` / a JSON-RPC request body — exactly how
 *  viem formats a `transferWithAuthorization`/`readContract` error). An
 *  exact-length pattern (`{64}`) with a trailing boundary FAILED on the packed
 *  shape: every interior 40/64 window was blocked by the lookahead and the whole
 *  run matched neither length from its own `0x`, so the PII survived (F1). The
 *  greedy floor of 40 also eats any trailing residue (`0x<64>deadbeef` →
 *  `0x<redacted>`, never a leftover hex tail), keeping the result idempotent;
 *  `0[xX]` additionally covers an upper-case `0X` prefix (F4). Shorter hex
 *  (4-byte selectors, chain ids, small uint values) is below the floor and left
 *  intact. */
const LONG_HEX_RUN = /0[xX][0-9a-fA-F]{40,}/g

/**
 * Hard cap on the length `redactLogString` will scan (B2). The greedy
 * {@link LONG_HEX_RUN} (`{40,}`, no upper bound) makes V8's
 * `String.prototype.replace` overflow the call stack on a SINGLE contiguous
 * match of ≈5.3 MB+ — a `RangeError`. `redactLogString` is the SHARED chokepoint
 * for the `emit()` err-channel (`err.message`/`err.stack`), the M5-coerced
 * `String(err.message)`, the free-text meta keys, AND the sanitizing-adapter
 * seam — and EVERY one of those invocations sits OUTSIDE `emit()`'s only `try`
 * (which wraps just the Sentry capture). An un-guarded `RangeError` would
 * therefore propagate OUT of `emit()`, drop the log line, and alter control flow
 * inside the surrounding `catch` blocks (logger.error runs inside catches) — the
 * exact failure class this chunk is chartered to make safe. Capping the scanned
 * length to 256 KB keeps every match far below the overflow threshold (≈20×
 * margin); a viem on-chain error / Postgres message that large is already past
 * any useful debugging detail. NOT a bounded `{40,N}` quantifier — that would
 * leave a bare-hex tail residue on a run longer than the bound.
 */
const MAX_REDACT_INPUT = 256 * 1024

/**
 * The truncation marker appended when an input exceeds {@link MAX_REDACT_INPUT}.
 * The slice budget below is reduced by its length so the capped result is ALWAYS
 * ≤ MAX_REDACT_INPUT — which keeps `redactLogString` idempotent (a second pass can
 * never re-cap and sever this marker, the regression a naive `slice(MAX) + marker`
 * trim introduces: the marker pushes the result back over MAX, so the next pass
 * re-truncates into it → `…[tru…[truncated]`).
 */
const TRUNCATION_MARKER = '…[truncated]'

/**
 * A trailing `0x`/`0X` hex run sitting AT the truncation cut (③ L-RESIDUE close).
 * The fixed-offset slice can sever a payer/nonce `0x…` run mid-way, leaving a
 * sub-40-nibble RAW prefix below {@link LONG_HEX_RUN}'s floor-of-40 — which then
 * egresses unredacted. Trimming any trailing partial-hex run BEFORE appending the
 * marker removes that residue; a run that began ≥40 nibbles before the cut is still
 * consumed whole by LONG_HEX_RUN, so only the boundary-straddling sub-floor
 * fragment (incl. a partial `from`/`nonce` of an op_id straddling the cut) is dropped.
 */
const TRAILING_PARTIAL_HEX_AT_CUT = /0[xX][0-9a-fA-F]*$/

/**
 * Redact a settlement `operation_id` META field. A payer-bearing op_id
 * `{rail}:{network}:{payer}:{nonce}` → `{rail}:{network}:anon` (dropping the raw
 * EVM payer + EIP-3009 nonce while keeping rail+network for triage). Any OTHER
 * shape — hop/ap2 UUIDs, other-rail ids, already-anon ids, malformed strings,
 * bare tx-hashes/addresses — passes through UNCHANGED. `null`/`undefined` →
 * `'unknown'`. Pure, idempotent.
 *
 * NOTE: this COLLAPSES correlation (all rail/network settlements share one
 * string). Prefer `settlementEntryId(operationId)` where row-level correlation
 * matters; use `redactOpId` only for non-payer / mixed shapes + array elements.
 */
export function redactOpId(opId: string | null | undefined): string {
  if (opId == null) return 'unknown'
  const m = ANCHORED_PAYER_OPID.exec(opId)
  if (!m) return opId
  return `${m[1]}:${m[2]}:anon`
}

/**
 * Sanitize a FREE-TEXT string (an `err.message` / `err.stack`, or a free-text
 * error meta value like `error`/`reason`) for payer PII. Two rewrites, IN ORDER:
 *   1. any embedded payer-op_id `{rail}:{network}:{payer}:{nonce}` →
 *      `{rail}:{network}:anon` (a Postgres error echoing a `WHERE operationId=…`).
 *   2. any `0x`/`0X` hex run of ≥40 nibbles → `0x<redacted>` (the bare
 *      `from`/`nonce` hex a viem on-chain error formats into its
 *      `transferWithAuthorization`/`readContract` call-arg message — whether the
 *      from/nonce stand alone OR are packed inside one contiguous calldata blob).
 * Step 1 runs FIRST so a clean payer-op_id collapses to `{rail}:{network}:anon`
 * (keeping rail+network for triage) before the greedy hex pass would otherwise
 * reduce its two `0x…` halves to `0x<redacted>:0x<redacted>`.
 *
 * Over-redaction of a recipient / tx-hash that appears INSIDE a free-text error
 * string is ACCEPTABLE collateral (handoff §5#4) — this runs ONLY on free-text
 * channels, NEVER on structured `txHash`/`recipient`/`to` meta fields. Pure,
 * idempotent (`0x<redacted>` carries no hex tail to re-match).
 *
 * Cannot throw out of `emit()` for ANY input (B2): the input is capped to
 * {@link MAX_REDACT_INPUT} (truncated with a {@link TRUNCATION_MARKER}) BEFORE the
 * greedy regex runs, so the RangeError on a multi-MB contiguous hex run can never
 * arise; a `try`/`catch` backstop additionally guarantees a coarse
 * `'[redaction-failed]'` over leaking the raw string or escaping the logging path
 * should any future input still misbehave. The cut is taken `TRUNCATION_MARKER`-
 * short and any trailing partial `0x…` run at the boundary is trimmed
 * ({@link TRAILING_PARTIAL_HEX_AT_CUT}) — so no sub-40-nibble raw-hex prefix can
 * straddle the cut (③ L-RESIDUE) AND the capped output stays ≤ MAX_REDACT_INPUT,
 * keeping the result idempotent for ANY input.
 */
export function redactLogString(s: string): string {
  const redactRuns = (t: string): string =>
    t.replace(EMBEDDED_PAYER_OPID, '$1:$2:anon').replace(LONG_HEX_RUN, '0x<redacted>')
  try {
    if (s.length > MAX_REDACT_INPUT) {
      // Oversized input (B2): cap to a bounded, regex-safe length BEFORE the greedy
      // run (so the multi-MB single-match RangeError can never arise), redact, then
      // trim any sub-40-nibble raw-hex fragment the fixed cut severed (③ L-RESIDUE),
      // then append the marker. The slice budget is TRUNCATION_MARKER-short so the
      // result is ALWAYS ≤ MAX_REDACT_INPUT — a second pass never re-caps and cuts
      // into the marker, keeping redactLogString idempotent for ANY input. Redacting
      // BEFORE the trim keeps a ≥40 boundary-straddling run as `0x<redacted>` (only
      // the sub-floor partial fragment, incl. a straddling op_id `from`/`nonce`, is
      // dropped).
      return (
        redactRuns(s.slice(0, MAX_REDACT_INPUT - TRUNCATION_MARKER.length)).replace(
          TRAILING_PARTIAL_HEX_AT_CUT,
          '',
        ) + TRUNCATION_MARKER
      )
    }
    return redactRuns(s)
  } catch {
    // Defense-in-depth: redactLogString MUST be incapable of throwing out of
    // emit() (B2). The cap already prevents the known multi-MB RangeError; this
    // backstop ensures a future pathological input still cannot leak the raw
    // string or crash the log line. A coarse marker is the safe fallback.
    return '[redaction-failed]'
  }
}
