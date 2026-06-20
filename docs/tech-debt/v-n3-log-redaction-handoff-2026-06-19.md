# V-N3-log-redaction — settlement-log + Sentry payer/nonce redaction (META + ERR channels) — ① BUILD HANDOFF (2026-06-19, plan-audited)

> Standalone build handoff. READ THIS FIRST (step zero), before any code. Read alongside it:
> `v-n3-erasure-post-seal-deep-audit-2026-06-19.md` (the ③ that surfaced this leak — the DC-16
> census gap), the DC-16 ledger `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`, and the
> two operator runbooks this chunk must edit in lockstep: `t-credited-at-runbook-2026-06-10.md` +
> `v-pending-lifecycle-runbook-2026-06-12.md`. Repo `/Users/lex/settlegrid`; gate from `apps/web`.
> Base = `main` @ `769ab9c0`. **A 6-lens pre-build plan audit folded the findings below — they are
> binding.**

## 1. Intent — why, who consumes, what it enables
The V-N3-erasure ③ found the "no payer address in any log/Sentry sink" premise is FALSE: the settlement
subsystem egresses the raw EVM payer address + EIP-3009 nonce to stdout (Vercel/Datadog) AND Sentry, on
**two channels**: (A) the **meta** object of ~50 `logger.*` calls (directly as `from`/`nonce`/`payer`/
`payerIdentifier`, and embedded in the raw `operation_id` = `{rail}:{network}:{payer}:{nonce}`), and (B)
the **`err` 3rd argument** of `logger.error(key, meta, err)` — `err.message`/`err.stack` flow to stdout
AND `Sentry.captureException(err)` (logger.ts:44-49, 70), carrying the payer+nonce when `err` is a viem
on-chain error (the `transferWithAuthorization`/`readContract` call args include `from`+`nonce`) or a
Postgres error echoing the `operation_id` from a `WHERE operationId=…`. **This chunk REDACTS BOTH
channels** and makes the honesty claim TRUE — while PRESERVING the operator's row-level correlation
(via the de-identified PK `id`) so incident-response runbooks keep working. **Consumer:** the DC-16
honesty posture + the V-N3-erasure ENABLE gate (one of two census surfaces blocking the flag).
**Enables:** an honest "no payer in our logs/Sentry" posture; with chunk 2 (§11), the removal of the
DC-16 over-statement blocker on V-N3-erasure's enable.

## 2. Tier — HIGH-STAKES
PII (raw EVM payer + nonce) + a third-party-egress boundary (Sentry/Datadog) + edits the money-rail
settlement code (reconcile/orchestrate/settle — observability the runbooks depend on) + edits two
operator runbooks + affects a disclosed honesty claim (DC-16). Uncertain → high-stakes. ② re-confirms.

## 3. Scope
**IN:**
- (a) **`redactOpId()`** pure helper (new `apps/web/src/lib/settlement/log-redaction.ts`): a payer-bearing
  op_id `{rail}:{network}:0x<40>:0x<64>` → `{rail}:{network}:anon`; non-payer op_ids (hop UUIDs, other-rail
  shapes) UNCHANGED. **Use three capture groups** `^(x402|circle-nano):(eip155:\d+):0x[0-9a-fA-F]{40}:0x[0-9a-fA-F]{64}$`
  (so `{network}` is recoverable for the return) OR delegate to `parseSettlementOperationId`. Reuse the
  canonical grammar (reconcile.ts:107-108 / anonymize-payer.ts:51-52) — do NOT invent a shape.
- (b) **EXPORT `settlementEntryId`** (ledger.ts:396, currently private) and use it as the CORRELATION-
  PRESERVING redacted key: `settlementEntryId(operationId)` = the de-identified PK `id` (sha256, row-unique,
  pure, no DB round-trip). This is the PRIMARY replacement at payer-bearing op_id log sites — NOT
  `redactOpId` — because `{rail}:{network}:anon` collapses ALL settlements on a rail/network to one string
  and DESTROYS the runbook's grep-by-op_id correlation (DC-18). `redactOpId` is the FALLBACK only for
  array elements and non-payer shapes (it passes those through). Where a `findSettlementRow` row is already
  in scope, log its `.id` directly (same value, no recompute).
