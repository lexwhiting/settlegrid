# (V) ② SEAL-GATING REVIEW — HANDOFF (2026-06-12)

> ## ② OUTCOME (annotated 2026-06-12, the ② session): **SEALED** — `.audit/v-seal/SEAL.md`
> Panel `wf_0d2e5c67-319`: 7 fable lenses / 42 findings / 38 refuted / 4 sustained
> (1 medium + 3 low) / 0 dead lenses / 0 refuter deaths. FIVE seal fixes landed (all live
> red→green): F-1 bounded-reader NaN escape (battery-exhibited; viem formatBlock yields
> `timestamp: undefined` without throwing); S1 quarantine truth CAS (isNull(externalRef) +
> rowcount-gated alerts — the P8(b) alert can no longer false-fire on a tracked tx);
> S2 the plan-promised regex guard on the refresh's stored-value ::numeric cast;
> S3 truthful pass counters; S4 the C4 emit hoisted post-commit. Final gate: vitest
> 4428/191/0 · tsc 0 · build 0 · eslint 0 · battery 38/38 · pinned suites zero-diff+green.
> §6's gate figures (4423) and §2's reader description (no finite guard) describe the
> ②-ENTRY tree — superseded by the sealed tree; this block + SEAL.md are canonical.
> ③ attention items recorded in SEAL.md (nonce-read block-pinning; reject-class breadcrumb;
> chainTs plausibility bound).

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> The (V) chunk (register P5 + P8(a,c,e,f) + P8(g): the pending-row write-ahead lifecycle +
> terminalization-evidence invariant) is BUILT and its executable gate is GREEN. Your session
> runs ② — the independent, hostile, fresh-context review that DECIDES the seal. HIGH-STAKES →
> ③ (post-seal deep audit) follows in a later session; that must not reduce ②'s rigor.

## 0. Ground state (verify before anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `6465402c`** ((V) handoff doc commit)
  atop **`adb1e849`** (the (U) close commit) atop `f7a15925`, atop **origin/main = `a016685a`**
  (DEPLOYED + LIVE — real USDC on Base mainnet rides this code).
- **The (V) chunk is UNCOMMITTED working-tree state** — the LOCAL commit happens at close,
  AFTER ②/③ (founder-gated, path-scoped). Do not commit, push, deploy, set env, or touch the
  DB (read-only). zsh: QUOTE bracketed paths.
- The built diff: `git diff` — EXACTLY 10 modified files, no new test files:
  `apps/web/src/lib/settlement/ledger.ts` ·
  `apps/web/src/lib/settlement/circle-nano/settle-engine.ts` ·
  `apps/web/src/lib/settlement/circle-nano/settle.ts` ·
  `apps/web/src/lib/settlement/x402/orchestrate.ts` ·
  `apps/web/src/lib/settlement/reconcile.ts` ·
  `apps/web/src/lib/settlement/__tests__/reconcile.test.ts` ·
  `apps/web/src/lib/settlement/__tests__/terminal-transition.test.ts` ·
  `apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts` ·
  `apps/web/src/lib/settlement/circle-nano/__tests__/settle.test.ts` ·
  `apps/web/src/lib/settlement/x402/__tests__/orchestrate.test.ts`.
  Untracked: `docs/tech-debt/v-pending-lifecycle-{trace,build-plan}-2026-06-11.md` + this
  file. `.audit/` is gitignored by repo convention (artifacts persist on disk only).
- ⚠ register-P7 isolation flakes (`hop-rail-guard`, `gas-wallet-monitor`) — gate on the FULL
  vitest suite only; isolated runs of THOSE files are unreliable (the settlement suites run
  fine in isolation). Do NOT upgrade vitest (2.1.9) mid-chunk.
- ⚠ The pre-build probe suite `.audit/v-prebuild/probes/probes.mjs` (33/33) describes the
  PRISTINE tree + the plan's predicates — its truth tables remain valid documentation of the
  intended predicates, but do NOT re-run it as a post-build gate.
- ⚠ Session limits: one ①-audit round lost ALL agents to a weekly usage limit; the workflow
  tail's degraded-run guard (refuter-death = fail-safe SUSTAINED, dead lenses = no pass)
  exists for exactly this — reuse it VERBATIM and never let a silently-dead lens count as
  coverage.

## 1. READ FIRST, in order
1. `docs/tech-debt/v-pending-lifecycle-handoff-2026-06-11.md` — the chunk charter: §1 SCOPE +
   THE BAR + REJECTED merges; §2 tier + LB-1/LB-2/LB-3; §3 frozen surfaces; §4 the ARC.
