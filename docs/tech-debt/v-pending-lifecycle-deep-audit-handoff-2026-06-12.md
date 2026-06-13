# (V) ③ POST-SEAL DEEP AUDIT — HANDOFF (2026-06-12)

▎ Self-contained handoff for a FRESH session. Read end-to-end before touching anything.
▎ The (V) chunk (register P5 + P8(a,c,e,f) + P8(g): the pending-row write-ahead lifecycle +
▎ the terminalization-evidence invariant) is BUILT, its gate is GREEN, and ② is **SEALED**
▎ (2026-06-12, `.audit/v-seal/SEAL.md`). Your session runs ③ — the post-seal deep audit of
▎ the INTEGRATED WHOLE. Tier: **HIGH-STAKES** (confirmed at ① and re-confirmed at ② — all
▎ five charter triggers fire; the ② cadence status line reads "Tier: high-stakes,
▎ escalated? n"). ③ is therefore warranted; say so in one line and run.

## 0. Ground state (verify before anything)

- Repo `/Users/lex/settlegrid`, branch `main`. HEAD = `6465402c` ((V) handoff doc commit)
  atop `adb1e849` ((U) close) atop `f7a15925`; origin/main = `a016685a` (DEPLOYED + LIVE —
  real USDC on Base mainnet rides this code).
- **The ③ object = HEAD `6465402c` + the ②-SEALED UNCOMMITTED working tree** (the prompt's
  "committed tree" reads as this sealed state — the (U)-③ precedent exactly:
  `.audit/u-deep/VERDICT.md` ran the same way; the (V) LOCAL commit happens at close, AFTER
  ③, founder-gated, path-scoped). Verify at phase start: `git status` shows EXACTLY 10
  modified files (`git diff --numstat` = ledger.ts · circle-nano/settle-engine.ts ·
  circle-nano/settle.ts · x402/orchestrate.ts · reconcile.ts + the 5 licensed test files
  under `apps/web/src/lib/settlement/`) and 4 untracked docs
  (`docs/tech-debt/v-pending-lifecycle-{handoff… is COMMITTED; the untracked four are:
  trace,build-plan,seal-handoff,deep-audit-handoff}-2026-06-1*.md`). Anchor byte-stability
  vs the seal: `git diff` must equal `.audit/v-seal/built-diff-final.txt` (md5-compare).
- Do NOT commit, push, deploy, set env, or touch the DB (read-only). zsh: QUOTE bracketed
  paths. `.audit/` is gitignored by repo convention (artifacts persist on disk only).
- ⚠ register-P7 isolation flakes (`hop-rail-guard.test.ts`, `gas-wallet-monitor.test.ts`):
  gate on the FULL vitest suite only; never run those two in isolation and report flakes.
  The SETTLEMENT suites run fine in isolation. Do NOT upgrade vitest (2.1.9) mid-chunk.
- ⚠ Do NOT re-run `.audit/v-prebuild/probes/probes.mjs` as a gate — it describes the
  PRISTINE pre-build tree.
- ⚠ One ①-audit round once lost ALL agents to a weekly usage limit — the hardened workflow
  tail (degraded-run guard, refuter/critic death = fail-safe SUSTAINED, synthesizer-death
  inline fallback) exists for exactly this; reuse it VERBATIM and never let a silently-dead
  lens count as coverage.

## 1. READ FIRST, in order

1. `.audit/v-seal/SEAL.md` — the ② verdict: the bar discharged clause-by-clause, the panel
   record (`wf_0d2e5c67-319`, 42 findings → 38 refuted / 4 sustained), the FIVE seal fixes
   with live red→green evidence, the refuted-HIGH dispositions, and the **③ attention
   items** (§ below). CANONICAL over anything that contradicts it.
2. `docs/tech-debt/v-pending-lifecycle-seal-handoff-2026-06-12.md` — the ② handoff WITH its
   ② OUTCOME block (top). Its §2 built-summary + §6 gate figures describe the ②-ENTRY tree;
   the OUTCOME block + SEAL.md supersede (the sealed tree adds the F-1 finite guard, the S1
   truth CAS, the S2 regex guard, S3 counter gating, S4 post-commit emit).
3. `docs/tech-debt/v-pending-lifecycle-handoff-2026-06-11.md` — the chunk charter (§1 SCOPE
   + THE BAR + REJECTED merges; §2 tier + LB-1/LB-2/LB-3; §3 frozen surfaces; §4 the ARC).
4. `docs/tech-debt/v-pending-lifecycle-trace-2026-06-11.md` — censuses (6-site
   markSettlementBroadcast, interpretReceipt consumers, null-ref row classes), the LB-1
   proof walk, the LB-2 matrix. Where trace and plan disagree, the PLAN is canonical.
5. `docs/tech-debt/v-pending-lifecycle-build-plan-2026-06-11.md` — audited recipes
   (PLAN_READY at R5), the §DELIBERATE register (11 decisions), behavior pins incl. the
   BUYER-DELTA CENSUS (seven licensed deltas — an eighth = a finding).
6. `.audit/v-build/BUILD-STATUS.md` + `.audit/v-prebuild/R5-VERDICT.md` — build evidence
   trail (43 prefix reds) + the 5-round pre-build audit record (blockers B1–B8).
7. `.audit/defect-ledger/INDEX.md` + the class files — charge the recurrence lenses (§4).
8. Templates to ADAPT (do not reuse blindly): **`.audit/u-deep/`** — the (U) ③ shape:
   `deep-audit.mjs` (panel source), `integrated-invariants.mjs` (the 12-probe mechanical
   pre-flight — extend it with (V)-integrated invariants), `VERDICT.md` (the verdict +
   close-work-list format), `preflight-gate.txt`. Plus `.audit/v-seal/hostile-battery.mjs`
   + `v-seal-battery-{engine,reconcile}.test.ts` (re-runnable on the sealed tree — 38/38)
   and `.audit/v-seal/seal-review.mjs` (the ② panel + hardened tail to adapt).
   Produce your artifacts in **`.audit/v-deep/`**; the verdict file is `VERDICT.md`.

## 2. What is being certified (re-derive against the diff, don't trust this summary)

The sealed (V) state = the build (per the ② handoff §2: the no-clobber broadcast CAS with
required `expectedPriorRef`; `markSettlementExpiredNoBroadcast` with TWO CAS conjuncts +
same-statement evidence; RAISE-only `refreshPendingValidBefore`; P8(g)
`broadcast-unconfirmed/'revert-nonce-unverifiable'`; the two bounded readers on the (U)
transport; both orchestrators' P5-i canonical validBefore + awaited refresh with
terminal-abort, P8-a pre-submit re-read, P8-e 6-site wiring, P8-f winning hash, the 3e F2
fold; the reconcile.ts EXPIRY PASS at detectors→pass→window with the
1/2/2.5/3/3.5/4 predicate, four quarantine classes, LIMIT 3 / 14s; P8-c; the C4 rider)
**PLUS the five ② seal fixes** (SEAL.md §"Seal fixes" — F-1 finite-positive guard in
`readSafeBlockTimestampBounded`; S1 quarantine truth CAS — `isNull(externalRef)` +
`.returning` rowcount gating `expiry_unprovable`, the consumed-arm alert, and
`stats.quarantined++`; S2 regex guard on the refresh's stored-value `::numeric` cast;
S3 counter gating; S4 `credit_tool_stat_unmatched` hoisted post-commit).

THE BAR (charter §1, verbatim — what stands sealed): "No pending settlement row is
immortal-by-construction: a never-broadcast authorization terminalizes once provably
expired AND nonce-unconsumed on-chain, and quarantine-classifies otherwise; NO actor —
live path, reconciler, or the new expiry pass — terminalizes on incomplete evidence (a
failed nonce-recheck or a failed expiry-proof read always degrades to a pending-side
state); a known-good ref is never clobbered; the live resubmit re-checks terminality
pre-submit; every surviving race remains DETECTED; the (U) detectors-first guarantee and
the live submit/receipt transport are byte-identical."

## 3. ③ scope — what a diff-scoped ② structurally COULD NOT see (target these)

Cross-chunk integration seams of the INTEGRATED WHOLE (suggested lens territory; size the
panel ≥ the ② floor — lens-distinct, fresh-context, coverage mode):
- **(V)↔(T)**: the new ledger writers vs the (T) CAS family — can any sequence of
  {markSettlementBroadcast, markSettlementExpiredNoBroadcast, markSettlementFailed,
  markSettlementSettled, refreshPendingValidBefore, creditSettlement} interleave across
  actors (live both rails, reconciler, expiry pass, sweep) into a lost/double credit or an
  evidence-inconsistent terminal row? The credited_at marker + uncredited sweep vs
  expiry-terminalized rows (failed ⇒ never credited ⇒ never in the sweep — verify).
- **(V)↔(U)**: shared `reconcilerPublicClientFor` budget arithmetic END-TO-END (detectors +
  pass worst ~20.15s + window loop + in-flight tail vs maxDuration 60s); detectors-first
  under every pass failure shape; the carrier/overdue semantics with quarantined rows
  standing in the count.
- **(V)↔(S)**: the shared `last_reconciled_at` watermark — rotation fairness across the TWO
  disjoint consumers (window isNotNull vs pass isNull) over multi-run schedules; quarantine
  class exclusion vs LIMIT-3 drain arithmetic (288/day claim).
- **(V)↔(H)/rails**: hop rows and non-reconcilable rails can never enter the pass.
- **(V)↔routes**: kernel route + both proxy surfaces consuming the seven buyer deltas;
  `X-SettleGrid-Tx-Hash` with the P8-f winner hash; the cron route's summary identity.
- **(V)↔verifiers/contract (DC-04)**: canonicalization end-to-end (circle-nano BigInt
  verifier accepts hex; P5-i normalizes; the pass's `^\d+$`; the SQL regex guard; the
  vendored EIP3009_ABI + `onchain-constants.test.ts` pins; viem 2.47.4 in node_modules —
  verify installed, never recall).
- **Lifecycle walks**: every null-ref row class (trace a.5) born → aged → pass disposition
  → operator visibility → runbook resolution, as an integrated story, including multi-run
  idempotency (DC-17) and crash-at-every-await schedules.
- **The ② attention items (SEAL.md, recorded for ③)**: (i) nonce-read block-pinning (pin
  `readAuthorizationStateBounded` to the anchor block number would make the conjunction
  view-consistency-free — judge whether the residual cross-view trust is acceptable or
  worth a register item/fix); (ii) a reject-class breadcrumb for CAS-rejected
  applyOutcome broadcast writes (pre-existing posture — judge); (iii) a wall-clock
  plausibility bound on chainTs (absurd-future garbage — judge). These were REFUTED as ②
  highs on settled-scope/wrong-value-trust grounds; ③ owns the integrated-risk judgment.
- **Defect-class ledger recurrences**: charge DC-01 · DC-02 · DC-04 · DC-05 (incl. the NEW
  Once-queue face: vi.clearAllMocks does NOT clear mockResolvedValueOnce queues — the (V)
  orchestrator describes hard-reset locally; fold the ledger entry at close) · DC-06 ·
  DC-08 · DC-09 BOTH directions · DC-13 · DC-15 (plan↔built↔sealed drift — the seal fixes
  changed shapes the ① docs describe; supersession breadcrumbs land at close) · DC-17 ·
  DC-18.

**Mechanical pre-flight (scripted, BEFORE the fan-out; hand results to reviewers):** the
full gate in a clean run (expect: tsc 0 · FULL vitest **4428 / 191 / 0** · build 0 ·
eslint changed files 0 · numstat = the 10 files · packages 0 · pinned suites zero-diff +
green) · re-run `.audit/v-seal/hostile-battery.mjs` (expect 38/38) · extend
`.audit/u-deep/integrated-invariants.mjs` with (V) invariants (the 6-site census, the CAS
conjuncts, the predicate order, detectors→pass→window, summary identity, alert keys/levels
vs the logger's Sentry gate, the canonical-network gate, watermark disjointness) · a
hostile battery over the INTEGRATED boundaries you choose to attack.

## 4. Frozen / byte-stable spine (unchanged from ②; reject any "fix" that perturbs it)

The (U) reconciler transport (`RECONCILER_RPC_*`, `reconcilerPublicClientFor`,
`confirmSettlementTx` behavior) + detectors-first ordering + both detector blocks/payloads
+ the error-level `overdue_examined` carrier; `publicClientFor` + wallet client +
`RECEIPT_TIMEOUT_MS` + submit guards; `markSettlementSettled`/`markSettlementFailed`
byte-identical; `creditSettlement` except the C4 lines (now incl. the S4 hoist);
the credited_at marker; the sweep WHERE/alert semantics; the (S) rotation (window
WHERE/ORDER, mark-before-examine, watermark, budget/deferred); the cron route;
`RECONCILABLE_RAILS`; payouts/pricing; `packages/` (numstat empty); migrations NONE;
summary shape/identity. The THREE PINNED un-edited suites — `reconcile-starvation.test.ts`
+ `transport-isolation.test.ts` + `reconcile-detector-availability.test.ts` — ZERO diff,
stay green. REJECTED merges stay out: P9 credit-finality (FOUNDER gate) · B1.1 · P6 ops ·
P7 beyond the shipped riders · P8(b) machinery · ANY reconciler-transport change
((U)-sealed) · migrations · pushes/deploys.

## 5. Model & effort policy → THIS harness (resolve before fan-out; record on the Policy line)

- Every reasoning role = **fable** (the harness's most capable tier; the session model IS
  fable — verify, no operator switch needed; the integrator must meet its tier in-session).
- The collective-miss critic calls for **xhigh**: NO per-agent effort knob exists in this
  harness — set `model: 'fable'` and RECORD the xhigh intent + the knob's absence on the
  Policy line (the (T)/(U)/(V)-① and (V)-② precedent; model tier is the applied control).
- Single-finding refuters/critics one tier down = **opus**, default-refuted; a refuter
  death fail-safes to SUSTAINED. Reuse the hardened tail VERBATIM from
  `.audit/v-seal/seal-review.mjs` (or `.audit/u-deep/deep-audit.mjs` for the ③ shape).
- A reviewer lost to a safety-classifier REFUSAL (not an error): re-spawn that lens once on
  the fallback tier and record it — a silently lost lens is a coverage hole.
- Mechanics = scripts. Reviewers fresh-context, isolated, READ-ONLY, lens-only (never the
  cadence).

## 6. Conduct (binding — the chunk charter wording)

Ground EVERY progress claim in a tool result from your session; act once you have enough
information; NEVER stop or suggest a new session on account of context limits — the
harness manages context. Single integrator in-session; reproduce every sustained
high/medium finding live (fail-against-shipped → pass-after-fix) before it lands;
batch/spot-reproduce lows; every fix re-enters a risk-proportionate re-review (record the
calibration). Reject fixes that pull in deferred work, gold-plate, or perturb §4. End with
`VERDICT.md` in `.audit/v-deep/` carrying: the verdict (SEAL STANDS | RE-CERTIFIED), the
pre-flight + panel + collective-miss records, every disposition, ledger updates (incl. the
Once-queue DC-05 face if you fold it early), and the **③ CLOSE WORK-LIST** for the close
session (the (U) pattern): founder-gated path-scoped LOCAL commit + capstone + register
P5/P8/P8(g) close + runbook updates [the four quarantine classes + the actionable-overdue
posture + the `unknown===examined` anchor-degradation cue] + the founder safe-tag curl
[`eth_getBlockByNumber("safe", false)` against the prod RPC] + the prod null-ref inventory
query (trace §g) + defect-ledger folding + doc supersession breadcrumbs (the seal fixes
changed shapes the ① docs describe) + memory. After ③: the close happens in a later
founder-gated session; ▶ NEXT after a standing/re-certified seal = paste ① for the next
chunk (queue: B1.1 → P6 ops → P7 hygiene → (G) tidies; P9 = founder decision).

## 7. THE POST-SEAL DEEP AUDIT PROMPT (verbatim — this is your mission statement)

This chunk is sealed. It reaches this phase only if the seal-gating review flagged it
HIGH-STAKES — confirm that in one line; if it's incremental, stop and say this phase isn't
warranted. If it runs, certify the SHIPPED result at the highest confidence merited —
air-tight, to-spec, technically and factually accurate — without over-auditing or
hallucinating regressive fixes. Scope is the INTEGRATED WHOLE on the committed tree,
distinct from the seal-gating review's diff scope; do not just re-run those lenses.

Target what a diff-scoped review structurally COULD NOT: latent defects in the integrated
whole, cross-chunk integration seams, and recurrences of every class in the project's
defect-class ledger. Run a mechanical pre-flight first — the full verification gate in a
clean run, a re-derivation of every claimed invariant, a hostile-input battery over every
public boundary, all scripted — and hand its results to the reviewers so none re-derive
checkable facts. Reviewers try to break the shipped code and report in coverage mode:
every finding, tagged with confidence and severity, no self-filtering — the
live-reproduction step and the critic pass are the filters. Then run a final
collective-miss pass: what did the reviewers, taken together, fail to look at? Any
proposed fix is reproduced live (failing against the shipped code, then passing) before it
lands, and must not pull in deferred work or perturb a frozen surface. Charge the
reviewers in isolation — their lens only, never the cadence. If a structured result is
lost to a tool or transport failure, integrate the completed parts by hand and re-run
every load-bearing claim live.

[Model & effort policy — operational; resolve it BEFORE launching the phase, in one pass:
• Tiers: every reasoning role here → most capable model, effort high; the collective-miss
critic → xhigh.
• SET each spawned agent's model explicitly per this policy — never silently inherit the
session default.
• Effort: set per-agent where your harness allows it. Where effort is session-level only
and a role requires more than the current setting, PAUSE NOW and queue the operator with
the exact switch needed; resume only on their confirmation. Above policy = cost note; a
role below policy is forbidden in this phase.
• If the session model running this phase is below the policy tier, queue that switch
before starting.
• If a reviewer's run is declined by a safety classifier (a refusal, not an error),
re-spawn that lens once on the fallback tier and record it on the Policy line — a lens
silently lost to a refusal is a coverage hole, not an acceptable outcome.
• Mechanics: scripts. Run the fan-out parallel/async where the environment permits; keep
working while reviewers run, and intervene if one goes off track or is missing context it
needs. Record the outcome on the Policy line of the cadence status.]

You are operating autonomously through this phase. Execute to 100%: do not end the turn on
a plan, a question, or a statement of intent — if your last paragraph promises work, do
that work now. Close every sustained finding fix-first under a risk-proportionate
re-review; update the defect-class ledger with any new class; render a clear verdict —
stands as-is, or hardened-and-re-certified — with the evidence. Close with:

━━ CADENCE STATUS ━━
Done:  ③ post-seal deep audit → [SEAL STANDS | RE-CERTIFIED]
Policy: [applied | ⚠ awaiting operator switch: <model/effort + role>]
▶ NEXT: paste ① for the next chunk.
