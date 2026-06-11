# (T) Terminal-transition integrity & credit observability — CHUNK HANDOFF (2026-06-10)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> Closes the ③ deep-audit register's two HIGHs + the same-line MED
> (`s-deep-audit-register-2026-06-10.md` items **P1 + P2 + P3**) — the highest-priority
> pre-existing money-path defects in the system, both LIVE in deployed prod today.

## 0. Source-of-truth confirmation (derived 2026-06-10 — RE-VERIFY cited lines, do not re-derive the queue)
Ordering chain: the (S) resolution doc's queue + the ③ deep-audit register + the ③ cadence
status ("NEXT: P1 → P2 → B1.1") all agree. The B1.4 register is CLOSED ((G)+(S)); B1.1 stays
queued BEHIND this chunk (INCREMENTAL, different rail — the explicit dilution-forbidden fold).
Sequencing dependency flagged: P1/P2/P3 share one seam (below), so the strict P1→P2 order is
SUPERSEDED by this merge. Migration `0016` (new, this chunk) must be applied AFTER `0015`
(already applied to prod 2026-06-10) and BEFORE the (T) code deploys — same APPLY-THEN-DEPLOY
class as (S). No dependency on whether the founder has pushed the local (G)/(S)/(S③) commits.

## 1. SCOPE DECISION (sized 2026-06-10 against current capability — record verbatim)
**MERGED: register items P1 + P2 + P3 into one chunk** — they are ONE seam (the terminal-flip +
credit machinery: `ledger.ts` `markSettlementSettled`/`markSettlementFailed` +
`reconcile.ts` `reconcileOneRow`'s flip/credit tail + `creditSettlement`) and ONE invariant
family, and a single spec states "done" for all three:
- **P1 (the core, HIGH):** flip→credit non-atomicity — a process kill (maxDuration/OOM) between
  the settled-flip and the credit loses a developer credit SILENTLY (no log, terminal row never
  re-selected, no marker to detect it after the fact). Fix shape: a credited-marker written in
  the SAME transaction as the credit (column `credited_at`, migration `0016`) + a sweep/alert
  for settled reconcilable-rail rows lacking it. Affects the reconciler AND the live
  proxy/kernel credit paths (critic C1: the live window is larger).
- **P2 (HIGH):** `markSettlementFailed` has no compare-and-set on `external_ref` — a reconciler
  run holding a STALE hash from its batch SELECT can terminally flip `failed` while the live
  path's resubmitted tx (verified live: `orchestrate.ts:327-336` fresh-submit fall-through after
  a clean nonce-free revert; `markSettlementBroadcast` re-points `external_ref`) settles
  on-chain: USDC collected, dev never credited, ledger wrong, zero alerts. Fix shape: the
  failed-flip CASes on the hash actually confirmed (`AND external_ref = <confirmedTxHash>`).
- **P3 (MED, same line):** the credit gate (`reconcile.ts:131`) gains the F2 mainnet pin (the
  reconciler is today the ONLY credit-capable surface that would credit withdrawable balance
  for a Base-Sepolia row reaching the prod DB) and replaces the hardcoded `'x402' ||
  'circle-nano'` with the shared `RECONCILABLE_RAILS` source of truth.
**REJECTED merges:** (a) **P4** transport timeout — different seam (RPC transport in
`settle-engine.ts`, latency/ops invariant, not ledger transitions); next chunk. (b) **P5**
terminalization — different seam (write-ahead lifecycle in `orchestrate.ts`). (c) **B1.1** —
unrelated INCREMENTAL on a different rail; the forbidden dilution class. (d) (G) residual
tidies — different seam. **The bar:** *"Every terminal flip is keyed to the on-chain evidence
that justified it (no stale-hash terminalization), every credit is recorded atomically-or-
detectably with its flip (no silent lost credit — a sweep can enumerate settled-but-uncredited
rows), the credit gate only fires for mainnet rows on reconcilable rails, and the exactly-once
property (one actor flips, the flipper credits, never two) is preserved byte-for-byte in
observable behavior."*

