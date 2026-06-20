# V-N3-log-redaction — ③ POST-SEAL DEEP AUDIT (HIGH-STAKES, integrated whole) → **RE-CERTIFIED** — 2026-06-20

> Post-seal deep audit of the SEALED commit `90bc4005` (② SEALED, review #3 CLEAN, 6-lens),
> on the committed tree (base `main` @ `769ab9c0`). Scope = the INTEGRATED WHOLE, distinct from
> the ② seal-gating diff scope: latent defects in the shipped whole, cross-chunk integration
> seams, and recurrences of every defect-class. Orchestration: Agent-tool spawns (operator
> opt-in, recommended — bypassPermissions moots a workflow's loud-pause edge; Path-1
> effort-bearing definitions ABSENT). Effort: 5 baseline lenses + 2 collective-miss passes at
> session `xhigh`; the DEFERRED max-depth core-invariant / PII-moat pass + the FIX2b adversarial
> re-review at operator `/effort max` (Path-2, sequential after the xhigh tier). All reviewers
> `claude-opus-4-8` pinned.
>
> **VERDICT: RE-CERTIFIED — hardened.** The integrated-whole audit found NO new HIGH/MED finding
> and NO new invariant violation; the PII-moat holds on every reachable apps/web log/Sentry
> egress. The one carried item — **L-RESIDUE** (LOW) — was FIXED (not merely accepted): the max
> core-invariant pass both certified the moat AND caught that the seal record's "verified"
> one-liner trim REGRESSED idempotency; the conservative fix (FIX2b) landed, was re-gated, and
> was adversarially re-reviewed UNBROKEN. New defect class **DC-22** (truncation-boundary
> residue) filed. Push remains the separate `/push-go` gate.

## Tier — RE-CONFIRMED HIGH-STAKES
PII (raw EVM payer + EIP-3009/channel nonce) + a third-party egress boundary (Sentry/Datadog) +
money-rail settlement observability (reconcile/orchestrate/settle, runbook-depended) + a disclosed
honesty claim (DC-16). ③ warranted (not incremental).

## Mechanical pre-flight (scripted, this session — handed to the reviewers so none re-derived)
- **Full gate, clean re-run from `apps/web`:** `tsc=0` · `lint=0 err / 12 pre-existing warns`
  (logo `<img>`, academy unused-disable — none in scope) · `vitest=205 files / 4686 tests / 0
  failed`. Matches the seal-time digest exactly.
- **Hostile-input battery: 49/49** against the REAL shipped `redactOpId`/`redactLogString` +
  faithful mirrors of the seam (`sanitizeAdapterMeta`) and `emit()` channel-B. Confirmed live:
  payer-op_id→`:anon`; standalone/packed/uppercase-`0X`/mixed-case ≥40-nibble hex→`0x<redacted>`;
  short hex (<40) unchanged; idempotent; seam DROPs non-string values (numeric/bigint nonce,
  object payer); the 256 KB cap prevents the multi-MB `String.replace` RangeError; the try/catch
  backstop returns `[redaction-failed]` on a forced throw. **L-RESIDUE reproduced live** (a
  sub-40-nibble `0xaaa…` raw prefix surviving before `…[truncated]`); CM-2 (object under a
  free-text key skips redaction) confirmed.
- **Invariants re-derived & holding:** `redactOpId` grammar == `reconcile.ts` `X402_OPID`/
  `CIRCLE_NANO_OPID` (:112-113) == `anonymize-payer.ts` (`\d`≡`[0-9]`; payer/nonce shape
  byte-identical); `settlementEntryId(operationId)` == the stored ledger PK `id` (`ledger.ts:424`
  writer keys the PK on the same fn); `packages/mcp` diff EMPTY; no schema/migration/deps/
  `beforeSend`/`instrumentation`/`invocations.metadata`; `logger.ts` public API unchanged.

## The fan-out — CONVERGED (zero new HIGH/MED, zero new invariant violation)

### xhigh baseline (5 lenses) + collective-miss critic
- **Correctness/determinism — CLEAN.** Regex ordering (EMBEDDED before LONG_HEX), greedy `{40,}`,
  256 KB cap sound; no shared-`lastIndex` hazard (`redactOpId` is the only `.exec`, on a
  non-`/g` anchored regex; the `/g` regexes are used only via `String.replace`); seam
  copy-on-write never mutates the caller; `emit()` key precedence (safeMeta spread → level/msg/ts
  → err-derived error/stack) correct. (Noted: an uppercase-`0X` op_id misses the `:anon` collapse
  but still redacts both halves — not a leak; a PRE-EXISTING throwing-getter control-flow edge,
  not V-N3-introduced.)
- **Spec-conformance — CLEAN.** Every handoff §3 IN item shipped; every EXCLUDED item absent (no
  `invocations.metadata`, HTTP response-body op_ids untouched, no structured-field redaction, no
  V-N3-erasure/`packages/mcp` touch); §4 zero-behavioral-change held (only E1 export + E2 select
  beyond log args); E2 is projection-REPLACE (stronger than the literal "add"); the ~16 test edits
  are pure redactions, none loosened; runbooks in lockstep (PK-`id`-keyed closure SQL, `(from,
  nonce)` read from the DB row by id, no literal raw address). (INFO: stale `:107-108` vs
  `:112-113` cite — grammar matches.)
- **SEAM — CLEAN.** Op-id grammar parity across all 6 constructor/parser/SQL mirrors; network
  always CAIP-2 `eip155:<numeric>`. `settlementEntryId` correlation == PK id (computational).
  `PAYER_META_KEYS` complete on the EVM axis across all adapter cores; non-EVM identity keys are
  the documented R2 boundary. **M4 no-rethrow VERIFIED** — `settle-engine.ts` has NO `throw`;
  routes self-catch; no settlement viem error reaches `onRequestError`/`global-error`. Cross-chunk
  with `anonymize-payer`: disjoint sets (reconciler selects `pending`; anonymizer touches terminal
  `{settled,failed}`), anon token == PK id, carve-out rows resolvable by id — mutually reinforcing.
- **LITERAL-EXECUTION — CLEAN.** Constructed a REAL viem 2.47.4 `ContractFunctionExecutionError`
  (own-enum `cause`/`metaMessages`/`args`/`sender` carrying raw payer/nonce) and ran it through
  the REAL `@sentry/nextjs` 10.45.0 `linkedErrors` serializer: the `sanitizedErrorClone` arrives
  with redacted message/stack, `cause` undefined, ancillary props absent — RAW leaks payer, CLONE
  leaks nothing; AggregateError legs dropped too. Guard non-vacuous on real `reconcile.ts` (RED on
  an injected raw site). 13 proxies wire the seam; CM-2 has zero live callers. (INFO: a guard-blind
  `logFn = isCritical ? logger.error : logger.warn` alias at `process-payouts/route.ts:426` —
  verified PAYER-FREE; a B8-class coverage note, not a leak.)
- **CORE-INVARIANT / PII-MOAT (xhigh) — no violation.** L2 unreachable for a STRONGER reason than
  the handoff stated: `LONG_HEX_RUN`'s `[0-9a-fA-F]` redacts a checksummed (mixed-case) address
  regardless of `.toLowerCase()`; the checksummed `recovered` address reaches only the HTTP body,
  never a log.
- **Collective-miss critic — all 7 candidate gaps closed.** Surfaced + VERIFIED the
  `internalErrorResponse` (api.ts:100-110) catch-all for **192 routes** as DOUBLY-covered (raw
  `err` 3rd-arg → channel-B; `message = error.message` under the `message` key ∈
  FREE_TEXT_ERROR_KEYS → `redactLogString`). Confirmed: no import cycle, the stdout JSON line
  carries the redacted vars (not just Sentry), the runbook SQL columns all exist, the
  un-enumerated adapter cores log only non-EVM ids, no higher-level/snapshot test masks a raw shape,
  no object-under-free-text-key live caller.

### Max-depth core-invariant / PII-moat pass (operator `/effort max`, Path-2) — CERTIFIED + caught the fix-regression
RE-CERTIFIED the invariant at max rigor — the 4 hardest attacks that FAILED to break it: exhaustive
op_id severance at the cut (261 cases, both rails); sub-40 straddle at every residue length 0..39 +
exact-floor; EMBEDDED-lookahead defeat; cap×redaction pathological interleaving + post-anon shape
race. Also swept egress completeness (no un-enumerated sink: no OTel/statsd/queue/Redis-error/
`process.stdout` payer path; the 2 un-`emit()` Sentry hooks settlement-unreachable), the seam's
top-level-only limitation (zero nested/array/off-key payer placements across 34 adapter-core log
sites), and off-key free-text (789 `logger.*` sites swept — no raw payer under any uncovered key).
**Foundational correction:** the sealed code never leaks a FULL `0x<40>` even at the frontier —
only a ≤39-nibble partial (the LOW L-RESIDUE), exhaustively confirmed. **AND it caught the
fix-regression** (below).

## L-RESIDUE — fix-or-accept DECISION: **FIX** (charged item b)
Adjudicated under the max core-invariant pass. **FIX**, because the residue is real raw-PII (a
≤39-nibble near-full address prefix) on a chunk chartered "no raw payer in logs," the fix is the
explicitly pre-authorized in-scope hardening of the build's OWN cap, and pinning the CORRECT fix now
prevents a future engineer applying the naive (regressing) one-liner.

- **The fix-prep caught a fix-regression (the value of the max pass).** The seal record's
  "integrator-verified" one-liner `s.slice(0, MAX).replace(/0[xX][0-9a-fA-F]*$/,'') + marker`
  closes the leak at every straddle offset (incl. op_id `from`/`nonce` severance) — but the max
  pass proved it REGRESSES idempotency + the ≤MAX length bound: on a small-prefix straddle the trim
  removes too few chars, the marker pushes the result back `> MAX`, and a second pass re-truncates
  into the marker (`…[tru…[truncated]`). The integrator's first fix-prep MISSED this (tested
  idempotence only where the trim dropped below MAX) — caught ONLY by the decorrelated max pass.
