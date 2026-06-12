# (U) Reconciler transport timeout + detector availability — RESOLUTION / CAPSTONE (2026-06-11)

**Status: ② SEALED + ③ SEAL STANDS (post-seal deep audit, integrated whole). LOCAL commit only —
NOT pushed.** Closes the ③ register's **P4** (`s-deep-audit-register-2026-06-10.md`, ③-ESCALATED
2026-06-10: the (T) uncredited sweep — the sole P1 silent-loss detector — emitted LAST and was
the first casualty of a budget-overrun kill).

## The bar (charter §1, met and seal-verified)
*"No single RPC call can prevent the reconcile run's detectors (`reconcile.pending_overdue`,
`reconcile.uncredited_settled`) from emitting; the reconciler's confirm path degrades to
'unconfirmed' (safe-direction) on timeout; the live settle path's transport and ALL funds
semantics are byte-identical."*

## What shipped (4 modified files + 2 new test suites; chain: handoff `f7a15925` → trace →
audited plan → build → ② seal → ③ deep audit)
1. **Bounded reconciler transport** (`settle-engine.ts`): exported
   `RECONCILER_RPC_TIMEOUT_MS = 3_000` / `RECONCILER_RPC_RETRY_COUNT = 1`; additive private
   `reconcilerPublicClientFor`; `confirmSettlementTx` (reconciler-ONLY entry point) swapped onto
   it. Worst nominal 6.15s/call · 12.3s/row vs the 20s tail (runBudget 40s, maxDuration 60s);
   live-probe verified (bounded 6,163ms vs default 41,063ms — `probe-timeout-arithmetic.txt`).
   `publicClientFor`, wallet client, `interpretReceipt`, `RECEIPT_TIMEOUT_MS` byte-identical.
   (③ caveat recorded in the constants comment: viem honors a 429 `Retry-After` override and the
   3s timer binds time-to-headers — the 6.15s figure is the timer-bound shape, not an adversarial
   bound; the detectors are structurally safe either way because they emit pre-loop.)
2. **Detectors-first run order** (`reconcile.ts`): the uncredited sweep (FIRST) + the overdue
   aggregate moved BEFORE the window SELECT and examination loop — emission happens-before every
   RPC call. `pending_overdue` payload drops `examinedThisRun`; the displaced classification
   moved to the post-loop **`reconcile.overdue_examined` carrier at ERROR level** (② seal fix M1,
   4 lenses converged: logger.ts mirrors only error-level into Sentry; the plan's "warn" stands
   superseded). Summary shape/identity unchanged; loop/rotation/budget machinery byte-identical.
3. **LB-2 funds-trap fix**: `confirmSettlementTx`'s reverted-branch nonce-read catch returns
   `{ kind: 'unconfirmed', txHash, reason: 'revert-nonce-unverifiable' }` — a failed nonce
   re-check is INCOMPLETE evidence and can no longer CAS-flip a row 'failed'. The live-path
   `interpretReceipt` default-false was OUT of scope (frozen) — see P8(g) below.
4. **② seal fixes** (licensed files only, frozen spine untouched): M1 (carrier level), M2
   (detector-availability suite pins ALERT EMISSION order, proven red vs an emission-hoist
   mutant), L13 (durable `reconcile.unconfirmed` reason pins), L14 (transport-isolation
   client-config key-set pins; its own fix-class re-review caught an 8-error tsc break in v1).
5. **New suites**: `transport-isolation.test.ts` (live-path transport byte-identity, LB-1) +
   `reconcile-detector-availability.test.ts` (detectors-first guarantee, M2 order pins).

## ② Seal-gating review — SEALED (`.audit/u-seal/SEAL.md`)
Panel `wf_4f571d2b-780`: 5 hostile fresh-context **fable** lenses, coverage mode, 30 findings,
**0 high**; 24/30 **opus** refuters died on a weekly usage limit → fail-safe SUSTAINED →
hand-integrated with live evidence (no finding dropped). Hostile battery 19/19 (script; 24
vitest cases driving the REAL `confirmSettlementTx`/`reconcilePendingSettlements` via
mocked-client error shapes + failing harness stages).