## 2. TIER: **HIGH-STAKES** (later phases inherit; multiple triggers — recorded per the cadence)
- **Changes the core money invariant's own machinery:** this chunk deliberately OPENS the
  surfaces every prior chunk held frozen — `creditSettlement`, `markSettlementSettled`,
  `markSettlementFailed`, the reconciler credit gate. The exactly-once credit property must
  survive byte-for-byte in behavior while its implementation changes.
- **Schema change + migration `0016`** on the live real-money table (APPLY-THEN-DEPLOY, DC-14).
- **Touches the live proxy/kernel settle paths** (the marker must cover every credit writer or
  the sweep lies — LB-1).
- Adds a NEW operator contract (the uncredited-row sweep/alert) — a published-behavior gate.

### The 1-2 LOAD-BEARING decisions most likely to be SILENTLY WRONG
**LB-1 — Marker-coverage completeness: the sweep is only as honest as its writer census.** If
ANY path that credits a developer for a settled on-chain row does NOT write the marker in the
same transaction, the sweep false-positives those rows as "uncredited" forever (operator noise
→ alarm fatigue → the real lost-credit drowns); if any path that does NOT credit writes the
marker, the sweep false-negatives a genuine loss. The trace must CENSUS every credit writer
against every settled-row producer: `creditSettlement` callers (reconciler tail, kernel
`/settle`), the proxy's `forwardAndBill` in-request credit (does it share `creditSettlement` or
its own SQL? — verify, don't assume), sessions/finalize, and any row that becomes `settled`
WITHOUT a credit being owed (pre-F4 legacy rows; rows settled by the live path that credited
in-request — when is THEIR marker written?). Decide the marker semantics deliberately:
`credited_at` meaning "the credit transaction committed" vs "no credit owed" — legacy/backfill
handling (NULL on old settled rows must NOT page the operator: the sweep needs a created_at or
settled_at lower bound, or the migration backfills a sentinel — choose with evidence, document
in the runbook). Pin with tests that fail when a census member is missing.
**LB-2 — CAS semantics that never block a LEGITIMATE failed-flip (DC-12/DC-17 inverse).** The
failed-flip CAS must reject ONLY stale-hash flips: the live settle path also calls
`markSettlementFailed` (census its callers) and each caller must pass the hash IT confirmed —
`markSettlementFailed`'s `txHash` param is OPTIONAL today (`...(txHash ? ...)`): decide
signature evolution (required-for-CAS variant vs new function) without breaking compiling
callers silently; a CAS that compares against a hash the caller never had turns every
legitimate failure into a permanent-pending zombie (the inverted defect). Equally: the P3 F2
pin must gate ONLY the credit (or the flip+credit — decide with evidence), must use the
EXISTING env-pinned predicate (`X402_MAINNET_NETWORK` / `isX402TestnetSettlementAllowed` —
grep their real names), and must NOT block legitimate Base-mainnet credits (the (G) LB-2
over-broad-guard trap). ⚠ If the trace proves the live path's failed-flips already always pass
their confirmed hash, say so and keep ONE function with a required hash; prefer the minimal
mechanism that provably closes the race.

## 3. INTENT
*Why:* both HIGHs are silent-lost-credit defects on the REAL-MONEY path, live in prod today;
each currently ends with "USDC collected, developer never credited, nothing logged". The (S)
chunk made the reconciler safe at volume; (T) makes the terminal transitions it performs (and
the live paths it backstops) evidence-keyed and observable. *Who consumes:* (1) developers'
balances (the payout source of truth); (2) the operator, who gains the first tool that can
ENUMERATE lost credits instead of inferring them; (3) the reconciler cron + live settle paths;
(4) future chunks via the writer-census tests. *What it enables:* closes the two highest-risk
register items; the sweep becomes the standing financial-integrity check the deep audit found
missing (and `verifyLedgerIntegrity`'s settlement-row offset — register P6 — can note it as the
companion check when that one-liner lands).

## 4. Ground state + frozen surfaces
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `231b8693`** ((S③), LOCAL-only) atop
  `9a510f12` ((S) SEALED) atop `c05d0203` ((G) SEALED) atop `origin/main = 23663006` (deployed
  prod LIVE). Build atop `231b8693`. Confirm: `git log -4 --oneline && git status -sb`.
  **Do NOT push** (founder-gated; Vercel build budget).
