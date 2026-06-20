# V-N3-log-redaction — ② SEAL-GATING REVIEW #3 (of recovery FIX build #2) → **CLEAN / SEAL-READY** — 2026-06-19

> High-stakes ② seal-gating review of the **second recovery FIX build** (working tree on `main` @ base
> `769ab9c0`), the build that closed the THREE new HIGH defects + decisions of review #2
> (`v-n3-log-redaction-seal-review-2-2026-06-19.md`, the binding fix spec). Orchestration: 6 fresh-context
> Agent-tool reviewers, model `claude-opus-4-8` pinned, session `xhigh`, coverage mode (5 lens-distinct:
> correctness/determinism, spec-conformance, core-invariant/PII-moat, SEAM, LITERAL-EXECUTION + 1
> collective-miss critic; core-invariant max-depth DEFERRED to ③ per the standing operator opt-in,
> re-confirmed this round). Gate re-run clean+isolated by the integrator: **`tsc 0 · lint 0 err (12
> pre-existing warns, none in scope) · vitest 205 files / 4686 tests / 0 failed`** (blocked-#2 baseline
> 204/4671 → +1 file / +15 tests = the missing pins the fix spec demanded).
>
> **VERDICT: CLEAN — seal-gating cleared.** All of review #2's B1–B8 are genuinely closed; the
> CONFIRMED-CLEAN set is preserved untouched; no scope-creep. The 6-lens fan-out + integrator live repro
> surfaced exactly ONE new substantive finding — a **LOW, effectively-unreachable** cap-boundary raw-hex
> residue (the B2 256 KB truncation can leave a sub-40-nibble address prefix) — reproduced live, cheap
> deterministic fix verified, recorded as an accepted latent (R1-class) and carried into ③. Zero HIGH/MED
> findings open. **Claude cannot self-seal — awaiting operator `/seal-go`; then ③ (high-stakes).**

## Tier — RE-CONFIRMED HIGH-STAKES
The realized diff is the same broad surface review #2 re-confirmed: all 13 proxy `appLogger`s + the shared
seam (`sanitizing-adapter-logger.ts`) + `logger.ts emit()`'s unconditional-clone path + a large hand-rolled
guard lexer; `logger.ts emit()` remains the global-blast-radius surface (~828 call sites). Stays HIGH-STAKES;
③ post-seal deep audit follows the clean ② seal.

---

