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

## P8 — P2-mirror window PREVENTION (② seal residual; MED severity, VERY LOW likelihood — detection in place)
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

## P4 — Transport timeout for the reconciler's confirm path (deep S-D3/D6/D8 residual; MED)
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

## P5 — Permanent-pending terminalization + alert hygiene (deep S-D5; MED)
Unfunded-wallet x402 authorizations mint `pending`/null-`external_ref` rows (write-ahead row
precedes the balance pre-check) that NOTHING ever terminalizes; with nonce-consumed/dropped-tx
rows they make `reconcile.pending_overdue` permanent once any exists (96 error lines/day →
alarm fatigue on the one alert guarding the credit tail). **Fix shape:** store `validBefore` in
pending-row metadata at `ensurePendingRow`; terminalize (or quarantine-classify) rows whose
authorization has provably expired with no broadcast. Own small chunk + operator runbook.
Ledger: DC-18 (alarm-fatigue face).

## P6 — Ops items (MED→LOW)
- **Dead-man switch** for the reconcile cron (③ added the 401 Sentry trail; an out-of-band
  liveness check on `done`-recency remains open). (deep S-D7)
- **`verifyLedgerIntegrity` settlement-row offset** — ALREADY REGISTERED (ledger excluded-list
  S1-52); deep audit re-confirmed and notes the offset now GROWS with live x402 volume:
  one-line `isNull(settlementStatus)` fix when ledger.ts next opens. (deep S-D4/D11)
- **SENTRY_DSN presence in prod env** — the alert chain assumes it; founder checklist line.
  (critic C6)

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
