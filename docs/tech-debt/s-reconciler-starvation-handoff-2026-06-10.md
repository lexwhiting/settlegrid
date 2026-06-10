# (S) Reconciler starvation-at-scale + truthful run telemetry — CHUNK HANDOFF (2026-06-10)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> Closes the LAST remaining autonomous, substantive money-path debt: **B1.4 carried-debt item 2**
> (`b1.4-settlement-reconciler-2026-05-31.md` — item 1, the non-Base half, was CLOSED by (G)).
> The reconciler's bounded oldest-first window can be permanently occupied by rare
> never-resolving `pending` rows, starving newer confirmable rows of their credit; and nothing
> alerts an operator to rows pending too long.

## 0. Source-of-truth confirmation (derived 2026-06-10 — do not re-derive, but RE-VERIFY cited lines)
Ordering chain: the (G) handoff §0 scope-confirm (2026-06-09) established the non-gated queue is
drained ((H)+(F1)+(K) shipped+live; (M)/(E)/(N)/H1/F2/F4/B4/(D) all RESOLVED — confirmed against
in-repo resolution docs this session; the older post-B4 and post-F4 "next-chunk" handoffs are
CONSUMED) and the B1.4 carried debt was the one remaining autonomous money-path item. (G) closed
its item 1 (sealed local `c05d0203`). **Item 2 — starvation at scale — is what remains.**
⚠️ STALE-POINTER CORRECTION: the (G) capstone's "next-chunk pointers" listed **B4**, inherited
from a stale cross-account memory — B4 was SEALED `be43b501` on 2026-06-04. A docs-only RIDER on
this chunk's commit fixes that capstone section. Alternative if the founder prefers a small chunk:
**B1.1 enable-gate split** (`b1.1-…-2026-05-31.md` banner item 1 — proxy gates circle-nano on
`isCircleNanoEnabled()`/API-key while discovery+verifier gate on the recipient; INCREMENTAL,
different rail; deliberately NOT merged here — see §1).

## 1. SCOPE DECISION (sized 2026-06-10 against current capability — record verbatim)
**MERGED: B1.4 DEBT items 2 + 3 + 4 into one chunk** — they are ONE seam (the
`reconcilePendingSettlements` batch loop in `apps/web/src/lib/settlement/reconcile.ts` + its cron
route) and ONE invariant family, and a single spec states "done" for all three:
- **Item 2 (the core):** sticky rows rotate out of the bounded window (`last_reconciled_at`
  watermark column **or** Redis per-op cooldown — the trace decides, §2 LB-1) + a pending-age
  alert (rows `pending` > N hours).
- **Item 3:** the run summary's `flipped:false` over-reporting → truthful `*-noop` tallies
  (same loop, same `ReconcileSummary`).
- **Item 4:** `reverted`+nonce-consumed and dropped-tx rows staying pending indefinitely is
  HONEST and stays — but they must be CLASSIFIED in the alert/summary (they are the sticky rows
  item 2 rotates), not silently lumped with confirmable pendings.
**REJECTED merges:** (a) **B1.1** — unrelated INCREMENTAL on a different rail; folding it into a
high-stakes reconciler chunk is the forbidden dilution class (same reasoning that kept it out of
(G)). (b) **(G) seal residuals** (payment-identifier extension drop, openapi enum derivation, mcp
string) — different seam (x402 advertisement); code riding a high-stakes chunk unaudited is
forbidden; queue separately. (c) Anything founder/BD/partner-gated. **The bar:** *"no pending
settlement row can be starved of eventual examination; every genuinely-overdue pending row is
alerted, classified honestly; the run summary reports only true transitions; the exactly-once
credit machinery is byte-identical."*

## 2. TIER: **HIGH-STAKES** (later phases inherit; multiple triggers)
- **Money/correctness boundary:** edits the reconciler — the scheduling around `creditSettlement`
  decides WHICH real-money rows get examined and credited. A wrong window = a confirmable row's
  USDC credit delayed forever (the exact harm the chunk fixes, inverted).
- **Changes/adds an INVARIANT:** eventual-examination/batch-fairness becomes a stated guarantee.
- **Possible SCHEMA change + migration** (if the watermark-column path wins LB-1).
- **Edits a surface (G) explicitly held byte-stable** (`reconcile.ts`).