## Gate (integrator, clean + isolated, this session)
`cd apps/web`:
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → exit 0, **0 errors / 12 pre-existing warnings** (`<img>`/react-hooks/unused-disable in marketing+academy files — none in V-N3 scope).
- `npx vitest run` → **205 files / 4686 tests / 0 failed** (exit 0).
- **Digest: `tsc=0 · lint=0err/12warn · vitest=205/4686/0`.**
- The build emitted NO separate evidence/digest doc and the cadence-state narrative was stale ("back to
  build") while the fix artifacts (mtimes 20:02–20:06) already sat in the tree — so per PROMPT 2 the green
  was treated as evidence-free/RED and the gate was re-established **from scratch** by the integrator
  (above), not trusted. The +1 file / +15 tests over the blocked-#2 baseline are exactly the B3 seam canary
  (7) + B2 oversized pins (2) + B5 un-mask + B6/B7/B8 guard self-tests + the seam string/err-channel pins.

---

## BLOCKING findings — NONE.

## Review #2's B1–B8 — each CONFIRMED CLOSED (6-lens convergence + integrator evidence)

- **B1 [HIGH] CLOSED** — `sanitizing-adapter-logger.ts:81-95`. A payer-key value that is `typeof v ===
  'string'` is redacted via `redactLogString`; a NON-string value hits `copy ??= {...data}; delete copy[k]`
  — DROPPED, not coerced. Covers the drain numeric `nonce` AND a future bigint/object payer (the seam test
  exercises `nonce:7n` and `payer:{address}`, both dropped). Spec-conformance + core-invariant + SEAM +
  literal-execution all live-repro'd the DROP; the gate's seam test (`'nonce' in meta === false`) pins it
  and goes RED on the pre-fix coerce-and-skip seam.
- **B2 [HIGH] CLOSED** — `log-redaction.ts:70,116-130`. Unified at the `redactLogString` chokepoint:
  `MAX_REDACT_INPUT = 256*1024` cap (slice + `…[truncated]`) BEFORE the regex, wrapped in `try/catch →
  '[redaction-failed]'`. NOT a bounded `{40,N}` quantifier (`LONG_HEX_RUN = /0[xX][0-9a-fA-F]{40,}/g`
  unchanged; the cap prevents the throw). Oversized pin added (6 MB → no throw, redacted, no tail).
  Integrator independently measured the V8 `String.replace` overflow threshold ≈5.3–5.5 MB; the 256 KB cap
  is ~21× below it. Covers the err-channel + the M5 `String(err.message)` coercion + the free-text keys +
  the seam reuse (all four `redactLogString` sites at `logger.ts:72,106,109,125`, all outside `emit()`'s
  only `try` at `:145`). **Residue caveat → see L-RESIDUE below.**
- **B3 [HIGH] CLOSED** — `apps/web/src/lib/__tests__/sanitizing-adapter-logger.test.ts` (NEW). Feeds the
  three real adapter metas (x402 `{payerAddress}`, drain `{payerAddress, channelId, nonce:42}`, circle-nano
  `{payer}`) through `createSanitizingAdapterLogger().{info,warn,error}`, mocks `@/lib/logger`, asserts NO
  raw payer/nonce/channel-addr egress + correlation (`toolSlug`/`amountBaseUnits`/`network`) passthrough.
  Mock-interception PROVEN genuine (the literal-execution lens confirmed the vitest `@` alias → the factory's
  `./logger` import resolve to the same module, and a probe showed `mockInfo` receives the calls + the real
  `console.info` is not hit). Reverted-fix repro → RED. Non-vacuous.
- **B4 [MED, decision STRIP] CLOSED + RECORDED** — `channelId`/`channelAddress` added to `PAYER_META_KEYS`
  (`sanitizing-adapter-logger.ts:64-65`) AND the guard `FORBIDDEN` set (`log-redaction-guard.test.ts:81-82`);
  decision documented in both headers (per-channel on-chain id; runbook recovers `(channelAddress, nonce)`
  from the DB row by `id`). Guard self-test pins it.
- **B5 [LOW] CLOSED** — `logger.test.ts:154` now asserts `expect(capturedErr).not.toBe(err)` (distinct clone
  by identity) with name/message preserved; the stale `toHaveBeenCalledWith(err)` masking assertion is gone.
  Fails on the pre-F2 code that passed the original `err`.
- **B6 [MED durability] CLOSED (documented + pinned)** — guard regex-literal blind spot documented LATENT;
  both behaviors pinned (char-class `)` → silent early-close = documented false-negative; unbalanced `(` →
  loud `<RUNAWAY-PARSE>`, fails closed). Header no longer overclaims robustness.
- **B7 [LOW durability] CLOSED (hardened)** — dotted `.id` allow restricted to `PK_ROW_BINDINGS =
  {row,current,existing}`; `attacker.id`/`foo.id`/`req.body.id` now flagged, sanctioned PK reads pass.
- **B8 [LOW durability] CLOSED (documented + pinned)** — alias/destructured/member-chain/spread blind spots
  documented LATENT with the zero-live-site basis; spread limitation pinned.

## CONFIRMED-CLEAN preservation — HELD (no regression)
`packages/mcp` diff EMPTY (`git diff HEAD -- packages/mcp` empty — SDK untouched); `logger.ts` public API
byte-identical (not in diff); no edit to `markSettlement*`/`findSettlementRow`/`parseSettlementOperationId`/
`PAYER_OPID_SQL_REGEX` production sources; no schema/migration/deps; no `beforeSend`; no
`invocations.metadata`/`drainChannelId` (chunk-2) pull-in; no V-N3-erasure/anonymize-payer file touched.
All 13 adapter wrappers (12 `*-proxy.ts` + `mpp.ts`) wire `createSanitizingAdapterLogger()`, no raw
forwarder remains, the `AdapterLogger` contract `(event, data?, err?)` (`packages/mcp/.../types.ts:69-73`)
matches the factory and every adapter call site. `settlementEntryId(operationId) == the stored ledger PK
id` (runbook lockstep valid). `redactOpId` grammar matches `reconcile.ts` / `anonymize-payer.ts` exactly.
The ~16 settlement log-assertion edits are pure redactions (`settlementEntryId`/`redactOpId`/`row.id`),
none loosened. Runbooks print no literal raw address. F1(+F4)/F2/M3/M5/H1/M1/H2/M2 all intact.

---

## RECORDED — the one new finding + accepted latents (no seal-blocker)

### L-RESIDUE [LOW, CONF=high — reproduced; accepted latent, carried to ③] — B2 256 KB cap leaves a sub-40-nibble raw-hex PREFIX when a `0x`-run straddles the truncation boundary
`apps/web/src/lib/settlement/log-redaction.ts:118-119`. `redactLogString` does `s.slice(0, MAX_REDACT_INPUT)
+ '…[truncated]'` BEFORE the greedy `LONG_HEX_RUN` pass. A `0x`-hex run whose `0x` lands within ~40 chars
of the 256 KB cut leaves a **sub-40-nibble raw-hex prefix** below the floor-of-40 quantifier → it is not
redacted and egresses raw. Surfaced independently by 3 lenses (correctness C1, core-invariant N1,
literal-execution boundary trace) + sharpened by the collective-miss critic (CM-1).
- **Integrator live repro (this session, exact source logic):** `0x` placed 39 nibbles before the cut →
  output tail `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…[truncated]` — a **39-of-40-nibble (near-full)**
  raw address prefix survives. A run starting ≥40 nibbles before the cut is redacted whole (`0x<redacted>`)
  — only the boundary-*start* straddle leaks.
- **Severity = LOW, gated by reachability not impact.** Impact axis is uncomfortable (near-full raw address),
  but reachability is effectively nil: it requires a SINGLE free-text `err.message`/`err.stack` **> 256 KB**
  with a payer/nonce `0x`-run starting in a ~40-char window at the exact 256 KB boundary, and the preceding
  256 KB free of any ≥40-hex run (which would itself redact). The only realistic > 256 KB free-text source
  is a viem multi-MB `eth_call`/revert-data error, where the address is packed *mid-blob* (a run starting
  well before the boundary → redacted whole, the safe case). No live SettleGrid path constructs the leaking
  shape. Same accepted class as review #2's **R1** (latent raw-hex miss).
- **Cheap deterministic fix (verified by the integrator: closes it in all repro cases, leaves the safe case
  redacted):** trim a trailing partial hex run at the cut before the marker —
  `s.slice(0, MAX_REDACT_INPUT).replace(/0[xX][0-9a-fA-F]*$/, '') + '…[truncated]'` (or cut at `MAX - 64`).
  Add a straddle pin. **DECISION: carry to ③** (the deferred max core-invariant pass) to fix-or-formally-
  accept; not applied inline so the sealed artifact == the 6-lens-reviewed artifact, respecting the
  build/review separation (a one-line latent hardening does not warrant a 4th build→review recovery cycle;
  the seal bar — zero HIGH open — is met). The module header's "cannot leak the raw string for ANY input"
  is imprecise for this fragment until the trim lands; ③ resolves it.

### Other latents / doc-accuracy (no action required for seal)
- **CM-2 [LOW, LATENT]** — `logger.ts:69-71` channel-B `FREE_TEXT_ERROR_KEYS` guards `typeof v === 'string'`,
  so a payer-bearing OBJECT under `details`/`error`/`reason` (e.g. `details:{from:'0x…'}`) skips redaction.
  Zero live callers pass those keys as object meta to the logger (grep-verified). Forward-looking debt;
  optional hardening = stringify-redact or drop non-string values under those keys, or document string-only.
- **L1 [LOW, LATENT]** — `sanitizing-adapter-logger.ts:81-88` a non-hex STRING under a payer key passes
  through verbatim (`copy` not created). No live site (all adapter payer values are `EVM_ADDRESS_RE`-
  validated `0x<40>`); the seam header already acknowledges it.
- **L2 / C2 [LOW, UNREACHABLE]** — an uppercase `0X`-prefixed payer op_id (L2) or a malformed-but-payer-
  bearing op_id at the `reconcile.ts:149` `redactOpId` fallback (C2) would pass through raw — both
  unreachable: op_ids are lowercased at construction and the builder grammar == parser grammar ==
  `ANCHORED_PAYER_OPID`, so no malformed/uppercase payer op_id is ever persisted. (`redactLogString`'s
  free-text `0[xX]` path still covers the variable-cased viem-address case.)
- **S1 / S2 / S3+CM-3 [INFO]** — seam header omits the `x402.payment_settled` payerAddress site (still
  redacted — the seam is key-based, not event-based); `reconcile.ts:107-108` cite is a stale line number
  (the regexes are at `:112-113`; grammar matches exactly); non-EVM identity keys (`payerCustomerId`,
  `consumerId`, `principalId`, `customerId`, `agentId`, `mandateId`, …) logged by 4 adapter cores are the
  documented **R2** scope boundary (this chunk is EVM-payer-scoped) — correctly untouched.

### Interactions verified SAFE (collective-miss critic, live repro)
Double-pass (seam strips payer keys → `emit()` channel-B over the same meta): seam keys ∩ FREE_TEXT keys =
∅, no key one pass strips and the other re-introduces; end-to-end drain/x402 error log → zero raw payer in
stdout, Sentry `extra`, or the exception clone. Sentry-ON path: `extra` = the sanitized meta, clone =
name+redacted-message+redacted-stack only (no `.cause`/`.errors[]`/`metaMessages`/`args`); egresses nothing
stdout doesn't. `JSON.stringify(entry)` cannot throw on a bigint (only `nonce` is numeric and the seam drops
it; all amounts are typed `string`).

