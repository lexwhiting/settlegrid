# (S) ③ Post-seal deep audit — CARRIED-FINDINGS REGISTER (2026-06-10)

> Output of the ③ integrated-whole deep audit (`wf_41d2eca2-5df`: 4 fable lenses + collective-miss
> critic; 25 findings; full set in `.audit/s-deep/deep-findings.json`). Two findings were FIXED
> in-phase (run-budget + 401 logging — see the resolution doc's ③ addendum). Everything below is
> REGISTERED: real, verified at file:line, and deliberately NOT fixed in ③ because each fix
> perturbs a frozen money-path surface and/or needs its own migration/audit cadence. **All are
> PRE-EXISTING latent defects of the integrated system (none introduced by (S)/(G)) — most are
> live in deployed prod today.** Ordered by priority.

> **(T) CLOSURES (2026-06-10, ② SEALED):** P1 + P2 + P3 are CLOSED by the (T) chunk (one seam,
> merged per its handoff §1). P1 → `credited_at` marker (migration 0016) in-transaction at both
> credit-writer sites + the uncredited sweep (`reconcile.uncredited_settled`). P2 → the
> `markSettlementFailed` hash CAS closes the STALE-ref face; the ② seal panel exhibited the
> MIRROR face (flip on CURRENT ref during the resubmit gap → resubmitted tx settles onto a
> terminally-failed row, sweep-blind) — now DETECTED at receipt time
> (`settlement.settled_evidence_on_terminal_failed_row`) and at broadcast time
> (`settlement.broadcast_evidence_on_terminal_failed_row`); PREVENTION is registered as P8
> below. P3 → `isReconcilableRail` + the F2 mainnet pin on the credit gate (credit-only).
> Evidence: `.audit/t-prebuild/` (R1/R1b/R2 → PLAN_READY), `.audit/t-build/` (fail-pre-fix
> reds + gates), `.audit/t-seal/` (panel, fix red→greens, mutation evidence, SEAL record).
> Critic-C4 (tools-UPDATE zero-row check) deliberately NOT folded into (T): stat-only blast
> radius (the dev balance has the B4 throw) — stays P7-class hygiene.

> **(U) CLOSURE + ③ ADDENDA (2026-06-11, ② SEALED + ③ SEAL STANDS):** P4 is CLOSED by the (U)
> chunk (`p4-transport-resolution-2026-06-11.md`): bounded reconciler transport
> (`RECONCILER_RPC_TIMEOUT_MS=3000`/1 retry via `reconcilerPublicClientFor` on
> `confirmSettlementTx` only) + detectors-first run order (sweep + overdue aggregate emit BEFORE
> the examination loop — the ③-(T) escalation's exact ask) + the LB-2 funds-trap fix (a failed
> reverted-branch nonce re-check now returns `unconfirmed`/`revert-nonce-unverifiable`, never a
> clean `reverted`). Evidence: `.audit/u-prebuild/` (R1→R2 PLAN_READY), `.audit/u-build/`,
> `.audit/u-seal/SEAL.md` (0 high), `.audit/u-deep/VERDICT.md` (SEAL STANDS). The (U) ③ audit
> ADDED: **P8(g)** (live-engine LB-2 twin, HIGH — below), the **NEW P9 credit-finality policy
> item** (founder decision), and the P5/P6/P7 addenda + notes marked **③-(U)** below.

## P1 — Flip→credit non-atomicity: process-kill loses a credit SILENTLY (deep S-D1 + critic C1; HIGH) — **CLOSED by (T)**
`reconcile.ts` flip (`markSettlementSettled`, own txn) then credit (`creditSettlement`, second
txn) — a process kill between them (maxDuration timeout; OOM) leaves a TERMINAL `settled` row
whose developer was never credited, with NO log (the documented F4 residual's
`settlement.credit_failed` only covers in-process DB errors — a killed process logs nothing) and
NO way to detect after the fact (no credited-marker exists; the WHERE-pending window never
re-selects). The critic showed the LIVE proxy/kernel paths have the same window, LARGER (the
whole upstream fetch sits inside it), and the F1 replay then suppresses recovery (skipCredit).
**Fix shape (own chunk; HIGH-STAKES):** credited-marker written in the same transaction as the
credit (e.g. `credited_at` column — migration 0016) + a sweep/alert for `settled` reconcilable
rows with `credited_at IS NULL`; or make flip+credit one transaction. Touches frozen
creditSettlement/markSettlementSettled — exactly why it needs its own cadence. Ledger: DC-01.

## P2 — Stale-externalRef failed-flip race erases a resubmitted, eventually-SETTLING tx (deep S-D2; HIGH) — **CLOSED by (T)** (stale face: CAS; mirror face: detected — prevention = P8)
Verified live: `orchestrate.ts:327-336` falls through to a FRESH submit (T2) when the stored tx
(T1) is a clean nonce-free revert; `markSettlementBroadcast` sets `external_ref=T2`. A
concurrent reconciler run holding the stale T1 from its batch SELECT confirms T1 → reverted+
nonce-free → `markSettlementFailed` (guarded only `WHERE pending`, no hash CAS) flips the row
`failed` and overwrites `external_ref` back to T1. T2 then mines: USDC moves, the live path's
settled-flip no-ops (row is terminal `failed`), dev never credited, ledger wrong, zero alerts.
**Fix shape (own chunk):** compare-and-set — `markSettlementFailed` (or a reconciler-specific
variant) gains `AND external_ref = <the hash actually confirmed>`; optionally the reconciler
takes the per-op settle lock best-effort. Touches frozen `ledger.ts`. Ledger: DC-06/DC-02.

## P3 — Reconciler credit-gate hardening micro-chunk (critic C2 + deep S-D9; MED) — **CLOSED by (T)**
Two one-line hardenings on the SAME frozen line (`reconcile.ts:131` credit gate): (a) no F2
mainnet pin — the reconciler is the only credit-capable surface that would credit a withdrawable
balance for a Base-Sepolia tx if a Sepolia pending row ever reached the prod DB (writers are
pinned; the vector is a non-prod process on prod DATABASE_URL or future writer regression);
(b) the gate hardcodes `'x402' || 'circle-nano'` instead of `RECONCILABLE_RAILS` — a future
third on-chain rail would confirm but silently never credit (shielded today by opId-parse-null).
**Fix shape:** tiny, but it edits the exactly-once credit gate → micro-chunk with funds-safety
review. Ledger: DC-07/DC-13.

## P8 — P2-mirror window PREVENTION (② seal residual; MED severity, VERY LOW likelihood — detection in place) — **(a,c,e,f,g) CLOSED by (V)** (2026-06-12; ② SEALED + ③ RE-CERTIFIED — `.audit/v-deep/VERDICT.md`). P8-a pre-submit terminal re-read; P8-e no-clobber broadcast CAS (expectedPriorRef, 6 sites); P8-f mirror winning-hash; P8-c reconciler (T)-key re-emit; P8(g) interpretReceipt catch → broadcast-unconfirmed. **REMAINING OPEN:** (b) the irreducible hard-kill-between-writeContract-and-onBroadcast silent residual (P8(b) — register-only; the (V) expiry pass's `nonce-consumed-untracked` quarantine is its FIRST detector).
The (T) ② seal panel exhibited the mirror ordering of P2: a reconciler failed-flip lands with a
CURRENT ref (the CAS legitimately passes) inside the live path's recovery-resubmit gap
(post-confirm, pre-onBroadcast re-point); the resubmitted tx then settles USDC onto a terminally
'failed' row (broadcast/settled flips both no-op WHERE pending; sweep is settled-only-blind).
(T)'s ② fixes made the class DETECTED at both observation points (receipt-time
`settlement.settled_evidence_on_terminal_failed_row`; broadcast-time
`settlement.broadcast_evidence_on_terminal_failed_row` — runbook §3 repair+credit). REMAINING:
(a) PREVENTION — close the window itself (re-read row status immediately before the fresh
submit and abort if terminal, and/or the reconciler takes the per-op settle lock best-effort) —
P5-adjacent write-ahead lifecycle work, fits naturally WITH P5; (b) the irreducible silent
residual: a hard kill between `writeContract` and the onBroadcast callback (no DB write
possible — only gas-wallet sent-tx-history reconciliation could surface it); (c) reorg-grade
micro-gap: the reconciler's own settled-`!flipped` arm is tallied `settled-noop` without a
failed-row re-read (divergent receipt views only). Fix shape: own micro-chunk or fold into P5.
Ledger: DC-01/DC-02.
**③ deep-audit addenda (2026-06-10):** (d) the lock-TTL window that RAISED this item's
likelihood (settle-lock 70s < proxy maxDuration 90s — sibling concurrency with Redis UP) was
FIXED in-phase (TTL→100s, preflight probe I9 pins TTL > every caller's maxDuration); residual
likelihood back to lock-rare. (e) NEW trace for the prevention work: in the
reverted+nonceConsumed branch, a lock-less LOSER's `markSettlementBroadcast(loserHash)`
OVERWRITES a known-good winner ref — if the winner then dies pre-flip the row loops
pending-nonce-consumed forever (paged within 6h by the (S) overdue nonceConsumed class, but
auto-credit becomes impossible; manual (from,nonce) attribution required). Prevention fix shape:
don't clobber a DIFFERENT existing ref in that branch (needs a markSettlementBroadcast variant —
frozen surface, hence registered). (f) when prevention lands, also return the WINNING hash (not
the row's reverted ref) in the mirror branch's response/tx-hash header — until then the alert's
`winningTxHash` is authoritative (runbook §3 says so).
**③-(U) addendum (2026-06-11): (g) live-engine LB-2 twin — HIGH (the (U) ③ headline).**
`interpretReceipt`'s reverted-branch nonce-recheck CATCH defaults `nonceConsumed:false`
(settle-engine.ts:346-348) and BOTH live orchestrators then `markSettlementFailed`
unconditionally (circle-nano/settle.ts:169, x402/orchestrate.ts:216) — terminalizing on the
SAME incomplete-evidence state (U) ruled non-terminal on the reconciler side. Combined with the
P8(b) untracked-hash window the lost credit is SILENT (no evidence-holder → neither (T)
evidence alert fires; the sweep is settled-only; buyer retries exit PREVIOUSLY_FAILED). Fix
shape (verified link-by-link by the (U) ③): map the FAILED nonce-recheck in that one branch to
`broadcast-unconfirmed` — both orchestrators already map that kind to pending +
`markSettlementBroadcast`; flip the settle-engine test expectation as the red/green proof.
Mirrors the sealed reconciler LB-2 semantics. **Note (P5/P8-adjacent, ③-(U) F2):** the live
stale-ref 402 buyer verdict discards the CAS result — buyer told 'failed' while the flip was
CAS-rejected; fold when the orchestrator mirror branch opens. **[③-(V) F2 DISCHARGED 2026-06-12:
the 3e fold shipped in (V) — CAS-false+still-pending → 502 PENDING + `*.settle_reverted_stale_ref`.]**

## ③-(V) DEEP-AUDIT NEW ITEMS (2026-06-12 — surfaced by the (V) ③ integrated-whole audit; `.audit/v-deep/VERDICT.md`)
The (V) ③ closed P5/P8(a,c,e,f,g) and RE-CERTIFIED after one in-phase fix (the chain-anchor
upper plausibility clamp — finding 8, the F-1 sibling; settle-engine.ts). The integrated-whole
panel + the collective-miss critic surfaced these, each routed here (fix out of (V) scope —
verifier/frozen-path/prevention/future — or a founder decision). Priority-ordered:
- **V-N1 (HIGH — FOUNDER-decision) validBefore upper-bound cap at BOTH verifiers.** Neither
  `circle-nano/verify.ts:181` nor `x402/verify.ts` caps `validBefore` above (only rejects
  expired). A buyer can mint a ref-NULL `pending` row with `validBefore` = year 2099 that NEVER
  wall-expires → permanent `pending_overdue`/`noTxhashCount` inflation (the alarm-fatigue (V) set
  out to kill, half-closed) AND permanent indexed payer-PII (V-N3). Rate limits bound the rate,
  nothing bounds accumulation. Fix: reject `validBefore > now + maxWindow` (a new 402 code —
  BUYER-FACING, hence not done in (V)). Root fix of the immortal-row + PII clusters. Ledger
  DC-09/DC-18.
- **V-N2 (HIGH — FOUNDER-decision; P9-adjacent) reconciler-tail credit pays the stale
  first-write `amountCents`.** The idempotent INSERT (ON CONFLICT DO NOTHING) freezes
  `amountCents`; `creditSettlement` credits `row.amountCents` (reconcile.ts:201);
  `process-payouts` (cron `0 12 * * *`) pays `balanceCents` out as an unclawbackable Stripe
  transfer ≤24h. A same-(from,nonce) re-sign under a LOWERED tool price over-credits.
  **Operational Q the founder must answer: can a tool price be lowered while a live pending row
  exists?** If yes, end-to-end fiat over-payment is reproducible. PRE-EXISTING (predates (V); the
  refresh raises only validBefore). Fix: a credit-side amount-mismatch guard (detect) or a
  prevention chunk reconciling `amountCents` (touches the frozen credit path). Ledger DC-01/DC-06.
- **V-N3 (MED — FOUNDER legal-posture + bundle with V-N1) `ledger_entries` has no GDPR
  retention/erasure path.** The `data-retention` cron deletes 6 tables, NOT `ledger_entries`
  (zero `delete(ledgerEntries)` tree-wide); the payer EVM address is written into the indexed
  `operation_id` + `metadata.payer`; the compliance financial-retention exemption was reasoned
  for account-holders, not anonymous x402 payers. V-N1's cap bounds the attacker-inflatable
  surface. Ledger DC-16-adjacent.
- **V-N4 (MED) nonce-read block-pinning (② attention item i, ③-confirmed REACHABLE under a
  load-balanced/replica-lagging RPC).** The pass's `readAuthorizationStateBounded` reads at
  implicit 'latest' while the anchor is 'safe' — a replica whose 'latest' lags the sibling's
  'safe' can read a consumed nonce as 'unconsumed' → wrong terminalization + P8(b) detector
  suppression. Fix shape: return `{ts, blockNumber}` from the safe read and pin the nonce read
  to that blockNumber, with a non-archive-pruning fallback to 'unknown' (NOT 'latest'). Interim
  mitigation = a founder RPC-consistency check (prod `SETTLEGRID_BASE_RPC_URL` should be a
  single-view-consistent provider). Non-trivial (pruning tradeoff) → its own chunk. Ledger DC-04/DC-08.
- **V-N5 (LOW, P6-ops) expiry-pass drain / concurrency.** LIMIT-3/run (288/day) vs the admission
  ceiling — under a hostile/buggy insufficient-balance flood the dead-row backlog grows; raise
  drain via multicall nonce reads + a candidate-SELECT wall-expiry predicate (spend slots only on
  rows that can terminalize this run). Concurrent reconcile-run overlap (manual trigger during a
  scheduled run) is funds-safe (all (V) writers CAS/idempotent) but halves drain and double-pages
  the quarantine alert → a single advisory lock on the cron, OR add `(metadata->>'expiryClass')
  IS NULL` to `quarantineClassify`'s WHERE to dedup. Ledger DC-09.
- **V-N6 (LOW, P7-hygiene) bundle:** rowId in the `reconcile.expiry_unprovable` payload
  (operationId already present — marginal); the CAS-reject breadcrumb (② attention item ii —
  pre-existing (T)-era posture; a warn on the 4 applyOutcome broadcast-CAS-false arms); the
  terminal-transition harness sql-node evaluator (so a future builder can EXECUTE the
  jsonb-merge SET nodes rather than shape-assert); the facilitator x402 verify `parseInt`
  alignment (x402/settle.ts — outside the (V) set).
- **V-N7 (LOW, buyer-facing — future chunk) bundle:** cross-rail error-envelope unification
  (proxy x402 `{error:{code,message}}` vs circle-nano `{error:string,code}` — PRE-EXISTING, a
  uniform consumer can't read both); a terminal/actionable signal for a buyer looping 502 on a
  `nonce-consumed-untracked` quarantined row; SDK facilitator reason-surfacing (collapses non-2xx
  to 500); an alreadySettled multi-delivery marker (forward-at-most-once for expensive tools).
Defect-ledger: the (V) ③ folds DC-05 (the Once-queue face), strengthens DC-01/DC-08/DC-12/DC-18,
and adds **DC-20** ("best-effort write-ahead failure aliases as truthful absence").

## P4 — Transport timeout for the reconciler's confirm path (deep S-D3/D6/D8 residual; MED) — **CLOSED by (U)** (2026-06-11; ② SEALED + ③ SEAL STANDS — see the (U) closure banner above + `p4-transport-resolution-2026-06-11.md`; the ③-(T) escalation's detectors-first ask shipped as the (b-i) run reorder)
③ fixed alert delivery (run budget + deferred), but a single in-flight
`getTransactionReceipt` can still hang ~41s (viem defaults: 10s × 3 retries, unconfigured
`http()` in `publicClientFor` — frozen engine) and overrun the budget's headroom.
**Fix shape:** a reconciler-specific client with `http(url, { timeout: 3_000, retryCount: 1 })`
(live settle path untouched). Touches frozen `settle-engine.ts`. ~~Pairs naturally with P3~~ (P3
closed by (T)). **③-(T) ESCALATION (2026-06-10): priority RAISED** — the (T) uncredited sweep (the
sole P1 silent-loss detector) emits LAST in the run, so a mid-band slow row (~20-45s) admitted
just before the 40s budget deadline kills the run past maxDuration=60 and the sweep is the FIRST
signal lost — precisely during the partial-RPC degradation that mints uncredited rows. When
folding P4, also consider running the sweep/overdue aggregates BEFORE the examination loop
(independent DB-only queries) or a hard per-row Promise.race deadline.

## P5 — Permanent-pending terminalization + alert hygiene (deep S-D5; MED) — **CLOSED by (V)** (2026-06-12; ② SEALED + ③ RE-CERTIFIED — see the (V) closure banner below + `.audit/v-deep/VERDICT.md`; the expiry pass terminalizes provably-dead never-broadcast rows and quarantine-classifies the rest; operator runbook = `v-pending-lifecycle-runbook-2026-06-12.md`)
Unfunded-wallet x402 authorizations mint `pending`/null-`external_ref` rows (write-ahead row
precedes the balance pre-check) that NOTHING ever terminalizes; with nonce-consumed/dropped-tx
rows they make `reconcile.pending_overdue` permanent once any exists (96 error lines/day →
alarm fatigue on the one alert guarding the credit tail). **Fix shape:** store `validBefore` in
pending-row metadata at `ensurePendingRow`; terminalize (or quarantine-classify) rows whose
authorization has provably expired with no broadcast. Own small chunk + operator runbook.
Ledger: DC-18 (alarm-fatigue face).
**③-(U) addenda (2026-06-11):** (i) the immortal classes inflate time-to-first-examination
LINEARLY (each permanent row consumes a rotation slot every cycle — the alarm-fatigue face has
a latency face too); (ii) the Sentry-quota mechanism: ~3 error events/run × 96 runs/day ≈
8.6k/month once two standing incident classes coexist — a low quota ingest-DROPS the armed P1
pages, a strictly worse failure than alarm fatigue (founder close-block item).

## P6 — Ops items (MED→LOW)
- **Dead-man switch** for the reconcile cron (③ added the 401 Sentry trail; an out-of-band
  liveness check on `done`-recency remains open). (deep S-D7)
- **`verifyLedgerIntegrity` settlement-row offset** — ALREADY REGISTERED (ledger excluded-list
  S1-52); deep audit re-confirmed and notes the offset now GROWS with live x402 volume:
  one-line `isNull(settlementStatus)` fix when ledger.ts next opens. (deep S-D4/D11)
- **SENTRY_DSN presence in prod env** — the alert chain assumes it; founder checklist line.
  (critic C6)
- **③-(U) additions (2026-06-11):** cron-route 429 branch has ZERO log/Sentry trail (the (S③)
  401-trail rationale applies verbatim one line below it; route frozen — one logger.error when
  it next opens; mitigants: limiter fails open, trigger exotic) · RPC-health reason
  discriminator on the engine's `unconfirmed` (TransactionReceiptNotFoundError vs
  transport-error split — a sustained >3s provider currently reads identical to mass-dropped
  txs, first paged at 6h; perturbs the sealed wire shape, so next engine open) · the SAME family:
  unset/typo'd `SETTLEGRID_BASE_RPC_URL` silently degrades to public-RPC (env-preflight founder
  line) · gas-balance-check cron: silent 401 + warn-level low-gas never reaches Sentry ·
  transport-hygiene residual: the 3s bound is time-to-headers and a 429 Retry-After overrides
  retry delay (verified in viem 2.47.4) — a TRUE adversarial bound needs a custom transport ·
  hung-detector-query residual: the (U) reorder guarantees detectors run FIRST, not that a hung
  DB aggregate can't stall the run (② note) · garbage-receipt-status hardening candidate: the
  engine trusts `receipt.status` shape from the RPC (② note, engine-open rider).