- **The shipped fix — FIX2b (redact-before-trim, marker-short budget).** For `s.length > MAX`:
  `redactRuns(s.slice(0, MAX − TRUNCATION_MARKER.length)).replace(TRAILING_PARTIAL_HEX_AT_CUT, '')
  + TRUNCATION_MARKER`. Redact-BEFORE-trim keeps a ≥40 boundary-straddling run as `0x<redacted>`
  (no observability loss — only the sub-floor straddling fragment is dropped); the marker-short
  slice budget guarantees the result is ALWAYS ≤ MAX → idempotent. Two named consts
  (`TRUNCATION_MARKER`, `TRAILING_PARTIAL_HEX_AT_CUT`) + doc. +4 straddle pins in
  `log-redaction.test.ts`.
- **Live fail→pass, exhaustively.** tsx batteries against the real module: SEALED leaks at offsets
  1..39 (and the ORIG one-liner is non-idempotent) → FIX2b closes every offset, is idempotent,
  ≤MAX, byte-identical to sealed on every ≤MAX input, handles op_id+`from` straddles, no-throws on
  6 MB (257 + 158 assertions). Adversarial re-review of FIX2b: **UNBROKEN** — ~600 boundary + 4000
  fuzz cases, op_id severance at every char index, surrogate-pair split at the cut, non-string
  no-throw, with a NEGATIVE CONTROL confirming the harness detects the pre-fix leak.