- **Baselines (re-run to anchor BEFORE any edit):** `apps/web`: tsc **0** · vitest **4336 /
  187 files / 0 fail** · build **0** · eslint changed **0**. `packages/mcp` byte-stable
  (1898 / 1 skip — re-run only if `git diff --numstat packages/` goes non-empty). Python
  byte-stable. ⚠ Known pre-existing isolation flakes (register P7): `hop-rail-guard.test.ts` +
  `gas-wallet-monitor.test.ts` fail in ISOLATED/small-group runs on the pristine tree yet pass
  in full-suite runs — do not chase them; gate on the FULL suite.
- **UNFROZEN for this chunk (the licensed surface):** `apps/web/src/lib/settlement/ledger.ts`
  (`markSettlementSettled`/`markSettlementFailed` ONLY), `reconcile.ts` (`creditSettlement` +
  `reconcileOneRow`'s flip/credit tail + the credit gate), the live credit sites the LB-1
  census proves necessary (proxy `forwardAndBill` credit block; kernel `/settle` credit),
  `db/schema.ts` + NEW migration `0016` + `scripts/bootstrap__drizzle_migrations.sql`, the
  sweep (new lib + cron or fold into the reconcile run — trace decides), tests.
- **BYTE-STABLE spine (do not modify):** `confirmSettlementTx` + all of
  `circle-nano/settle-engine.ts`, `rails.ts`/`RECONCILABLE_RAILS` (consumed, not edited),
  `recordSettlementEntry`/`settlementEntryId` idempotency, `markSettlementBroadcast`,
  `parseSettlementOperationId`, the (S) rotation machinery (COALESCE ordering, per-row
  mark-before-examine, run budget, alert — extend the SUMMARY only if the sweep folds into the
  run), the WHERE-pending flip CONTRACT itself (CAS narrows it; never widens), payouts/pricing,
  packages/mcp + sdk-python. Migration `0015` is byte-frozen (applied; hash-registered).
- **Key files:** `ledger.ts:543-624` (the three markSettlement*), `reconcile.ts:105-262`
  (reconcileOneRow + creditSettlement), `reconcile.ts:131` (credit gate — P3's line),
  `orchestrate.ts:327-336` (the resubmit fall-through that makes P2 real),
  `app/api/proxy/[slug]/route.ts` (forwardAndBill credit — LB-1 census), kernel settle route,
  `drizzle/` (next = `0016`; hand-written per 0014/0015 precedent — drizzle-kit generate is
  FORBIDDEN, meta snapshot intentionally partial), `env.ts` (the F2-pin predicates).
- **Real-money guardrails:** no push, no prod env change, no migration APPLY (hand-write +
  register hash; founder applies via runbook — APPLY-THEN-DEPLOY), no publish. DB read-only.
  Single-writer core; fan-out for audit gates only. zsh: quote bracketed paths.

## 5. THE ARC (do not skip/reorder)
1. **Scope-confirm trace** (`t-terminal-transition-trace-2026-06-10.md`): re-derive every claim
   here against live code; nail (a) the LB-1 credit-writer census (every path crediting for a
   settled row; every path producing a settled row; which already share `creditSettlement`);
   (b) marker semantics + legacy-row handling (sweep lower bound vs backfill sentinel);
   (c) the LB-2 CAS shape (markSettlementFailed caller census; signature decision) AND whether
   the settled-flip needs the same CAS (a stale-hash SETTLED flip: walk it — is it harmless
   because settled-is-settled, or can it record the WRONG txHash as evidence?); (d) the P3 pin
   predicates' real names + gate placement; (e) the sweep's delivery (fold into the reconcile
   run summary/alert vs separate cron — weigh maxDuration budget from (S③)); (f) migration
   0016 shape + runbook; (g) the full forced-test sweep (DC-05: mock factories vs every new
   symbol; the (S) test files' mock plumbing will need the new column + marker writes).
2. **Build plan** (DRAFT until audited): exact per-file recipes; fail-pre-fix tests for BOTH
   HIGHs (P1: a kill between flip and credit leaves a detectable settled-unmarked row — the
   sweep test must fail pre-fix; P2: a stale-hash failed-flip must be REJECTED post-fix and the
   test must show it LANDING pre-fix); behavior-neutral pins (exactly-once still holds; every
   existing credit path still credits; legitimate failed-flips still land); SCOPE GUARD §1;
   gates (tsc 0 / vitest 4336+N / build 0 / eslint 0 / mcp+python byte-stable / numstat
   confined / 0015 hash untouched).
3. **MANDATORY independent pre-build audit — HIGH-STAKES shape:** adapt
   `.audit/s-prebuild/prebuild-audit.mjs` (hardened tail VERBATIM) → `.audit/t-prebuild/`.
   **Full ~7-lens set in COVERAGE MODE + adversarial verify per sustained finding
   (default-refuted).** Suggested lenses: factual/file-line accuracy · funds-safety
   (exactly-once under the NEW implementation — the decisive lens) · census-completeness (LB-1
   walked adversarially: a missed writer = the sweep lies) · CAS-correctness (LB-2 incl. the
   zombie-row inverse and every caller) · migration/deploy-ordering (DC-14; 0016 + sweep query
   vs old code) · scope/spine (zero out-of-license edits; reject gold-plating) · test
   sufficiency (fail-pre-fix REAL for both HIGHs; DC-05). **MECHANICAL-FIRST:** gates; a
   writer-census grep script (every `balanceCents` increment site, every `settlementStatus`
   transition site — deterministic); a pure-node interleaving simulation for the CAS (stale-hash
   vs legitimate flows); migration-hash convention check. **RECURRENCE LENS** from
   `.audit/defect-ledger/INDEX.md`: charge **DC-01** (this chunk's headline — incl. its new
   process-kill face) + **DC-06/DC-02** (the CAS face just added), DC-09 (the sweep must not
   create a new immortal-row class), DC-14, DC-17 (CAS must not wedge re-runs), DC-18 (the
   sweep alert's truthfulness), DC-05, DC-15, DC-07 (P3's constant unification), DC-13 (the F2
   pin is latent-by-design — test it as latent). **MODEL POLICY (set per-agent explicitly,
   never inherit):** lenses + synthesizer = `fable` (the harness's most capable tier), effort
   high (no per-agent effort knob exists — record on the Policy line); per-finding refuters =
   `opus`, effort high; mechanics = scripts. R1→fix→R2 on blockers; degraded ≠ pass; defer NO
   finding; PLAN_READY 0-blocking with all fixes folded + live-re-confirmed BEFORE any code.
   Spine-safeguard clause VERBATIM from the (S) script: zero findings is a valid outcome;
   scope-growth findings are rejected-scope-expansion unless they prove a PLANNED change wrong.
4. **Single-writer build with INTERVAL SELF-VERIFICATION:** after each major batch (CAS landed;
   marker+migration landed; sweep landed; tests landed), ONE fresh-context `sonnet` read-only
   subagent diffs built-state vs THIS handoff §1/§2/§4 and reports drift; re-confirm hits live.
   Prove fail-pre-fix EMPIRICALLY for both HIGHs (capture to `.audit/t-build/`).
5. **Executable gate** → END THE BUILD SESSION with a CADENCE-STATUS report flagging readiness
   for ② the seal-gating review (funds-safety panel; HIGH-STAKES → ③ post-seal deep audit
   follows).
6. At close (after ② seals): founder-gated LOCAL commit (path-scoped; founder identity; Claude
   trailer) + capstone + close register items P1/P2/P3 + ledger + memory. **Surface to the
   founder:** the 0016 APPLY-THEN-DEPLOY runbook (after 0015, before the (T) deploy); the
   sweep's operator contract; remaining queue = P4 + P5 + B1.1 + P6/P7 + (G) tidies.

## 6. Conduct (binding)
(a) self-verify per §5.4 at the stated intervals with fresh-context subagents; (b) ground EVERY
progress claim in a tool result from the session — report only what you can point to evidence
for; (c) act once you have enough information — no re-deriving settled facts (the §0 queue
archaeology is DONE; the (S)/(S③) decisions are SETTLED), no surveying options you won't
pursue; (d) NEVER stop, summarize, or suggest a new session on account of context limits — the
harness manages context; (e) end the build session with the CADENCE-STATUS report the moment
the executable gate is green.