## ③ Post-seal deep audit — SEAL STANDS (`.audit/u-deep/VERDICT.md`)
Panel `wf_412782ff-0d7`: 5 integrated-whole lenses + xhigh-intent collective-miss critic, 0
dead; 24 findings → 18 distinct → **1 high, 5 med, 12 low — ZERO defects in the (U) sealed
behavior** (everything lands on pre-existing frozen surfaces, off-repo surfaces, or docs).
Mechanical pre-flight handed to reviewers: full gate green + integrated-invariants **12/12** +
the ② battery re-run **19/19**.
- **The headline (HIGH, register-routed → P8(g)):** the live-engine LB-2 twin —
  `interpretReceipt`'s reverted-branch nonce-recheck catch defaults `nonceConsumed:false` and
  BOTH live orchestrators terminalize 'failed' on it (`circle-nano/settle.ts:169`,
  `x402/orchestrate.ts:216`) — the same incomplete-evidence state (U) just ruled non-terminal on
  the reconciler side; with the registered P8(b) untracked-hash window the loss is SILENT.
  Verified link-by-link in-session. Exactly the class of result ③ exists for: invisible to any
  diff-scoped review because the (U) diff deliberately excluded the live path.
- **NEW register item (critic must-check 1): credit-finality policy** (founder decision —
  confirmations depth / safe-head for credit-grade evidence on 1-conf + bare-receipt credits).
- ③ tree deltas: documentation-grade only (F8/F9 comment caveats; defect-ledger F20 key
  correction `reconcile.tool_attribution_missing` → `settlement.credit_missing_toolid`).
- Verified-sound in ③: payout `balanceCents` writer census (every writer SQL-atomic or inside
  the FOR-UPDATE txn); rollback to `a016685a` is vocabulary-safe; clock sources uniform.

## Gates at close (all from session tool runs; logs in `.audit/u-build/`, `.audit/u-seal/`,
`.audit/u-deep/`)
tsc **0** · FULL vitest **4368 pass / 191 files / 0 fail** · next build **0** · eslint changed
**0** · numstat confined to the 4 licensed files + 2 new suites · packages **0** · pinned
suites (`reconcile-starvation`, `terminal-transition`) zero-diff · battery **19/19** ·
invariants **12/12**. (Register-P7 isolation flakes: gate on the FULL suite only.)

## Founder close block — PERMANENT live-verification items (③ critic process recommendation,
ADOPTED: every future close carries this block — the cadence's structural blind spot, named)
1. **Sentry rules + quota** (~5 min): confirm the armed per-key "every event" rules
   (close-checklist §3) and read the org's event quota — worst standing burn is ~3 error
   events/run × 96 runs/day ≈ **8.6k/month** once two standing incident classes coexist; a low
   quota ingest-DROPS the armed P1 pages (worse than alarm fatigue). Note:
   `reconcile.overdue_examined` is error-level and WILL ingest — see the checklist note before
   adding any rule for it.
2. **`SETTLEGRID_BASE_RPC_URL` set in prod env** — unset/typo'd silently degrades the
   reconciler to public-RPC (indistinguishable from chain trouble until the 6h overdue page).
3. Optional: one prod EXPLAIN of the sweep/overdue/window queries; a ~100-call
   `getTransactionReceipt` latency probe vs the 3000ms operating point (operating-point check,
   not a guarantee check — the detectors emit either way).
4. Data-retention vs incident forensics: confirm log retention covers the runbook's triage
   horizon; eyeball one structured line ≥4KB for truncation.

## Deploy note
No migration. The (U) commit is LOCAL atop `f7a15925`; push/deploy founder-gated as always.
Post-deploy: watch one reconcile cycle for the cron `done` summary and (if a standing overdue
class exists) the `reconcile.overdue_examined` carrier in Sentry.

## Queue after (U)
**(V) pending-row lifecycle (P5 + P8 a/c/e/f + P8(g)) — ONE chunk** (handoff
`v-pending-lifecycle-handoff-2026-06-11.md`, authoritative) → B1.1 (standalone, INCREMENTAL) →
P6 ops → P7 hygiene → (G) tidies. Credit-finality policy = founder gate, untouched by (V).