- **Gate re-run clean on the hardened tree:** `tsc=0` · `lint=0 err / 12 warns` · `vitest=205
  files / 4690 tests / 0 failed` (+4 = the L-RESIDUE pins). Diff scope: ONLY `log-redaction.ts` +
  its test (`packages/mcp`/`logger.ts`/the seam UNTOUCHED; `tools/page.tsx` is the known
  carry-forward, excluded; `.claude/` untracked). No scope creep, no frozen-surface perturbation.

## Carried residuals (no action — verified out-of-scope / non-reachable)
- **M4-deferred un-`emit()` Sentry hooks** (`instrumentation.ts:26`, `global-error.tsx:13`) — no
  `beforeSend` backstop, but VERIFIED settlement-unreachable (settle-engine no-throw; routes
  self-catch). The spec's M4 deferral (to the V-N3-erasure enable-runbook / a follow-up) is sound.
- **CM-2 / L1 / L2** — object/non-hex-string under a free-text/payer key; uppercase/malformed
  op_id. All require a non-conforming caller; none reachable with a raw `0x<40>`/`0x<64>` today.
- **Guard-blind `logFn` ternary alias** (`process-payouts/route.ts:426`) — a B8-class instance
  beyond the documented set; verified payer-free.

## Defect-class ledger
- **DC-22 (NEW, FILED) — truncation-boundary residue.** A length cap placed BEFORE a min-length
  redaction quantifier resurrects a sub-floor leak at the cut (the L-RESIDUE instance); and the
  residue-trim fix done wrong regresses idempotency / the length bound (the max pass's catch). The
  correct shape — cap regex-safe → redact → trim trailing partial at the cut, slice budget
  marker-short — is recorded with cross-refs to DC-12 (incomplete boundary guard), DC-17
  (non-idempotent re-run = the fix-regression face), DC-18 (over-trim = observability loss),
  DC-16 (the payer-PII honesty parent).
- **SEAM class** (recurring) — re-validated across all 6 op-id grammar mirrors + the
  `internalErrorResponse` 192-route funnel + the M4 no-rethrow chain; tight.
- **LITERAL-EXECUTION class** (recurring) — discharged by running real viem + real Sentry
  serializer objects, not idealized models.

## Routing
**RE-CERTIFIED (hardened) → local commit (seal `90bc4005` amended to fold in the ③ hardening,
message updated to ② SEALED + ③ RE-CERTIFIED) → push remains the separate `/push-go` gate.** AFTER
this chunk: chunk 2 = `invocations.metadata` dark minimization; V-N3-erasure enable unblocks only
after BOTH land.