- **③-(T) ops addenda (2026-06-10):** Sentry grouping: identical `captureMessage` keys collapse
  into ONE issue and default rules notify on NEW issues only — the "pages until closed" posture
  exists at the stdout layer; founder action = per-key "every event" alert rules (close-checklist
  §3). · Open-incident volume: each open sweep incident emits 1 error line/15min until closed —
  fine at current volume; if F3-class incidents ever accumulate, split the alert by triage class
  before alarm fatigue sets in. · Price/identity drift across credit surfaces (kernel/proxy credit
  retry-time `costCents`/`developerId` vs the row's recorded values): the exact-amount rule on
  BOTH rails makes a price change FAIL the retry verification, closing the amount face in
  practice; the identity face (ownership transfer mid-pending) remains theoretical — no action
  unless tool-transfer ships. · Pre-existing 0010 journal quirk (two 0010_* files, one bootstrap
  row) — founder confirms prod state (close-checklist §4). · Payout-preflight↔transfer-webhook
  lock-order inversion exists but is PG-deadlock-resolved with retry semantics — no funds impact.

## P7 — Low/hygiene (register only; fold opportunistically)
- Test-isolation flakes found during ③ integration: `hop-rail-guard.test.ts` (stripe-connect
  control) + `gas-wallet-monitor.test.ts` (`@/lib/env` load) FAIL in isolated/small-group runs
  on the pristine committed tree yet PASS in every full-suite run — pre-existing, order/pool-
  dependent; (S)/(③) untouched by them. (DC-05 family.)
- GDPR anonymization leaves `stripeConnectStatus='active'` + retains pending settlement rows
  (deep S-D12). · `tools.totalInvocations` undercounts on exactly-once seams; F4-credited
  settlements write no invocations row → dashboard attribution gaps (deep S-D13 + critic C3). ·
  `creditSettlement` tools-UPDATE has no zero-row check (silent per-tool stat skip; critic C4 —
  fold into P1's chunk). · logger `emit()` spread lets a `msg` meta key clobber the structured
  key (deep S-D14). · timing-unsafe `!==` cron-secret compare across ~30 cron routes + missing
  `.trim()` in `getCronSecret` (deep S-D15/D17). · stale engine error strings advertising
  eip155:1 + openapi `/api/x402/verify` schema mismatch (deep S-D16/D18 — fold into the queued
  (G) residual tidies). · bootstrap migrations table lacks UNIQUE(hash) (sequential-only
  idempotency; deep S-D19). · `confirmSettlementTx` docstring stale on x402 nonce parity
  (critic C5 — docs-only rider when settle-engine.ts next opens). · 10 unscheduled cron route
  dirs (likely intentional; verify against product intent; deep S-D10).
- **③-(U) additions (2026-06-11):** `SETTLE_LOCK_TTL` duplicated as two literals (DC-07) ·
  starvation-suite residuals: 2 minor harness-fidelity items recorded with the F7
  faithful-to-detectors-first verification · cron modulo-dispatch nit (② note).

## P9 — Credit-finality policy (③-(U) NEW, P8-family; **FOUNDER DECISION** — operator gate)
The (U) ③ critic's must-check 1, sustained as a genuine design-level residual no chunk has
dispositioned (the registered reorg item is a different micro-gap): credits are granted on
1-confirmation bare-receipt evidence on Base. Decide the policy — confirmations depth and/or
safe-head requirement for credit-grade evidence — then schedule its own cadence. EXCLUDED from
(V) by its handoff (rejected merge). Until decided, the runbook's manual-repair steps remain
the deepest verification any credit gets.

## Register NOTES (③-(U), 2026-06-11 — dispositions, not scheduled work)
- **Facilitator-enable precondition list** (latent surfaces; add to any facilitator-v1 charter):
  facilitator + `verify.ts` use bare `http()` ignoring `getBaseRpcUrl` (DC-07) · the facilitator
  claims 'no funds moved' on incomplete evidence — the LB-2 rule is absent on that latent relay
  surface (DC-13) · it needs its own bounded transport.
- Proxy zero-dev-match commits the tools-stat increment while the reconciler path rolls back —
  divergent stat purity nit (row-marker/paging side is deliberate, in-code (T) comment).
- x402 idempotent-hit returns `txHash:''` silently; the circle-nano twin logs an anomaly warn
  (DC-18 parity nit).
- Reporting purity: monthly-summary/weekly-report crons read settled-but-uncredited rows as
  revenue (no funds impact; reporting-only).
- Sweep sample-fail self-suppression (pre-existing, (T)-sealed block): a thrown sweep SAMPLE
  query suppresses its own alert into `uncredited_check_failed` — honest but worth knowing when
  triaging `uncredited: null` (② note).