### The 1–2 LOAD-BEARING decisions most likely to be SILENTLY WRONG
**LB-1 — Rotation must mean DEFERRAL, never EXCLUSION (and pick column vs Redis deliberately).**
The fix must guarantee EVERY `pending` row remains eventually re-examinable. Silently-wrong modes
that pass tests: existing rows with a NULL watermark sorted/filtered OUT by the new ORDER/WHERE;
the watermark advanced on a row whose examination errored (RPC blip) in a way that permanently
deprioritizes it; a cooldown long enough to delay a genuinely-confirmable row's credit unboundedly;
the new ordering × `limit 25` creating a DIFFERENT starvation class. Decide **column
(`last_reconciled_at`, migration `0015`, NULLs-first ordering) vs Redis per-op cooldown (NO
migration; Redis flush ⇒ harmless early re-examination — note `tryRedis` fail-open semantics)** on
the actual trade-offs; the original debt note allows either. Prefer the minimal mechanism that
PROVABLY satisfies "deferral, never exclusion"; pin it with a starvation regression test (a
synthetic sticky row must NOT occupy the window two runs straight; a confirmable row behind 25
sticky rows MUST be reached within K runs).
**LB-2 — Deploy-ordering + alert truthfulness (DC-14 + DC-18).** If the column path wins: drizzle
SELECTs include the new column ⇒ **code deployed before the migration is applied breaks the cron
in prod** — the founder runbook must pin APPLY-THEN-DEPLOY (precedent: publisher-keys `0013`
shipped generated-not-applied; migrations live in `apps/web/drizzle/`, last is
`0014_drop_revenue_share_pct.sql`). The pending-age alert must fire at a real operator-visible
level on genuinely-overdue rows WITHOUT warn-spamming every run (the existing
`reconcile.unsupported_network` warn-not-error precedent), and must CLASSIFY sticky classes
(nonce-consumed / dropped-tx / overdue-confirmable) — the trace must first find the project's
actual alert mechanism (H1's limiter "operator alert" pattern; likely structured `logger.error` —
confirm, don't assume email infra).

## 3. INTENT
*Why:* the bounded window (25/run, oldest-first) + rare never-terminal rows = silent credit
starvation at volume; "before high volume" is the founder's stated deadline, and facilitator
enablement (made precondition-free by (G)) will raise volume. *Who consumes:* (1) the reconciler
cron itself (every 15 min, prod); (2) developers whose timed-out settles depend on the F4
credit-tail being reached; (3) the operator, who gets the first real signal (pending-age alert)
that money state is wedged; (4) future chunks via the starvation regression test. *What it
enables:* the reconciler becomes safe at facilitator-scale volume; closes the B1.4 register
entirely (items 2-4) — the settlement spine's last open autonomous debt.

## 4. Ground state + frozen surfaces
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `c05d0203`** ((G), SEALED, LOCAL-only)
  atop `origin/main = 23663006` (deployed prod LIVE). Build atop `c05d0203`. Confirm:
  `git log -2 --oneline && git status -sb`. **Do NOT push** (founder-gated; Vercel build budget).
- **Baselines (re-run to anchor BEFORE any edit):** `apps/web`: tsc **0** · vitest **4322 / 186
  files / 0 fail** · build **0** · eslint changed **0**. `packages/mcp`: **1898 / 1 skip**
  (byte-stable this chunk — no SDK surface). Python byte-stable (`git diff --numstat`).
- **BYTE-STABLE spine (build ON, do not modify):** the exactly-once credit machinery —
  `creditSettlement` + the WHERE-pending flip contract + B4 zero-row throw (`reconcile.ts`),
  `recordSettlementEntry`/`markSettlement*`/`settlementEntryId` (`ledger.ts`), `confirmSettlementTx`
  (`circle-nano/settle-engine.ts`), `reconcileOneRow`'s outcome semantics (incl. the
  `unsupported-network`→`skipped-unsupported` branch and `pending-nonce-consumed` honesty), the
  `isNotNull(externalRef)` anti-starvation guard (KEEP — it is load-bearing, see the inline
  comment at the SELECT), `RECONCILABLE_RAILS`, the orchestrators, payouts/pricing/take model
  (SETTLED), (G)'s canonical-allowlist surfaces, all of packages/mcp + sdk-python. The ONLY
  behavior changes: the window's rotation/ordering, the summary tallies, the new alert (+ the
  migration if column path).
- **Key files:** `apps/web/src/lib/settlement/reconcile.ts` (`reconcilePendingSettlements`
  ~:276-310 — SELECT window, `limit 25`, `olderThanMs 5min`, oldest-first; `ReconcileSummary`
  ~:255; `emptyOutcomes` ~:264), `apps/web/src/app/api/cron/settlement-reconcile/route.ts`,
  `apps/web/src/lib/__tests__/reconcile.test.ts` (+ cron route tests), `apps/web/drizzle/`
  (next = `0015`), `lib/redis.ts` (`tryRedis` fail-open — if cooldown path).
- **Real-money guardrails:** no push, no prod env change, no migration APPLY (generate + lint
  only; founder applies via runbook), no publish. DB read-only. Single-writer core; fan-out for
  audit gates only. zsh: quote bracketed paths.