2. `docs/tech-debt/v-pending-lifecycle-trace-2026-06-11.md` — censuses (the 6-site
   markSettlementBroadcast census, interpretReceipt consumers, null-ref row classes), the
   LB-1 proof-obligation walk (chain-anchored, with supersession markers), the LB-2
   caller×ref-state matrix, the placement decision. Where trace and plan disagree, the PLAN
   is canonical (drift is marked in-place).
3. `docs/tech-debt/v-pending-lifecycle-build-plan-2026-06-11.md` — the audited recipes
   (PLAN_READY at R5 after five R→fix→R rounds; R1-B1..R4-B8 markers inline), the
   §DELIBERATE register (11 decisions), behavior pins incl. the BUYER-DELTA CENSUS, gates.
4. `.audit/v-build/BUILD-STATUS.md` — what shipped + the full red→green evidence trail +
   the interval-verification verdicts (CLEAN ×2).
5. `.audit/v-prebuild/R5-VERDICT.md` — the pre-build audit record (R1 wf_597dc587 → R2
   wf_d45e9e2e → R3 wf_49c3bd7f → R4 wf_837a0805 → R5 wf_b7c9a3a4 PLAN_READY; 8 blockers
   B1–B8 folded pre-code).
6. Templates to ADAPT (do not reuse blindly): `.audit/u-seal/SEAL.md` + the (U) ② panel
   pattern, `.audit/v-prebuild/prebuild-audit.mjs` (the hardened workflow tail — degraded-run
   guard, refuter-death fail-safe-sustained, synthesizer-death inline fallback — reuse the
   TAIL verbatim), and `.audit/t-seal/hostile-battery.mjs` (the script-resident
   hostile-input battery pattern) → write yours to `.audit/v-seal/`. Produce `SEAL.md`.

## 2. What was built (re-derive against the diff, don't trust this summary)
1. **ledger.ts** — (a) `markSettlementBroadcast` gains a REQUIRED 4th param
   `expectedPriorRef: string | null`; WHERE gains the no-clobber disjunction
   `(ref IS NULL ∨ ref = txHash ∨ ref = expectedPrior)` (P8-e). (b) NEW
   `markSettlementExpiredNoBroadcast(op, rail, provedValidBefore, evidence)` — TWO CAS
   conjuncts (`ref IS NULL` ∧ `metadata->>'validBefore' = proved`), terminalization evidence
   merged in the SAME statement, settled_at untouched. (c) NEW
   `refreshPendingValidBefore(op, rail, vb)` — RAISE-only (`CASE WHEN metadata ?
   'validBefore' THEN COALESCE(…) || GREATEST-merge ELSE metadata END`), WHERE pending,
   returns rows>0. `markSettlementSettled`/`markSettlementFailed` BYTE-IDENTICAL.
2. **settle-engine.ts** — (a) P8(g), the (U)-③ HIGH: `interpretReceipt`'s reverted-branch
   nonce-recheck CATCH now returns `{kind:'broadcast-unconfirmed', txHash,
   reason:'revert-nonce-unverifiable'}` (was: fall-through `nonceConsumed:false` → both
   orchestrators terminalized 'failed' on incomplete evidence); the reason union is extended
   additively. (b) NEW bounded readers on the (U) reconciler transport (never the live
   client), both never-throw: `readAuthorizationStateBounded` →
   'consumed'|'unconsumed'|'unknown'; `readSafeBlockTimestampBounded` → safe-head block
   timestamp seconds | null (blockTag 'safe', NOT 'latest' — unsafe-head reorgs).
   (c) the confirmSettlementTx docstring rider (x402 DOES pass eip3009).
   `publicClientFor`/wallet client/`RECEIPT_TIMEOUT_MS`/submit guards BYTE-IDENTICAL.