---

## COMMIT-SCOPING (handle at `/seal-go`)
`apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (slugify) is a KNOWN pre-existing carry-forward, NOT
this build — stage ONLY the V-N3 files at commit, leave `tools/page.tsx` unstaged. Nothing committed/pushed
by this review (Claude cannot self-seal).

## Process / policy record
- **Orchestration:** Agent-tool spawns (operator opt-in, recommended — bypassPermissions moots the workflow
  loud-pause edge; Path-1 effort-bearing definitions ABSENT so a single workflow couldn't host a mixed/max
  lens). 5 baseline lenses spawned concurrently + the collective-miss critic after, against the assembled
  findings. Integrator integration + all live repros + the seal verdict in the main session.
- **Effort:** all 6 reviewers + integrator at session `xhigh` (operator-confirmed: core-invariant max-depth
  DEFERRED to ③, no session switch). All reviewers self-reported `claude-opus-4-8[1m]`; effort self-report
  policy-unreliable, ground-truth = session xhigh. **PATH 1 UNAVAILABLE** (no effort-bearing named-subagent
  definitions) — surfaced; resolved by the xhigh fan-out + max deferred.
- **Env clean** (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all UNSET). **Allowlist GREEN** (git/tsc/vitest/
  lint present; reviewers read-only + vitest repros; no forced-local MCP/WebFetch needed). One sanctioned
  up-front operator opt-in TAKEN (presented + waited): orchestration = Agent-tool spawns + core-invariant =
  xhigh-now/max-deferred.
- **Real assurance** = 6-lens convergence (B1–B8 closed; L-RESIDUE by 3 lenses + CM critic) + integrator
  live repro of the gate (205/4686/0), the L-RESIDUE worst case (39 nibbles) AND its fix, diff integrity
  (packages/mcp empty, build mtimes unchanged by the read-only reviewers, no stray files).

## Defect-class ledger
- **(1) allowlist/denylist completeness** (review #1 H1/M1; review #2 B1/B4) — this round: the seam's
  `PAYER_META_KEYS` was re-enumerated against EVERY adapter core log site (core-invariant + critic); all
  EVM-payer keys covered; non-EVM keys are the recorded R2 boundary. CLASS now has a behavioral canary (B3).
- **(2) "green masks an untested shape"** (review #1 central lesson; review #2 B3) — this round: every new
  redaction surface (seam, oversized-input, channelId strip, the un-masked clone pin) carries a behavioral
  pin that goes RED on its pre-fix code (proven by reverted-fix repro). The recurring lesson is discharged.
- **(3) NEW — truncation-boundary residue (cap/slice introduces a sub-floor raw-hex fragment)** — L-RESIDUE.
  The B2 cap (the fix for the M5/F1 oversized-throw class) trades the throw for a rare boundary residue.
  Recorded; carried to ③ with a verified one-line trim. SEAM-class note for the ledger: a length cap placed
  *before* a min-length redaction quantifier can resurrect a sub-floor leak at the cut.

## ROUTING
**CLEAN → operator `/seal-go` (Claude cannot self-seal) → then ③ post-seal deep audit (HIGH-STAKES).** ③
carries: the deferred **max** core-invariant pass + the L-RESIDUE fix-or-accept decision (with the verified
trailing-partial-hex trim). At commit, stage ONLY V-N3 files (exclude `tools/page.tsx`). AFTER this chunk:
chunk 2 = `invocations.metadata` dark minimization; V-N3-erasure enable unblocks only after BOTH land.