## 5. THE ARC (do not skip/reorder)
1. **Scope-confirm trace** (`s-reconciler-starvation-trace-2026-06-10.md`): re-derive every claim
   here against live code; nail (a) the sticky-row classes that REMAIN post-(G) (dropped-tx
   `unconfirmed`, `reverted`+nonce-consumed — both RARE; eip155:1 source removed) and whether any
   NEW class exists; (b) LB-1 column-vs-Redis with the trade-offs settled; (c) the project's real
   alert mechanism (grep H1's limiter fail-open alert; cron route logging; no invented infra);
   (d) the exact summary-truthfulness fix (item 3: `flipped:false` flows — read `markSettlement*`
   return handling); (e) the full forced-test sweep; (f) migration shape IF column path (nullable,
   index, NULLs-first) + the apply-then-deploy runbook. ⚠️ NB: if the trace proves rotation can be
   had with ZERO schema change at equal safety (Redis cooldown), prefer it and say so — but the
   tier stays HIGH-STAKES either way (reconciler edit).
2. **Build plan** (DRAFT until audited): exact per-file recipes; the starvation regression test
   that FAILS pre-fix (synthetic sticky rows occupy the window every run pre-fix); behavior-neutral
   pins (a confirmable row still credits exactly once; summary arithmetic); SCOPE GUARD §1; gates
   (tsc 0 / vitest 4322+N / build 0 / eslint 0 / mcp 1898-1 / python byte-stable / numstat
   confined).
3. **MANDATORY independent pre-build audit — HIGH-STAKES shape:** dynamic Workflow fan-out, adapt
   `.audit/g-prebuild/prebuild-audit.mjs` (keep the hardened tail VERBATIM) → `.audit/s-prebuild/`.
   **Full ~7-lens set in COVERAGE MODE** (every finding incl. uncertain/low, confidence+severity
   tagged, NO self-filtering) **+ adversarial verify per sustained finding** (default-refuted).
   Suggested lenses: factual/file-line accuracy · funds-safety (exactly-once + credit-reach — no
   row loses its eventual credit) · starvation-correctness (LB-1: deferral-never-exclusion, walked
   adversarially incl. NULL/err/crash timing) · migration/deploy-ordering (LB-2, DC-14; or
   Redis-semantics if cooldown path) · observability/alert truthfulness (DC-18) · scope/spine
   (zero out-of-spine; reject gold-plating) · test sufficiency (fail-pre-fix REAL; DC-05 mock
   factories vs new symbols). **MECHANICAL-FIRST:** gates; a window-shape probe (current SELECT/
   ORDER/limit extracted from source); a starvation simulation script (pure-node: model 30 sticky
   + 5 confirmable rows through the planned ordering, prove reach-within-K); summary arithmetic.
   **RECURRENCE LENS** from `.audit/defect-ledger/INDEX.md` — charge **DC-09** (the ledger class
   for THIS exact failure), DC-01, DC-06, DC-14, DC-17, DC-18, DC-05, DC-15; turn Detection cues
   into probes. **MODEL POLICY (set per-agent explicitly, never inherit):** lenses + synthesizer =
   `opus`, effort high; per-finding refuters = `sonnet`, effort high; mechanics = scripts. R1→fix→
   R2 on blockers; degraded ≠ pass (`resumeFromRunId` replays cached agents); defer NO finding;
   PLAN_READY 0-blocking with all fixes folded + live-re-confirmed BEFORE any code. Embed the
   spine-safeguard clause verbatim: zero findings is a valid outcome; scope-growth findings are
   `rejected-scope-expansion` unless they prove a PLANNED change wrong.
4. **Single-writer build with INTERVAL SELF-VERIFICATION:** after each major batch (rotation
   landed; alert+summary landed; tests landed), ONE fresh-context `sonnet` read-only subagent
   diffs built-state vs THIS handoff §1/§2/§4 and reports drift; re-confirm hits live. Prove
   fail-pre-fix empirically (capture to `.audit/s-build/`).
5. **Executable gate** → END THE BUILD SESSION with a CADENCE-STATUS report flagging readiness
   for ② the seal-gating review. (The seal: funds-safety panel — HIGH-STAKES, so ③ post-seal deep
   audit follows it.)
6. At close (after ② seals): founder-gated LOCAL commit (path-scoped; founder identity; Claude
   trailer) + capstone + **close B1.4 items 2-4** in the debt doc + the **(G)-capstone
   stale-B4-pointer RIDER** (docs-only) + ledger + memory. **Surface to the founder:** the
   migration (if any) APPLY-THEN-DEPLOY runbook; B1.4 register fully closed; remaining queue =
   B1.1 + small (G) residual tidies + gated items.

## 6. Conduct (binding)
(a) self-verify per §5.4 at the stated intervals with fresh-context subagents; (b) ground EVERY
progress claim in a tool result from the session — report only what you can point to evidence
for; (c) act once you have enough information — no re-deriving settled facts (the §0 queue
archaeology is DONE; the spine decisions are SETTLED), no surveying options you won't pursue;
(d) NEVER stop, summarize, or suggest a new session on account of context limits — the harness
manages context; (e) end the build session with the CADENCE-STATUS report the moment the
executable gate is green.