3. **settle.ts + orchestrate.ts (symmetric)** — P5-i: ensurePendingRow metadata gains
   `validBefore: BigInt(vb).toString(10)` (CANONICAL decimal — the BigInt verifier accepts
   hex). The awaited `refreshPendingValidBefore` right after it; on `false` → re-read →
   terminal abort, NO submit (R2-B5b). P8-a: the recovery-resubmit path re-reads
   `findSettlementRow` IMMEDIATELY pre-submit, aborts on terminal. P8-e: all SIX
   markSettlementBroadcast sites pass expectedPrior (2 onBroadcasts threading the step-1/2
   read's ref; 4 applyOutcome-interior arms via a new applyOutcome param). P8-f: the mirror
   branch returns the WINNING hash (result.txHash) when the re-read row is terminally
   non-settled. 3e (the ③-(U) F2 fold, fold-on-open trigger discharged): the clean-reverted
   arms read markSettlementFailed's CAS boolean — false+still-pending → 502
   PENDING_CONFIRMATION + `*.settle_reverted_stale_ref` warn; false+settled → settled
   alreadySettled; false+failed/null → the truthful 402.
4. **reconcile.ts** — the EXPIRY PASS (`runExpiryPass`): positioned detectors → pass →
   window SELECT (detectors-first PRESERVED; `examinationDeadline` computed once at its
   original site, NOT recomputed — pass time debits the shared 40s envelope); own try/catch
   (`reconcile.expiry_pass_failed` + run continues); candidates SELECT issued
   UNCONDITIONALLY (pending ∧ reconcilable rail ∧ `external_ref IS NULL` ∧ created<cutoff ∧
   `(metadata->>'expiryClass') IS NULL`, COALESCE rotation order, LIMIT 3); per-candidate
   deadline-check-BEFORE-watermark + a MID-candidate re-check between the chain and nonce
   reads (worst ≈ 20.15s); per-candidate predicate: (1) opid-unparseable /
   non-canonical-network (via `isCanonicalX402Network` — NOT USDC_ADDRESSES, which contains
   eip155:1) → quarantine; (2) absent validBefore → quarantine 'legacy-no-validbefore'
   (NEVER guess); (2.5) malformed value (`^\d+$` + finite + >0) → quarantine 'unparseable';
   (3) wall-clock pre-filter (vb+300s — NOT the proof); (3.5) the CHAIN-TIME anchor
   (safe-head ts must EXCEED vb; null/lagging → stay pending); (4) nonce state NOW —
   'unknown' → stay pending; 'consumed' → quarantine 'nonce-consumed-untracked' +
   `reconcile.expired_nonce_consumed_quarantined` error (attributive wording — THE P8(b)
   detection win, NEVER 'failed'); 'unconsumed' → the evidence-CAS writer with the
   CANDIDATE-READ bound. Quarantine = COALESCE-wrapped jsonb merge, row stays 'pending',
   class excluded from re-selection; one-shot `reconcile.expiry_unprovable` error for the
   unprovable classes; `reconcile.expiry_pass` info {examined, terminalized, quarantined,
   unknown} when examined>0. PLUS P8-c (the settled-noop failed-row re-read → the EXACT (T)
   alert key `settlement.settled_evidence_on_terminal_failed_row`; tally stays
   settled-noop) and the C4 rider (tools-UPDATE `.returning` zero-row →
   `settlement.credit_tool_stat_unmatched` error, NEVER throw).
   Summary shape/identity UNCHANGED. NO migration; NO vercel.json change.

## 3. The bar (charter §1, verbatim — what ② certifies)
*"No pending settlement row is immortal-by-construction: a never-broadcast authorization
terminalizes once provably expired AND nonce-unconsumed on-chain, and quarantine-classifies
otherwise; NO actor — live path, reconciler, or the new expiry pass — terminalizes on
incomplete evidence (a failed nonce-recheck or a failed expiry-proof read always degrades to
a pending-side state); a known-good ref is never clobbered; the live resubmit re-checks
terminality pre-submit; every surviving race remains DETECTED; the (U) detectors-first
guarantee and the live submit/receipt transport are byte-identical."*

## 4. Tier + the load-bearing hazards (charter §2 — re-confirm against the diff)
- **Tier: HIGH-STAKES** (all five charter triggers fire: new terminal-transition actor;
  frozen money surfaces opened — interpretReceipt LIVE branch, ledger.ts, BOTH
  orchestrators; write-contract change; exactly-once/credit invariants; failure-direction
  guarantees). The build-session view: realized diff == the plan's file set exactly, no
  unlicensed frozen-surface touch (two fresh-context interval verifies came back CLEAN) —
  but that is OUR claim; re-derive it.
- **LB-1 (THE funds trap):** "expired" alone is NOT proof of no-movement. The
  mined-then-expired row (writeContract succeeded, onBroadcast died → ref NULL; tx mined
  before vb passed: nonce consumed, USDC moved) MUST quarantine, never 'failed'. The
  realized predicate is chain-anchored + conjunctive + evidence-CASed — attack every cell:
  malformed/absent/stale/hex validBefore, sequencer-stall shapes, the
  refresh-vs-flip-vs-onBroadcast interleavings (trace §b records the ② must-audit
  interleaving explicitly), Number() precision at huge values, jsonb NULL semantics.
- **LB-2:** the no-clobber conjunct must reject a loser overwriting a known-different
  winner ref while preserving the same-actor T1→T2 crash-recovery re-point. Wrong one way =
  bricked recovery (immortal pending, DC-09); wrong the other = P2 reopened. Walk all 6
  sites × ref-states × expectedPrior values against ledger.ts's realized WHERE.
- **LB-3:** P8(g) is consumed by BOTH rails' applyOutcome arms AND both recovery predicates
  (`storedTxDefinitivelyFailed` — the no-resubmit-on-incomplete-evidence second face) AND
  buyer responses. RE-VERIFY the consuming arms against the realized code, do not inherit.
- **Hostile-input note:** this chunk opens NO new HTTP boundary. The "new public boundaries"
  are (i) the engine's error-shape surface under degraded/malformed RPC responses (the new
  CATCH + the two bounded readers under timeouts, throws-of-any-shape, malformed blocks —
  e.g. a getBlock result with a missing/garbage timestamp), (ii) row METADATA as an input
  surface to the expiry pass (malformed/adversarial validBefore shapes, NULL metadata,
  pre-classified rows), and (iii) the run's behavior under DB failures inside the pass. The
  hostile battery stays a SCRIPT driving the REAL functions via mocked-client/db error
  shapes (adapt the (T)/(U) battery pattern).
