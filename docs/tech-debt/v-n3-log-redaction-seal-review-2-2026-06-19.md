# V-N3-log-redaction — ② SEAL-GATING REVIEW #2 (of the FIX build) → **BLOCKED** (do NOT seal) — 2026-06-19

> High-stakes ② seal-gating review of the **recovery FIX build** (the working tree on `main` @ base
> `769ab9c0`), the build that claimed to close the four HIGH + two MED findings of review #1
> (`v-n3-log-redaction-seal-review-2026-06-19.md`). Orchestration: 6 fresh-context Agent-tool reviewers,
> model `claude-opus-4-8` pinned, session `xhigh`, coverage mode (5 lens-distinct: correctness/determinism,
> spec-conformance, core-invariant/PII-moat, SEAM, LITERAL-EXECUTION + 1 collective-miss critic;
> core-invariant max-depth deferred to ③ per the standing operator opt-in). Gate independently re-run
> clean+isolated by the integrator: **`tsc 0 · lint 0 err (12 pre-existing warns, none in scope) · vitest
> 204 files / 4671 tests / 0 failed`** (blocked-build baseline 4658 → +13 tests = the fix's new pins).
>
> **VERDICT: BLOCKED.** Review #1's central leaks (F1 packed-calldata, F2/M3 conditional clone, H1, M1, M5,
> H2/M2) **are genuinely closed** (integrator live repro confirms each). BUT the FIX build introduced **THREE
> new HIGH defects** — two of them LIVE-reproduced — and the green gate masks them by the **exact mechanism
> review #1 named** ("every leaking shape is untested"). Routed to the recovery loop → back to BUILD. This
> doc is the BINDING fix spec for that build.

## Tier — RE-CONFIRMED HIGH-STAKES (escalated breadth, not lowered)
The realized FIX diff is **riskier** than the first build: it now touches all 13 proxy `appLogger`s + a new
shared seam (`sanitizing-adapter-logger.ts`) + `logger.ts emit()`'s unconditional-clone path + a large new
hand-rolled guard lexer. `logger.ts emit()` remains the global-blast-radius surface (~828 sites). Stays
HIGH-STAKES; ③ still follows a clean ②.

---

## BLOCKING findings (HIGH — all must close before re-entering ②)

### B1 [HIGH, LIVE — reproduced against the real seam module] — the sanitizing seam does NOT strip a NON-STRING payer-key value; the drain channel **nonce** (a `number`) egresses raw
`apps/web/src/lib/sanitizing-adapter-logger.ts:54-70`. `sanitizeAdapterMeta` does
`for (const k of PAYER_META_KEYS) { … if (typeof v !== 'string') continue; … }`. The drain adapter logs
`nonce: voucher.nonce` (`packages/mcp/src/adapters/drain.ts:588`), and `DrainVoucher.nonce` is a **`number`**
(`drain.ts:134`; parsed numeric at `:192-193`, `Number.isFinite`-checked at `:199`). `nonce` IS in
`PAYER_META_KEYS`, but the `typeof v !== 'string'` guard **skips it**, so the raw numeric nonce forwards to
`@/lib/logger` → stdout (Vercel/Datadog) + Sentry on **every accepted drain payment** (`validateDrainPayment`
→ the seam-wired `appLogger`, `drain-proxy.ts:21/37`).
- **Integrator repro (RED, real module):** a tmp vitest exercising `createSanitizingAdapterLogger().info(
  'drain.payment_accepted', { channelId:'0x'+'b'×40, payerAddress:'0x'+'a'×40, amountBaseUnits:'1000000',
  nonce: 42 })` → forwarded meta `{"channelId":"0xbbbb…","payerAddress":"0x<redacted>","amountBaseUnits":
  "1000000","nonce":42}`. `payerAddress` correctly redacted; **`nonce:42` survives verbatim.**