- (c) **CHANNEL A (meta) — per-site redaction** at every settlement/proxy `logger.*` site emitting a raw
  payer-bearing op_id or a direct `from`/`nonce`/`payer`/`payerIdentifier`/`invocationId` field: swap the
  raw op_id for the de-identified PK key (b); REMOVE the direct from/nonce/payer fields (§6.0). The full
  corrected inventory is §6.
- (d) **CHANNEL B (err) — a central sanitizer in `logger.ts emit()`.** `redactLogString(s)` rewrites, in a
  free-text string: (i) any full payer-op_id shape → `{rail}:{network}:anon`, and (ii) standalone
  `0x[0-9a-fA-F]{40}` and `0x[0-9a-fA-F]{64}` hex → `0x<redacted>`. Apply it in `emit()` to `entry.error`,
  `entry.stack`, and the `err` passed to `Sentry.captureException` (sanitize message/stack before capture),
  AND to meta string values on the FREE-TEXT error keys only (`error`/`reason`/`message`/`details`/`stack`)
  — NOT to structured `txHash`/`recipient`/`to` fields (those are legitimately needed; over-redacting them
  would blind debugging — see §5#4). Inlined `error: err.message` meta fields (route.ts:774/1300/1658/
  1672/2717, verify.ts:377) are covered by this free-text-key pass. Over-redaction of a recipient/tx-hash
  that appears INSIDE a viem error STRING is acceptable collateral (the structured txHash field is logged
  separately). (NOTE: this narrow err/stack/error-key sanitizer is the ONE sanctioned `emit()` change — it
  is NOT the broad "scrub every meta value" scrubber the audit rejected; that remains OUT, see §5#5.)
- (e) **The grep-guard COMPLETENESS test** (the durable DC-16 anti-regression) — §8/§9 give the concrete
  call-span spec. Forbidden key set: `operationId|operation_id|from|nonce|payer|payerIdentifier|invocationId|operationIds`.
  Repo-wide scope (`apps/web/src/**`, excluding `__tests__`).
- (f) **Update the two runbooks in lockstep** (`t-credited-at-runbook`, `v-pending-lifecycle-runbook`):
  closure SQL keys on the PK `id` (not the raw `operation_id`); the on-chain-attribution step reads
  `(from,nonce)` from the DB row BY `id` (no longer from the log). See §5#3.
- (g) **Update the ~16+ existing logger test assertions** that bind a raw op_id/payer (they break under
  redaction — they ARE the equivalence canary + the proof those sites leak). §9 gives the discovery step.
- (h) Unit pins for `redactOpId` + `redactLogString` + the err-channel.

**EXCLUDED (do NOT pull in):**
- **The `invocations.metadata` payer minimization** — the SECOND DC-16 census surface. IMMEDIATE NEXT chunk
  (§11), NOT this one.
- **Any behavioral change to settlement logic** — only log arguments + the two sanctioned read-only
  exceptions (§4) change. Money/control flow byte-unchanged.
- **The HTTP response-body `operationId`** (ap2/circle-nano/demo settle routes): CONFIRMED out — those op_ids
  are `randomUUID`/synthetic, NOT payer-bearing (the audit verified), and it is the SettlementResult API
  contract / self-disclosure to the submitting caller. Named so it is weighed, not missed.
- Other EVM addresses (gas-wallet/recipient) as STRUCTURED fields — not the third-party payer; don't redact
  the structured `recipient`/`to`/`txHash` fields (§5#4).
- The V-N3-erasure files / `packages/mcp` adapters (see §11 scope-boundary note).

## 4. Zero-behavioral-change constraint + the TWO sanctioned exceptions
Redaction is confined to (i) `logger.*` meta-argument values, (ii) the central `emit()` err/stack/error-key
sanitizer, and (iii) TWO sanctioned READ-ONLY exceptions that feed ONLY a log and have no money/control-flow
effect: **(E1)** export `settlementEntryId` (a pure function; adding `export` changes nothing); **(E2)** add
`id` to the `.select()` at reconcile.ts:962-967 (a read-only projection feeding only the
`reconcile.uncredited_settled` log). The op_id value is consumed PERVASIVELY (idempotency keys, CAS keys,
lock keys, DB WHEREs) — so every edit MUST touch ONLY the token inside the `logger.*(key, {meta})` literal
(and the emit() sanitizer), NEVER the `const operationId` binding or an argument to a non-logging callee.
The FULL existing settlement/reconcile/x402/circle-nano/proxy suite stays green EXCEPT the ~16 log-assertion
updates (§3g) — those are the only legitimate test edits; any OTHER suite breakage is a real regression.

## 5. Load-bearing decisions (where ② concentrates — most likely SILENTLY WRONG)
1. **COMPLETENESS across BOTH channels (the DC-16 census class).** A missed meta site OR a missed err-channel
   path re-leaks and re-falsifies the claim. The audit found 4 meta misses beyond the obvious set — folded
   into §6: **ledger.ts:481** (`invocationId: input.invocationId` = the raw op_id, error→Sentry — AND the
   field name `invocationId` was also missing from the guard key set), **settled-value.ts:144** (sibling of
   :187), **reconcile.ts:220** (sibling of settled-value:136), **reconcile.ts:1129** (a SECOND
   `operationIds: [...]` array, error→Sentry, beyond the :968 one). The err channel (decision #2) is the
   other half. The grep-guard (§8/§9) is the durable enforcement and MUST be non-vacuous.
2. **THE ERR CHANNEL (the audit's central finding).** Meta-only redaction is provably INSUFFICIENT.
   viem errors at **x402/settle.ts:293, verify.ts:384, verify.ts:459** carry the raw `from`+`nonce` in the
   `transferWithAuthorization`/`readContract`/Permit2 call args formatted into `err.message`/`err.stack`;
   Postgres errors at **reconcile.ts:444/1125, route.ts:1789, ledger.ts:481** echo the raw `operation_id`
   from a `WHERE operationId=…`. All reach `Sentry.captureException(err)` + stdout. The central `emit()`
   `redactLogString` sanitizer (§3d) is the fix — it must sanitize err.message + err.stack + the
   captureException err. Silently-wrong failure: redacting the meta and shipping while the err channel still
   egresses payer+nonce to Sentry (the honesty claim stays FALSE). The viem-error standalone-hex case is the
   subtlest: the from/nonce appear as bare `0x…` hex (NOT a full op_id), so the op_id regex alone misses them
   — `redactLogString` MUST also redact standalone `0x<40>`/`0x<64>` in the free-text err string.
3. **CORRELATION PRESERVATION (DC-18 — observability must not silently degrade).** `redactOpId`'s
   `{rail}:{network}:anon` is IDENTICAL for every settlement on a rail/network → it DESTROYS the operator's
   grep-by-op_id incident timeline. The de-identified PK key `settlementEntryId(operationId)` (decision (b))
   is row-unique and preserves correlation — use it, NOT `redactOpId`, at the ~8 id-less credit/closure
   sites (reconcile.ts:435/440/442/444, settled-value.ts:136/144/187/197/206, route.ts:1768/1770) and at
   the §6.A row-bearing sites (their `.id`). **Runbook lockstep (§3f):** `t-credited-at-runbook` closure SQL
   (`WHERE operation_id=…` at :74/91/144) and `v-pending-lifecycle-runbook` (`WHERE operation_id` :46 + the
   `(from,nonce)` on-chain `AuthorizationUsed` attribution :49-58/:75) currently key on values this chunk
   removes from the logs. They MUST be edited to key on the PK `id` (the uncredited-sweep carve-out rows keep
   their raw op_id in the DB — resolvable by id) and to read `(from,nonce)` from the DB row by id. Shipping
   the code without the runbook edits strands the operator (DC-18). The off-band-refund step (t-credited-at
   :66/72) is "keyed by txHash + payer" — redaction drops `payer`; confirm txHash alone suffices or note it.
4. **NO OVER-REDACTION.** redactOpId's anchored full-op-id regex correctly EXCLUDES bare tx hashes / addresses
   / UUIDs / the other 5 rails (audit-verified). `redactLogString`'s standalone-hex redaction (decision #2)
   DOES over-redact addresses/hashes — that is ACCEPTABLE only in FREE-TEXT err/stack/error strings, and MUST
   NOT be applied to structured `txHash`/`recipient`/`to`/`storedRef`/`currentRef`/`broadcastTxHash` meta
   fields (those stay intact for debugging). The emit() sanitizer keys this off the FIELD NAME (free-text
   error keys only), never a blanket all-meta walk.
5. **The grep-guard is implementable ONLY as a call-span scan with an ALLOW-LIST (not a line/file regex).**
   `operationId,` shorthand appears in BOTH log metas AND non-log call args (e.g. `resolveInRequestCreditCents({operationId})`)
   in the same files — a line regex ships vacuous or false-positive. §8 gives the concrete spec. The broad
   "scrub every meta value in emit()" scrubber is OUT (828-site blast radius, over-redaction, perf — audit
   rejected it); the narrow err/stack/error-key sanitizer (#2) is its replacement and is in.

## 6. Site inventory (audit-corrected — RE-GREP live; the grep-guard is the bar, not these numbers)
**6.0 — DIRECT payer/nonce/payer fields (REMOVE the field):**
- `reconcile.ts:704-710` (error→Sentry) — drop `from`/`nonce`; redact op_id via PK key. (Edit ONLY the meta;
  the consumed `parsed.eip3009.*` reads at :683 stay.)
- `proxy/[slug]/route.ts:1668-1670, 1795-1797, 1807-1809` (error→Sentry) — drop `payer: payerIdentifier`.
- `x402/settle.ts:267-273` (info) — drop `from: authorization.from` (NOT op_id-embedded; explicit).

**6.A — sites with the row/PK `id` already in scope → log `.id`:** reconcile.ts:163 (`current`), :273
(`current`), :724 (`row.id`, the expiry-candidate row — id is the PK), :546 (`rowId` param = PK);
orchestrate.ts:222 (`row`), :414 (`existing`), :527 (`row`), AND reclassified from 6.B by the audit: :294
(`current`), and any with a findSettlementRow result; circle-nano/settle.ts:173 (`row`), :312 (`existing`),
:399 (`row`), AND reclassified: :240 (`current`), :426 (`existing`). [orchestrate:260 & circle-nano:209 are
ASSIGNMENTS, not logs — the audit corrected this; the real `*_onchain_success` logs at orchestrate:241 /
circle-nano:194 have NO id in scope → 6.B.]

**6.B — sites with only the op_id string → `settlementEntryId(operationId)` (correlation-preserving), or
`redactOpId(operationId)` where a non-payer shape is possible:** reconcile.ts:144,153,190,232,257,282,289,
301,364,429,435,440,442,444,1125; orchestrate.ts:241,277,309,328,338,350,369,404,494; circle-nano/settle.ts:
194,227,249,263,270,279,286,310; settled-value.ts:136,144,187,197,206; proxy/[slug]/route.ts:1768,1770.
The credit/closure cluster (reconcile.ts:435/440/442/444, settled-value.ts:136/144/187/197/206, route:1768/
1770) → use `settlementEntryId(operationId)` per #3.

**6.B-arrays — `operationIds: [...]` (error→Sentry):** reconcile.ts:962-973 (`uncredited_settled` — add `id`
to the `.select()` (E2) and log `sample.map(s=>s.id)`); reconcile.ts:1129-1131 (`watermark_update_failed` —
`watermarkFailedOps` holds raw op_ids pushed at :1111; map per-element `settlementEntryId`/`redactOpId`, OR
restructure to push `id`).

**6.C — ERR-channel sites (channel B, handled centrally by §3d — listed so the test pins them):**
viem: x402/settle.ts:293, verify.ts:384, verify.ts:459. PG/op_id: reconcile.ts:444, 1125, route.ts:1789,
ledger.ts:481. Inlined `error: err.message` meta: route.ts:774,1300,1658,1672,2717; verify.ts:377.

**6.D — `invocationId` alias (channel A, was missed):** ledger.ts:481-489 `settlement.ledger_write_failed`
logs `invocationId: input.invocationId` = the raw payer op_id (error→Sentry; `invocationId===operationId`
for these rails per orchestrate.ts:158 / settle.ts:106). Redact via the PK key; the `err` 3rd-arg here is
also channel B.

**Non-payer (verify, pass through):** sessions.ts hop op_ids (`hopId`, bare UUIDs); reconcile.ts:144
unparseable op_ids (redactOpId passes a non-matching string through). The audit confirmed `console.*`,
thrown-Error messages, webhooks, audit_logs carry NO settlement op_id/payer.

## 7. Frozen / unchanged
Settlement money-rail LOGIC (`markSettlement*`, `findSettlementRow`, `refreshPendingValidBefore`,
`recordSettlementEntry`, `parseSettlementOperationId`, control flow) — only log args + the §4 E1/E2
read-only exceptions change. `PAYER_OPID_SQL_REGEX`/`parseSettlementOperationId` (reuse). The V-N3-erasure
files. No schema/migration, no new deps. `logger.ts` public API (info/warn/error signatures) unchanged — the
sanitizer is internal to `emit()`.

## 8. Design (direction — build refines)
- `log-redaction.ts`: `redactOpId(opId: string|null|undefined): string` (anchored 3-group regex → `{rail}:{network}:anon`; non-match/null passthrough/`'unknown'`; pure). `redactLogString(s: string): string` (rewrite full payer-op_id shape → `:anon`; standalone `0x<40>`/`0x<64>` → `0x<redacted>`; pure, idempotent).
- Export `settlementEntryId` from ledger.ts; import where a payer-bearing op_id is logged without a row.
- `emit()` (logger.ts): before building the JSON line + before `Sentry.captureException`, apply
  `redactLogString` to `err.message`/`err.stack` (or a sanitized copy) and to meta values whose KEY ∈
  {error,reason,message,details,stack}. Do NOT touch other meta keys (per-site handles those).
- **Grep-guard (concrete, non-vacuous):** a vitest that `readFileSync`-walks `apps/web/src/**` (exclude
  `__tests__`/`*.test.ts`; ASSERT the file list is non-empty — DC-05); for each `logger.(info|warn|error)(`
  occurrence, balance-scan delimiters to the matching close to get the call's argument span; within that span
  FAIL if any forbidden key (`operationId|operation_id|from|nonce|payer|payerIdentifier|invocationId|operationIds`)
  appears as `key:` bound to anything NOT in the ALLOW-LIST (`redactOpId(`, `settlementEntryId(`, `redactLogString(`,
  a bare `id`/`...Id` PK read, a `.map(...=>redactOpId(`/`settlementEntryId(`), OR as a bare shorthand `key,`/`key}`
  (shorthand is ALWAYS raw → forbidden). Allow-LIST, not deny-list (catches the `{operationId: op}` alias).
  Include a self-test: the guard flags a synthetic `logger.info('x',{operationId})` and passes
  `logger.info('x',{operationId: settlementEntryId(operationId)})`.

## 9. Test plan
- `redactOpId` pins: x402/circle-nano payer op_id → `:anon`, no `0x`; hop UUID / non-payer → unchanged;
  bare tx hash (0x<64>) / bare address (0x<40>) ALONE → unchanged (no false redaction); null → `'unknown'`.
- `redactLogString` pins: a payer op_id in a free-text string → `:anon`; standalone `0x<40>`/`0x<64>` →
  `0x<redacted>`; a string with no sensitive shape → unchanged; idempotent.
- **err-channel pin (high value):** a `logger.error(key, {network}, viemErrorWithFromNonce)` produces an
  `entry.error`/captured payload with NO raw `from`/`nonce` (simulate a viem error whose `.message` contains
  `0x<40>`+`0x<64>`); and a PG-error whose message contains the raw op_id → redacted.
- **grep-guard** (§8): non-vacuous (RED on a synthetic raw site incl. shorthand + the `invocationId` key +
  an `operationIds` array; GREEN on the redacted forms); scans real files.
- **Equivalence + the expected test edits:** grep `__tests__` for `toHaveBeenCalledWith`/`objectContaining`
  on the redacted event keys; update those ~16+ assertions to the redacted form (PK key / dropped field).
  These are the ONLY legitimate test edits; the rest of the suite stays green.
- E2 read-only pin: adding `id` to reconcile.ts:962 `.select()` changes no WHERE/ORDER/LIMIT (inspection).

## 10. Gate (re-run clean from `apps/web`)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (8 pre-existing
warns) · vitest green: net-new redaction/grep-guard/err-channel pins PASS; the ~16 updated log-assertions
PASS; the rest of the suite UNCHANGED-green (behavioral equivalence).

## 11. Sequencing + scope-boundary notes
- **Chunk 2 (NEXT): `invocations.metadata` payer minimization** (DARK, flag-gated). Census done. RIDERS the
  audit surfaced: chunk 2's transform must null BOTH `metadata.payer` AND `metadata.payerIdentifier` (x402
  writes only `payerIdentifier`; circle-nano writes both); the `drain` rail also persists `metadata.drainNonce`
  (a channel nonce) + circle-nano free-call `metadata.payerAddress` — decide whether those are in chunk 2's
  scope. V-N3-erasure ENABLE is unblocked only after THIS chunk AND chunk 2 land.
- **packages/mcp scope question (resolve at ②):** the self-hosted MCP adapters (x402.ts:527/546,
  circle-nano.ts:520, drain.ts:583) log raw payer/nonce via an INJECTED logger (`options.logger ?? NOOP`),
  NOT SettleGrid's Sentry — so they are the self-hoster's logs, OUT of this chunk. BUT confirm SettleGrid's
  own hosted MCP deployment does NOT wire `@/lib/logger` into those adapters (if it does, they become live
  SettleGrid Sentry leaks and must be added). The DC-16 honesty claim's scope wording should exclude the
  self-hosted SDK explicitly.

## 12. Lifecycle
scope-confirm ✓ → THIS handoff + the 6-lens plan audit (closed in the orchestrator session) → BUILD (fresh
agent; ships LIVE — redaction is a pure safety fix, no flag) → executable gate + interval self-verify → ②
seal-gating review → seal + bookkeeping → founder-close. Then chunk 2 (invocations).

## 13. ② recovery-build resolution log (2026-06-19, fresh single-writer)
The first build was BLOCKED by the seal-review (`v-n3-log-redaction-seal-review-2026-06-19.md`). This
recovery build closed every OPEN HIGH + MEDIUM finding; the CONFIRMED-CLEAN list was preserved untouched.
- **F1 (+F4)** — `log-redaction.ts`: the two exact-length standalone-hex patterns (`{64}`/`{40}` + trailing
  lookahead) were replaced by a single greedy long-run rule `/0[xX][0-9a-fA-F]{40,}/g → 0x<redacted>`, so a
  from/nonce PACKED inside one contiguous calldata/revert-data run is consumed whole (and any trailing hex
  residue with it). `0[xX]` also redacts an upper-case `0X` prefix (F4). `EMBEDDED_PAYER_OPID → :anon` stays
  FIRST; idempotence preserved.
- **F2 / M3** — `logger.ts emit()`: the sanitized `sanitizedErrorClone` is now built UNCONDITIONALLY for every
  `err instanceof Error` (the `message/stack`-changed guard is gone), so `.cause` / AggregateError `.errors[]`
  / viem `.metaMessages` / `.args` / `.shortMessage` NEVER reach `Sentry.captureException`. DC-18 cost (Sentry
  loses cause chains app-wide) accepted; name + redacted message + redacted stack preserved.
- **M5** — `logger.ts`: `redactLogString` inputs are `typeof`-guarded (`typeof err.message === 'string' ? … :
  String(err.message)`, same for `err.stack`) so a coerced non-string message can't throw out of `emit()`.
- **H1 + M1** — new shared seam `apps/web/src/lib/sanitizing-adapter-logger.ts`
  (`createSanitizingAdapterLogger()`) strips/redacts the payer key set
  `{payer,payerAddress,payerIdentifier,from,nonce,drainNonce}` via `redactLogString` before forwarding to
  `@/lib/logger`. SWEPT into ALL 13 proxy `appLogger`s (acp, alipay, ap2, circle-nano, drain, emvco, kyapay,
  l402, mastercard, mpp, ucp, visa-tap, x402) — not the assumed three. Closes the M1 `packages/mcp` adapter
  sites (x402.ts:546 / drain.ts:583 / circle-nano.ts:520) at the SettleGrid seam (SDK untouched — a
  self-hoster's raw payer in THEIR logger is THEIR data). The app-side H1 site
  (`circle-nano-proxy.ts circle_nano.payment_validated`) ALSO had its raw `payer` field DROPPED at the source
  (toolSlug carries correlation) so the static grep-guard is honest, not just runtime-safe.
- **H2 / M2** — `log-redaction-guard.test.ts`: call detection broadened to aliased/wrapped loggers
  (`\b\w*[Ll]ogger\.(info|warn|error)`) + the computed/dynamic `logger['level'](…)` form (incl. a ternary
  index); key detection now flags QUOTED (`'operationId':`) and COMPUTED (`['operationId']:`) keys; the `…Id`
  auto-allow tightened to a PROVENANCE check (`id` / `row.id` / `rowId` only — `someId`/`hopId` no longer pass
  by name); key set extended with `payerAddress` + `drainNonce`. The guard now SEES the seam (in scope, scanned,
  verified leak-free) and the whole aliased class; a RED/GREEN self-test was added for each new form.
  `packages/mcp/src` is deliberately NOT walked (the seam closes it at runtime; walking it would falsely flag
  self-hoster logs) — recorded in the guard header.
- **M4 — DEFERRED (decision recorded).** No Sentry `beforeSend` scrubber was added. `onRequestError`
  (`instrumentation.ts`) + `global-error.tsx` bypass `emit()`/`redactLogString`, but the path is LATENT:
  settlement catches its viem errors at `x402/settle.ts` and does NOT rethrow to the route boundary, so no raw
  from/nonce reaches the un-`emit()`ed Sentry hooks today. F1 (greedy hex) + F2/M3 (unconditional clone) already
  close every reachable `emit()`-routed Sentry path. A `beforeSend redactLogString` over `event.exception` is
  defensible defense-in-depth but is beyond this chunk's per-site/`emit()` design and touches a global Sentry
  hook — DEFERRED to the V-N3-erasure enable-runbook / a follow-up. (F5 — the 5-key free-text allowlist — stays
  a recorded latent class; no currently-reachable settlement log site triggers it.)