- **Buyer-delta census (the plan's behavior-pin section — ② must find these and ONLY
  these):** non-abort: (1) P8-f mirror txHash = winner; (2) P8(g) 402→502 on the
  failed-recheck branch; (3) 3e CAS-false+pending 402→502; (4) 3e CAS-false+settled 402→200
  alreadySettled. Licensed race-window aborts: (5) P8-a pre-submit terminal-abort; (6) the
  refresh-false terminal-abort; (7) P8(g) recovery face (no resubmit). An EIGHTH delta =
  a finding.

## 5. Frozen / byte-stable spine (zero behavioral delta; reject any "fix" that perturbs it)
The (U) reconciler transport (RECONCILER_RPC_*, reconcilerPublicClientFor's existing body,
confirmSettlementTx's behavior incl. its (U) LB-2 reason) + detectors-first ordering + both
detector blocks/payloads + the error-level overdue_examined carrier; publicClientFor +
wallet client + RECEIPT_TIMEOUT_MS + submit guards; markSettlementSettled +
markSettlementFailed byte-identical ((T) CAS untouched); creditSettlement except the C4
lines; the credited_at marker; the sweep WHERE/alert semantics; the (S) rotation (window
WHERE/ORDER, mark-before-examine, watermark, budget/deferred); the cron route;
RECONCILABLE_RAILS; payouts/pricing; packages/ (numstat empty); migrations NONE; summary
shape/identity (NO new outcome keys, NO new summary fields). The THREE PINNED un-edited
suites: `__tests__/reconcile-starvation.test.ts` +
`circle-nano/__tests__/transport-isolation.test.ts` +
`__tests__/reconcile-detector-availability.test.ts` — ZERO diff lines (verified), must stay
green. `terminal-transition.test.ts` WAS licensed open (the or-node + jsonb-text-eq
evalWhere extensions + new describe blocks; every pre-existing assertion byte-identical —
verify the moved-vs-changed discipline yourself).

## 6. Clean-gate evidence from the build session (re-run the gate fresh yourself; hand
results to reviewers so none re-derive checkable facts)
tsc **0** · FULL vitest **4423 pass / 191 files / 0 fail** (baseline 4368 + 55 new tests /
0 new files) · next build **✓ 0** · eslint changed files **0** · numstat = the 10 licensed
files only · packages diff **0** · pinned suites zero-diff + green. Captures in
`.audit/v-build/`: `prefix-red-batch1-RV1-RV1b.txt` (no-clobber reds) ·
`prefix-red-batch1-B5-B6-cells.txt` (the evidence-CAS + raise-only stage-A reds) ·
`prefix-red-batch2-engine.txt` (P8(g) both entry points) · `prefix-red-batch3-settle.txt`
(12 reds) · `prefix-red-batch3-orchestrate.txt` (11 reds) ·
`prefix-red-batch4-reconcile.txt` (13 reds incl. R-V12 mined-then-expired) ·
`postfix-green-batch{1,2,3,4}.txt` · `gate-vitest-full.txt` · `gate-build.txt`.