- **Why it's in scope (not "benign"):** review #1's M1 explicitly named `drain.ts:583 drain.payment_accepted
  { payerAddress, nonce }` as a LIVE leak with "raw payer AND raw **channel nonce**" that the seam MUST close,
  and the recovery build's own §13 resolution log CLAIMS the seam "strips/redacts the payer key set
  `{…nonce, drainNonce}`." That claim is FALSE for the live drain path. The DC-16 thesis is literally "no raw
  payer/**nonce** in our logs." (One reviewer rated this LOW on the grounds the drain nonce is a small
  channel-sequence integer rather than the 64-hex EIP-3009 nonce; the integrator adjudicates it **HIGH** —
  it is an unmet binding-spec requirement + a false manifest claim + a general seam type-bug that would miss
  ANY future non-string payer value, e.g. a bigint nonce or an object payer.)
- **Fix direction:** in `sanitizeAdapterMeta`, for a key in `PAYER_META_KEYS` whose value is NOT a string, do
  NOT early-`continue` — **DROP the key** (or replace with a non-reversible marker). Coerce-and-redact is
  INSUFFICIENT: `redactLogString(String(42)) === '42'` (a small decimal has no `0x`/≥40-hex shape — integrator
  confirmed), so the raw nonce would survive a `String()` pass. The same non-string skip exists in `emit()`'s
  free-text pass (`logger.ts:71`) — that one carries prose and has no live hit, but note it. **Pin it (B3).**

### B2 [HIGH, LIVE — reproduced] — the greedy `LONG_HEX_RUN` THROWS out of `emit()` on a large hex run (M5 failure-class REINTRODUCED by the F1 fix)
`apps/web/src/lib/settlement/log-redaction.ts:51` `LONG_HEX_RUN = /0[xX][0-9a-fA-F]{40,}/g`. The unbounded
`{40,}` quantifier makes V8's `String.prototype.replace` overflow the call stack on a single contiguous match.
- **Integrator repro (RED):** `("0x"+"a".repeat(6*1024*1024)).replace(LONG_HEX_RUN,'0x<redacted>')` →
  `RangeError: Maximum call stack size exceeded` (threshold ≈ 5.3 MB; 1 MB & 4 MB OK, 6 MB & 8 MB throw). The
  OLD bounded `{64}`/`{40}` patterns do NOT throw (each match capped) — so this is a **fix-introduced
  regression**, not pre-existing.
- **Escapes `emit()`:** `redactLogString` is invoked at `logger.ts:72,106,109,125` — ALL **outside** the only
  `try` (`:145`, which wraps just the Sentry capture). A `RangeError` therefore propagates out of `emit()`,
  drops the log line, and alters control flow inside the surrounding `catch` blocks — **precisely the M5
  failure mode** the recovery build claims to have closed (it guarded only *non-string* messages, not
  *oversized* ones). Affects `info`/`warn` (free-text meta, no try at all), the err-channel, the non-Error
  `String(err)` path, and the seam's `redactLogString` reuse.
- **CM-2 compound:** the **M5 fix can MANUFACTURE this throw** — `redactLogString(String(err.message))`
  (`logger.ts:106-108`); a non-string `.message` coercing to a ≥5.3 MB hex run overflows. Integrator repro:
  `String({toString:()=>'0x'+'a'.repeat(6e6)})` → `redactLogString` → `RangeError`. B2 and M5 share one
  unprotected throw site — **fix them as one.**
- **Reachability:** low but real (viem on-chain errors format calldata/revert-`data`/RPC payloads into
  `err.message`/`.stack`; a large `eth_call` return can approach MB-scale). Treat as seal-blocking regardless
  of trigger rarity — it is an unguarded throw out of the logging path the chunk is chartered to make safe.
- **Fix direction:** make `redactLogString` **incapable of throwing out of `emit()` for ANY input**, at the
  single shared chokepoint. **Preferred:** cap input length inside `redactLogString` (e.g. truncate to a safe
  max — 256 KB — with a `'…[truncated]'` marker BEFORE the regex), which covers the err-channel + free-text +
  M5-coerced + seam reuse in one place; OR wrap each `redactLogString` invocation in a `try` with a coarse
  `'[redaction-failed]'` fallback. **REJECT the "just bound the quantifier to `{40,N}`" fix** — the integrator
  confirmed a single run longer than the bound leaves a **bare-hex tail residue** (`131122`-nibble run →
  leftover `aaaa…`), trading the throw for a new (cosmetic, but messy) residue. Add an oversized-input pin
  (≥6 MB hex → no throw, redacted/truncated).

### B3 [HIGH, LIVE] — the sanitizing seam ships with ZERO behavioral test; the "green masks the leak" lesson was RE-COMMITTED
`apps/web/src/lib/sanitizing-adapter-logger.ts` has **no unit test that calls it and inspects what egresses.**
The only test referent is a STATIC text-scan in the guard (`log-redaction-guard.test.ts:427-429`,
`scanSource('logger.info(event, sanitizeAdapterMeta(data) ?? {})')`) — it never runs the factory. So the
entire H1+M1 fix surface has no runtime pin: no green test asserts `payerAddress` is stripped, `channelId`
survives, or `nonce` is handled — which is exactly **why B1 shipped invisibly**. Review #1's central lesson
("the green gate masks the leaks — every leaking shape is untested") was re-committed for the seam.
- **Fix direction:** add `apps/web/src/lib/__tests__/sanitizing-adapter-logger.test.ts` that feeds the THREE
  real adapter metas — x402 `{ payerAddress: '0x…' }`, drain `{ payerAddress:'0x…', channelId:'0x…',
  nonce:<number> }`, circle-nano `{ payer:'0x…' }` — through the factory's `info`/`warn`/`error`, mocks
  `@/lib/logger`, and asserts NO raw payer / nonce / (per B4) channel-address survives, AND that correlation
  keys (`toolSlug`, `amountBaseUnits`) pass through. This pins the seam AND would go RED on B1.

---

## MEDIUM finding — resolve with a RECORDED decision in the build

### B4 [MED, LIVE — scope-boundary decision] — drain `channelId` (raw `0x<40>` channel address) survives both the seam and the guard
`packages/mcp/src/adapters/drain.ts:585` `channelId: voucher.channelAddress` — a raw EVM address
(`EVM_ADDRESS_RE`-validated, `drain.ts:208`) — forwards raw to stdout/Sentry. `channelId`/`channelAddress` is
in NEITHER `PAYER_META_KEYS` NOR the guard's `FORBIDDEN` set (the two miss it identically — found by the
core-invariant, SEAM, and literal-execution lenses). It is the payment-channel CONTRACT address (for hosted
drain a shared configured channel via `getDrainChannelAddress()`), **not** the payer EOA, and review #1's M1
enumerated only `payerAddress`+`nonce` for drain — so it is outside the literal named scope. But it is a
per-channel on-chain identifier that compounds B1 (channel address + nonce reconstructs the channel-payment
identity), and the seam's own header claims it strips "the payer key set" while an address survives past it.
- **Decision required (record it either way):** **(Recommended) STRIP it** — add `channelId` +
  `channelAddress` to `PAYER_META_KEYS` and the guard `FORBIDDEN` set. Cheap, closes a raw-address egress, and
  safe for observability: the drain runbook recovers `(channelAddress, nonce)` from the DB row by `id`
  (`invocations.metadata.drainChannelId` is untouched — chunk-2 work), not from the log. We are rebuilding the
  seam for B1 anyway. **OR** document explicitly in the seam header + the DC-16 scope wording that the drain
  channel address is accepted as non-PII. Do NOT leave it a silent gap.

---

## LOW / durability (fix in the same build unless noted)

- **B5 [LOW] — the existing `captureException` pin is a MASKING test (does not protect F2).**
  `apps/web/src/lib/__tests__/logger.test.ts:144` still asserts `toHaveBeenCalledWith(err, …)` (original
  identity). Post-F2 the clone is always passed, never `err`; the pin passes only because vitest deep-equality
  treats the structurally-equal clone of `new Error('boom')` as equal — and (CM-3) **it would still pass if F2
  were reverted** (clean message → old conditional gate → no clone → original err → also deep-equal). So it
  gives ZERO regression protection for the unconditional-clone behavior (F2 is otherwise correctly pinned by
  the new `.cause`/AggregateError tests). **Fix:** rewrite line 144 to assert `capturedErr !== err` (a distinct
  clone) with the redacted message + name preserved.
- **B6 [MED, durability — LATENT] — the guard lexer is blind to a regex-literal arg.**
  `matchClose`/`captureValue` (`log-redaction-guard.test.ts`) skip strings/templates/comments but treat a
  regex literal's body as code: a `)` in a regex char class closes the span early (hiding a SUBSEQUENT
  forbidden key — a silent miss), a `(` causes a runaway false-positive. No live logger call carries a regex
  arg today (verified) — so LATENT — but the guard is the durable DC-16 anti-regression and its header
  overclaims robustness. **Fix:** add regex-literal recognition (expect-regex vs expect-division context) OR
  document the blind spot + add a self-test pinning current behavior.
- **B7 [LOW, LATENT] — guard provenance allow is still NAME-based for dotted paths.**
  `isAllowedValue` passes ANY `X.id` by name (`{ operationId: attacker.id }` would slip); the "provenance"
  tightening only fixed the bare-identifier case. All live `.id` slots are de-identified PKs (verified).
  **Fix:** restrict the dotted-`.id` allow to known PK-source names (`row.id`/`current.id`/`existing.id`/
  `rowId`) OR document the residual + soften the header's "provenance" overclaim.
- **B8 [LOW, LATENT] — guard call-detection + spread blind spots.** Misses an alias not ending in `logger`
  (`const l = logger; l.error`), a destructured `const { error } = logger`, a member-chain `svc.log.error`,
  `logger.log/.debug/.fatal`, and spread-into-meta (`{ ...bag }`). Zero live offending sites (verified —
  spread sources carry only numeric counts). **Fix:** document the documented blind spots (or broaden) so the
  header does not overclaim completeness.

## RECORD-ONLY (no action; consistent with accepted design)
- **R1 — `LONG_HEX_RUN` misses bare (no-`0x`) hex.** Every live free-text payer/nonce source is `0x`-prefixed
  (viem renders address/`bytes32` args `0x`-prefixed; op_ids carry `0x` halves) — LATENT, = the accepted F5
  latent class (handoff §13). A leading-boundary bare-hex rule would over-redact legit hex; leave recorded.
- **R2 — non-EVM rail identifiers** (mpp/acp `payerCustomerId` Stripe `cus_`, ap2 `consumerId`/`mandateId`,
  kyapay `principalId`/`tokenId`, mastercard `intentId`, tap `tokenReferenceId`/`authorizationCode`, l402
  `macaroonId`/`preimagePrefix`) — none are the EVM payer/nonce this chunk scopes; correctly untouched by the
  fixed `PAYER_META_KEYS`. Record as the chunk's scope boundary.
- **R3 — cosmetic double-redaction when a payer-op_id abuts trailing hex.** `…:{nonce}ff…` defeats EMBEDDED's
  trailing lookahead → falls through to `LONG_HEX` → `{rail}:{net}:0x<redacted>:0x<redacted>` instead of
  `:anon`. **No PII leaks** (both halves redacted). Optional: drop the EMBEDDED trailing lookahead (LONG_HEX
  already prevents nonce-prefix splitting) to restore the `:anon` triage form.

## COMMIT-SCOPING (not a build defect — handle at seal/commit)
- **`apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`** carries an unrelated `slugify` edit. This is a
  KNOWN PRE-EXISTING carry-forward (cadence-state: "unrelated uncommitted carry-forward, out of scope,
  untouched"), NOT introduced by this build. When the V-N3 chunk is eventually committed, **stage only the
  V-N3 files** and leave `tools/page.tsx` unstaged. Flagged so it never rides the V-N3 seal.

---

## CONFIRMED CLEAN — review #1's leaks ARE closed; preserve these (do NOT re-litigate in the fix build)
6-lens convergence + integrator LIVE repro certified each:
- **F1 (+F4) — CLOSED.** Greedy `LONG_HEX_RUN` + `EMBEDDED_PAYER_OPID`-first redacts the packed
  `transferWithAuthorization` calldata blob whole (integrator: OLD leaks from+nonce `true/true`; NEW
  `0x<redacted>` `false/false`), the `0x<64>`+hex residue, and the uppercase `0X`; idempotent; nonce not
  split. Named pins added. (The ONLY residue is B2's oversized-throw — a different axis.)
- **F2 / M3 — CLOSED.** The sanitized clone is UNCONDITIONAL for `err instanceof Error`; copies only name +
  redacted message + redacted stack; `.cause` / AggregateError `.errors[]` / `.metaMessages` / `.args` dropped
  (integrator + reviewers: absent from `captureException`); Sentry grouping preserved via `clone.name`
  (incl. `AggregateError`); instrumentation has no `beforeSend`/custom-integration/fingerprint dependency on
  the dropped props. (Only the line-144 pin is stale — B5.)
- **M5 — CLOSED for the non-string axis.** `typeof` guards on BOTH `err.message` and `err.stack`;
  `String(Symbol)` does not throw. (The oversized-input throw is B2.)
- **H1 — CLOSED.** `circle-nano-proxy.ts:133` logs only `toolSlug`+`amountBaseUnits`; raw `payer` dropped at
  source.
- **M1 seam wiring — COMPLETE.** All 13 proxies (`acp, alipay, ap2, circle-nano, drain, emvco, kyapay, l402,
  mastercard, mpp, ucp, visa-tap, x402`) use `createSanitizingAdapterLogger()`; no raw forwarder remains; the
  `AdapterLogger` contract (`{info,warn,error}`) matches every adapter-core call shape; `git diff HEAD --
  packages/mcp` is EMPTY (SDK untouched). (The seam's string-only gap is B1; channelId is B4.)
- **H2 / M2 guard — reworked + non-vacuous.** Aliased/dynamic/quoted/computed forms + `payerAddress`/
  `drainNonce` keys + provenance rejection of `someId`/`hopId` + seam coverage; RED/GREEN self-test per form;
  the real-file scan walks >100 files and finds zero raw payer keys. (Residual blind spots are B6/B7/B8 —
  LATENT.)
- **Zero-behavioral-change / frozen surfaces — HELD.** Only log-args + the sanctioned `emit()` sanitizer + the
  seam changed; E1 (`export settlementEntryId`) + E2 (`.select` `operationId→id`) are the only non-log edits;
  `logger.ts` public API byte-identical; no `markSettlement*`/`findSettlementRow`/`parseSettlementOperationId`/
  `PAYER_OPID_SQL_REGEX` edit; no schema/migration/deps; no V-N3-erasure file touched.
- **Runbook lockstep + test edits — faithful.** Both runbooks re-keyed to PK `id`; `(from,nonce)` recovered
  from the DB row by id; the ~16 settlement log-assertion edits use the REAL `settlementEntryId` via
  `importOriginal` and the projected `id` — none loosened; the two deleted `payer:` assertions match a real
  source-side field drop, not masking. `redactOpId` grammar + `settlementEntryId` purity (== stored PK `id`)
  untouched.

---

## Process / policy record
- **Orchestration:** Agent-tool spawns (operator opt-in, recommended default — bypassPermissions moots the
  workflow loud-pause edge; Path-1 effort-bearing definitions absent so a single workflow couldn't host a
  mixed-effort/max lens). 5 baseline lenses spawned concurrently + the collective-miss critic after.
- **Effort:** all 6 reviewers + integrator at session `xhigh` (core-invariant max-depth DEFERRED to ③ per the
  standing opt-in). All reviewers self-reported `claude-opus-4-8[1m]`; effort self-report unreliable per
  policy, ground-truth = session xhigh. PATH 1 UNAVAILABLE (no effort-bearing named-subagent definitions) —
  surfaced; resolved by the xhigh fan-out + max deferred (no session switch).
- **Env clean** (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all unset). **Allowlist GREEN** (git/tsc/vitest/lint
  present; no forced-local MCP/WebFetch needed). **Gate** re-run clean+isolated: `tsc 0 · lint 0 err/12 warn ·
  vitest 204/4671/0`. The green gate masks B1/B2/B3 — every new failing shape (numeric nonce, oversized hex,
  the untested seam) had no pin. **This is the recurring lesson; the fix build MUST add the missing pins.**
- **Real assurance** = 6-lens convergence (B1 by core-invariant + critic; B2 by correctness + critic; B4 by 3
  lenses; B3 by the critic) + integrator LIVE repro of B1 (real seam module), B2 (RangeError), and the C1 fix
  caveat (bounded-quantifier tail residue) + frozen-surface + non-vacuity ground-truth.
- **Defect-class recurrences (for the ledger):** (1) **key-name allow/deny-LIST vs provenance** — B1 (the key
  IS listed but the VALUE type escapes the strip) and B4 (the key is not listed at all) are the same
  allowlist-completeness class that produced review #1's H1/M1. (2) **"green masks an untested shape"** — B3
  re-commits review #1's central lesson; the durable fix is a behavioral pin on EVERY redaction surface
  (the seam had none).

## ROUTING
**BLOCKED → recovery loop → BUILD.** This doc is the binding fix spec. Build sequence (single-writer, fresh
context, `claude-opus-4-8` + `xhigh`): **B2** unify the oversized-input guard (cap length / try-fallback at the
`redactLogString` chokepoint; covers the err-channel + M5-coerced + seam reuse; NOT a bare bounded quantifier)
→ **B1** seam drops (not coerces) a non-string payer-key value → **B4** decide+record channelId (recommend
strip) → **B3** add the seam behavioral test (the canary for B1/B4) → **B5** un-mask the line-144 pin → **B6/B7/B8**
harden-or-document the guard blind spots → add the B2 oversized-input pin → gate green + interval self-verify →
re-enter ② seal-gating review (#3). PRESERVE the entire CONFIRMED-CLEAN set untouched. Do NOT pull in deferred
work (chunk-2 `invocations.metadata`, a Sentry `beforeSend`, `packages/mcp` edits) or perturb a frozen surface.
Then ③ (this chunk stays high-stakes). AFTER this chunk: chunk 2 = `invocations.metadata` dark minimization;
V-N3-erasure enable unblocks only after BOTH land.