## 7. The ELEVEN deliberate decisions (plan §DELIBERATE — scrutinize on the merits, flagged
not hidden)
(1) expiry pass IN-RUN (not a cron), detectors→pass→window, pass time debits the shared
envelope; (2) quarantine = jsonb marker + one-shot classification error + standing
visibility via pending_overdue (NOT per-row page-until-closed — the alarm-fatigue
rationale); (3) P8-c keeps the settled-noop tally, names the class via the (T) alert key
only; (4) markSettlementBroadcast signature EXTENDED in place, 6 explicit wirings, no
default arg; (5) margin 300s is the wall-clock PRE-FILTER only — the proof is the
chain-time anchor; (6) the bounded readers' typed never-throw returns; (7) the
reason-union extension 'revert-nonce-unverifiable' (+ the :78 doc caveat); (8) LIMIT 3 /
14s sub-budget, corrected worst ≈ 20.15s via the mid-candidate re-check; (9) candidates
reuse last_reconciled_at mark-before-examine + classified-row exclusion (disjoint from the
(S) window via isNull/isNotNull); (10) refreshPendingValidBefore awaited + un-caught
(pre-submit fail-closed parity), RAISE-only + monotone; (11) the 3e F2 fold executed (the
register's fold-on-open trigger — the arms it names were open).

## 8. Recurrence lenses (charge from `.audit/defect-ledger/INDEX.md`)
DC-01 (credit atomicity — the headline; the quarantine-consumed arm IS a detector) · DC-09
BOTH directions (immortal rows AND wrong-expiry burying a recoverable credit) · DC-08
(every new read's failure direction; the never-throw readers) · DC-02 (resubmit
idempotency under the new aborts) · DC-06 (the broadcast variant + the evidence-CAS writer
are idempotent-writer edits; terminal flips CAS on the evidence they were keyed to) ·
DC-04 (validBefore/authorizationState/safe-tag vs the live contract + installed viem
2.47.4 — verify in node_modules, never recall) · DC-05 (test-double divergence — NEW
in-build face: vi.clearAllMocks does NOT clear mockResolvedValueOnce queues; the (V)
orchestrator describe blocks hard-reset their queue-bearing mocks in a local beforeEach —
fold at close) · DC-13 (expiry/race weather is latent — test as latent) · DC-15
(plan↔built drift) · DC-17 (the pass re-runs idempotently) · DC-18 (the quarantine
classes' truthfulness; pending_overdue becomes actionable; log-key levels — error reaches
Sentry, info/warn do not).

## 9. Model & effort policy → THIS harness (resolve before fan-out; record on the Policy line)
- Seal-deciding reviewers + integrator = **fable** (the harness's most capable tier).
- The core-invariant lens (funds-safety/failure-direction) calls for xhigh effort: **no
  per-agent effort knob exists in this harness** — set `model: 'fable'` and record the
  absence on the Policy line (the (T)/(U)/(V)-① precedent). No operator switch needed if
  the session model is fable (verify; the integrator must meet its tier).
- Single-finding refuters = **opus** (one frontier tier down), default-refuted; a refuter
  death fail-safes to SUSTAINED (the `.audit/v-prebuild/prebuild-audit.mjs` tail implements
  all of this — reuse the hardened tail VERBATIM, incl. the synthesizer-death inline
  fallback and the degraded-run guard; both were exercised for real during ①).
- Mechanics = scripts. Reviewers fresh-context, isolated, READ-ONLY, lens-only (never the
  cadence). If a reviewer is lost to a safety-classifier refusal (not an error), re-spawn
  once on the fallback tier and record it — a silently lost lens is a coverage hole.

## 10. Conduct (binding — the chunk charter wording)
Ground EVERY progress claim in a tool result from your session; act once you have enough
information; NEVER stop or suggest a new session on account of context limits — the harness
manages context. Single integrator in-session; reproduce every sustained high/medium
finding live (fail-against-built → pass-after-fix) before it lands; batch/spot-reproduce
lows; every fix re-enters a fresh review of its class (mechanical fixes may take a
proportionate reduced re-review — record the calibration). Reject fixes that pull in
deferred work (P9 credit-finality = FOUNDER gate; B1.1; P6 ops; P7 beyond the two shipped
riders; P8(b) machinery; ANY reconciler-transport change — (U)-sealed; migrations),
gold-plate, or perturb §5. End with `SEAL.md` in `.audit/v-seal/` + the bookkeeping the
prompt lists. After ②: if SEALED, the next session runs ③ (post-seal deep audit —
HIGH-STAKES). The close (founder-gated path-scoped LOCAL commit + capstone + register
P5/P8/P8(g) close + runbook updates [the four quarantine classes + the actionable-overdue
posture + the `unknown===examined` anchor-degradation cue] + the founder safe-tag curl
[`eth_getBlockByNumber("safe", false)` against the prod RPC] + defect-ledger folding
[incl. the new Once-queue DC-05 face] + memory) happens AFTER ③.

## 11. THE SEAL-GATE REVIEW PROMPT (verbatim — this is your mission statement)

The chunk is built and its executable gate is green. Before sealing, run an independent, hostile, fresh-context review of the actual diff — the review that DECIDES the seal. Assume a defect exists and work to exhibit it; do not certify by inspection. Scope is the BUILT CODE — not the plan, not the integrated system; do it fully and defer no finding to a later audit. The existence of any later phase must not reduce this one's rigor.

Inherit the chunk's risk tier from the handoff and RE-CONFIRM it against what was actually built; if the realized diff is riskier than the plan predicted (touched a frozen surface, opened an input boundary, etc.), ESCALATE — never silently lower. Size the review to the tier, but never below a floor of lens-distinct, fresh-context reviewers driving the REAL diff and live code: correctness/determinism, spec-conformance, and the core invariant (security, false-positive rate, data integrity — whatever the moat is). Reviewers report in coverage mode: every finding, including ones they are uncertain about or consider low-severity, each tagged with confidence and severity. They must not self-filter for importance — live reproduction downstream is the filter, and a surfaced finding that gets filtered beats a silently dropped defect. Run the project's full verification gate first in a clean, isolated run and hand the results to reviewers so none re-derive checkable facts. Hunt hardest at the new public boundaries under hostile or malformed input — the hostile-input battery itself stays a script. Charge each reviewer in isolation — their lens only, never the cadence.

[Model & effort policy — operational; resolve it BEFORE launching the fan-out, in one pass:
• Tiers: all seal-deciding reviewers and the integrator → most capable model, effort high; the core-invariant lens on a high-stakes chunk → xhigh. Single-finding refuters → one frontier tier down, effort high.
• SET each spawned agent's model explicitly per this policy — never silently inherit the session default.
• Effort: set per-agent where your harness allows it. Where effort is session-level only and a role requires more than the current setting, PAUSE NOW and queue the operator with the exact switch needed; resume only on their confirmation. Above policy = cost note; a decisive role below policy is forbidden.
• The integrator runs in your own session: if the session model is below the integrator's tier, queue that switch before integrating.
• If a reviewer's run is declined by a safety classifier (a refusal, not an error), re-spawn that lens once on the fallback tier and record it on the Policy line — a lens silently lost to a refusal is a coverage hole, not an acceptable outcome.
• Mechanics: scripts. Run the fan-out parallel/async where the environment permits; keep working while reviewers run, and intervene if one goes off track or is missing context it needs. Record the outcome on the Policy line of the cadence status.]

Integrate as the single integrator, triaging by severity and confidence: reproduce every sustained high- and medium-severity finding live — failing against the built code, then passing after the fix — before it lands; batch and spot-reproduce lows. Each fix re-enters a fresh review of its class (a purely mechanical fix may take a proportionate reduced re-review — record the calibration). Reject any fix that pulls in deferred work, gold-plates, or perturbs a frozen surface. If a structured result is lost to a tool or transport failure, integrate the completed parts by hand and re-run every load-bearing claim live. Before reporting, audit each claim against a tool result from this session; report only work you can point to evidence for — if something is not yet verified, say so explicitly. Seal only when the gate is green, zero high-severity findings are open, and the reviewers' evidence supports it; then do the bookkeeping (status, log, derived snapshots, the defect-class ledger, the next handoff). If you cannot seal, say so plainly with the blocking findings. Close with:

━━ CADENCE STATUS ━━
Done:  ② seal-gating review → [SEALED | BLOCKED]
Tier:  [high-stakes | incremental]  (escalated? y/n)
Policy: [applied | ⚠ awaiting operator switch: <model/effort + role>]
▶ NEXT: [high-stakes] paste ③ the post-seal deep audit · [incremental] ③ not warranted — proceed to ① for the next chunk.
