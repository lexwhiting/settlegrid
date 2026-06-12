# (U) ② SEAL-GATING REVIEW — HANDOFF (2026-06-11)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> The (U) chunk (③-register P4: reconciler transport timeout + detector availability) is BUILT
> and its executable gate is GREEN. Your session runs ② — the independent, hostile,
> fresh-context review that DECIDES the seal. HIGH-STAKES → ③ (post-seal deep audit) follows in
> a later session; that must not reduce ②'s rigor.

## 0. Ground state (verify before anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `f7a15925`** (doc-only handoff commit)
  atop **origin/main = `a016685a`** (the (G)+(S)+(S③)+(T) stack, DEPLOYED + LIVE — real USDC on
  Base mainnet rides this code; first cron on the real DB: `uncredited: 0`).
- **The (U) chunk is UNCOMMITTED working-tree state** — the LOCAL commit happens at close, AFTER
  ②/③ (founder-gated, path-scoped). Do not commit, push, deploy, set env, or touch the DB
  (read-only). zsh: QUOTE bracketed paths.
- The built diff: `git diff` (4 modified tracked files) + 2 NEW untracked test files. Modified:
  `apps/web/src/lib/settlement/circle-nano/settle-engine.ts` ·
  `apps/web/src/lib/settlement/reconcile.ts` ·
  `apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts` ·
  `apps/web/src/lib/settlement/__tests__/reconcile.test.ts`. New:
  `apps/web/src/lib/settlement/circle-nano/__tests__/transport-isolation.test.ts` ·
  `apps/web/src/lib/settlement/__tests__/reconcile-detector-availability.test.ts`. Docs
  (untracked): `docs/tech-debt/p4-transport-{trace,build-plan}-2026-06-11.md` + this file.
  `.audit/` is gitignored by repo convention (artifacts persist on disk only).
- ⚠ register-P7 isolation flakes (`hop-rail-guard`, `gas-wallet-monitor`) — gate on the FULL
  vitest suite only; isolated runs are unreliable. Do NOT upgrade vitest (2.1.9) mid-chunk.
- ⚠ `.audit/u-prebuild/probes/probes.mjs` is a PRE-BUILD snapshot — do NOT re-run it as a
  post-build gate (its P1/P5/P6 censuses describe the pristine tree).

## 1. READ FIRST, in order
1. `docs/tech-debt/p4-reconciler-transport-handoff-2026-06-11.md` — the chunk charter: §1 SCOPE
   + the bar + REJECTED merges; §2 tier + LB-1/LB-2; §3 frozen surfaces; §4 the ARC.
2. `docs/tech-debt/p4-transport-trace-2026-06-11.md` — census, timeout arithmetic (41.05s→6.15s
   per call), the LB-2 verdict table (§b), the (b-i)-not-(b-ii) decision (§c).
3. `docs/tech-debt/p4-transport-build-plan-2026-06-11.md` — the audited recipes (R1/R2 markers
   inline), gates, behavior pins, the SIX deliberate decisions (§DELIBERATE).
4. `.audit/u-build/BUILD-STATUS.md` — what shipped + the full evidence trail.
5. `.audit/u-prebuild/R2-VERDICT.md` — the pre-build audit record (R1 `wf_743c7d47`
   PLAN_NEEDS_FIXES → fixes → R2 `wf_480cd4a7` PLAN_READY).
6. Templates to ADAPT (do not reuse blindly): `.audit/t-seal/seal-review.mjs` (the (T) ② panel
   workflow — hardened tail + refuter pattern) and `.audit/t-seal/hostile-battery.mjs` (the
   script-resident hostile-input battery) → write yours to `.audit/u-seal/`. The (T) ② also
   produced `SEAL.md` — yours should too.

## 2. What was built (the three changes — re-derive against the diff, don't trust this summary)
1. **(a) Bounded reconciler transport** — `settle-engine.ts`: exported
   `RECONCILER_RPC_TIMEOUT_MS = 3_000` / `RECONCILER_RPC_RETRY_COUNT = 1`; additive private
   `reconcilerPublicClientFor`; `confirmSettlementTx` (reconciler-ONLY entry point; sole prod
   caller `reconcile.ts` `reconcileOneRow`) swapped onto it. Worst 6.15s/call · 12.3s/row vs the
   20s tail (runBudget 40s, route maxDuration 60s). `publicClientFor` body, wallet client,
   `interpretReceipt`, `RECEIPT_TIMEOUT_MS` BYTE-IDENTICAL.
2. **(b-i) Detectors-first run order** — `reconcile.ts` `reconcilePendingSettlements`: the
   uncredited sweep (P1 silent-loss detector, now FIRST) + the overdue aggregate moved BEFORE
   the window SELECT and examination loop (emission happens-before every RPC call); the
   `pending_overdue` alert payload DROPS `examinedThisRun`; `overdue_check_failed` payload is
   `{}`; NEW post-loop `logger.warn('reconcile.overdue_examined', …)` carrier (fires only when a
   nonzero examined-overdue class exists); summary shape/identity unchanged; loop/rotation/
   budget machinery byte-identical (moved-not-changed).
3. **LB-2 funds-trap fix** — `confirmSettlementTx`'s reverted-branch nonce-read catch returns
   `{ kind: 'unconfirmed', txHash, reason: 'revert-nonce-unverifiable' }` (pre-(U): defaulted
   `nonceConsumed:false` → clean `reverted` → the reconciler CAS-flipped `failed` on INCOMPLETE
   evidence — the (T) CAS can't protect, the ref matches). The optional `reason` field is
   additive (the :receipt-unavailable return keeps its exact old shape); `reconcileOneRow`'s
   unconfirmed log passes it through. The live-path `interpretReceipt` default-false is
   UNTOUCHED (sealed — different evidential context, consumed by the sealed orchestrator
   mapping).

## 3. The bar (charter §1, verbatim)
*"No single RPC call can prevent the reconcile run's detectors (`reconcile.pending_overdue`,
`reconcile.uncredited_settled`) from emitting; the reconciler's confirm path degrades to
'unconfirmed' (safe-direction) on timeout; the live settle path's transport and ALL funds
semantics are byte-identical."*

## 4. Tier + the load-bearing hazards
- **Tier: HIGH-STAKES, inherited** (opens frozen `settle-engine.ts`, shared with the LIVE settle
  path; reorders the (S③)-sealed run structure — both LICENSED by the charter). RE-CONFIRM
  against the realized diff per the review prompt; the build-session view: realized diff ==
  plan's file set exactly, no unlicensed frozen-surface touch (fresh-context drift check came
  back CLEAN) — but that is OUR claim; re-derive it.
- **LB-1**: any observable live-path transport/behavior delta is a live-money defect. x402 AND
  circle-nano both ride the engine in-request. Pinned by `transport-isolation.test.ts`.
- **LB-2**: any timeout/error shape that still reaches a terminal verdict on incomplete
  evidence — or the INVERSE, a legitimately-failed row made unterminalizable (immortal-pending,
  DC-09). The trace §b table enumerates every evidence state → verdict.
- **Hostile-input note**: this chunk opens NO new HTTP/public boundary. The "new public
  boundaries" are (i) the engine's error-shape surface under degraded/malformed RPC responses
  (timeouts, 5xx, malformed receipts, throw-of-any-shape in the nonce read) and (ii) the
  reordered run's behavior under aggregate/window/DB failures. The hostile battery stays a
  SCRIPT (adapt `.audit/t-seal/hostile-battery.mjs` → drive the REAL `confirmSettlementTx` via
  mocked-client error shapes, and the REAL `reconcilePendingSettlements` via failing harness
  stages; the existing hanging-server probe `.audit/u-build/probe-timeout-arithmetic.mjs` is the
  live-transport half).

## 5. Frozen / byte-stable spine (zero behavioral delta; reject any "fix" that perturbs it)
All flips + CAS (`ledger.ts`), `creditSettlement` + credited_at marker, the sweep's WHERE/alert
SEMANTICS (only position + the classification carrier changed), both orchestrators
(`x402/orchestrate.ts`, `circle-nano/settle.ts`), `interpretReceipt` (incl. its own
default-false), `submitCircleNanoOnChain`/`confirmCircleNanoTx`, `RECEIPT_TIMEOUT_MS`, the F2
pin, `RECONCILABLE_RAILS`/`rails.ts`, the (S) rotation (COALESCE ordering, mark-before-examine,
watermark, budget/deferred), the cron route, `env.ts`, payouts/pricing, `packages/` (numstat
must stay empty), migrations. The two PINNED un-edited suites: `reconcile-starvation.test.ts` +
`terminal-transition.test.ts` — ZERO diff lines, must stay green.

## 6. Clean-gate evidence from the build session (re-run the gate fresh yourself; hand results
to reviewers so none re-derive checkable facts)
tsc **0** · FULL vitest **4366 pass / 191 files / 0 fail** (baseline 4357/189 + 9 new tests / 2
new files — the plan's exact N) · next build **0** · eslint changed files **0** · numstat = the
4 licensed files only · packages diff **0**. Captures: `.audit/u-build/`
`prefix-fail-batch1-six-reds.txt` (SIX fail-pre-fix reds, each AT its assert: R3 LB-2 flip, 4.3
options pin, 4.4 seam, 6.1/6.2/6.3 order pins) · `postfix-green.txt` (81 tests / 6 suites) ·
`probe-timeout-arithmetic.txt` (bounded 6,163ms vs 6,150ms arithmetic; default 41,063ms vs
41,050ms — PASS).

## 7. The SIX deliberate decisions (plan §DELIBERATE — scrutinize on the merits, flagged not hidden)
(1) (b-i) aggregates-first chosen, (b-ii) per-row deadline REJECTED (trace §c arithmetic);
(2) sweep-FIRST within the pre-loop block; (3) the `reconcile.overdue_examined` WARN carrier for
the displaced (S) item-4 classification (+ `overdue_check_failed` payload `{}` — the S11
successor); (4) pre-run "standing incidents" aggregate semantics (sweep result-set invariance
argument, trace §c.2); (5) the optional `unconfirmed.reason` field; (6) 3_000ms/1-retry as the
operating point (too-tight ⇒ healthy-slow RPC reads unconfirmed every run ⇒ overdue-alert noise;
the detectors emit either way — judge the operating point, not the guarantee).

## 8. Recurrence lenses (charge from `.audit/defect-ledger/INDEX.md`)
DC-08 (fail-mode direction — the headline) · DC-13 (latent until RPC degrades — test as latent)
· DC-18 (detector/telemetry truthfulness under the new ordering) · DC-04 (transport options vs
installed viem 2.47.4 — verified in node_modules, never recalled) · DC-07 (timeout constants
single-source; the TTL lesson — enumerate ALL transitive callers) · DC-05 (test-double surface
divergence) · DC-15 (plan↔built drift) · DC-09 (no new immortal-row class) · DC-01 (the sweep's
availability IS the P1 detector).

## 9. Model & effort policy → THIS harness (resolve before fan-out; record on the Policy line)
- Seal-deciding reviewers + integrator = **fable** (the harness's most capable tier).
- The core-invariant lens (funds-safety/failure-direction) on this HIGH-STAKES chunk calls for
  xhigh effort: **no per-agent effort knob exists in this harness** — set `model: 'fable'` and
  record the absence on the Policy line (the (T)/(U) precedent). No operator switch is needed:
  the session model IS fable, so the in-session integrator already meets its tier.
- Single-finding refuters = **opus** (one frontier tier down), default-refuted; a refuter death
  fail-safes to SUSTAINED (the `.audit/u-prebuild/prebuild-audit.mjs` tail implements all of
  this — reuse its hardened tail VERBATIM).
- Mechanics = scripts. Reviewers fresh-context, isolated, READ-ONLY, lens-only (never the
  cadence). If a reviewer is lost to a safety-classifier refusal (not an error), re-spawn once
  on the fallback tier and record it — a silently lost lens is a coverage hole.

## 10. Conduct (binding — the chunk charter wording)
Ground EVERY progress claim in a tool result from your session; act once you have enough
information; NEVER stop or suggest a new session on account of context limits — the harness
manages context. Single integrator in-session; reproduce every sustained high/medium finding
live (fail-against-built → pass-after-fix) before it lands; batch/spot-reproduce lows; every fix
re-enters a fresh review of its class (mechanical fixes may take a proportionate reduced
re-review — record the calibration). Reject fixes that pull in deferred work (P5+P8, B1.1, P6,
P7), gold-plate, or perturb §5. End with `SEAL.md` in `.audit/u-seal/` + the bookkeeping the
prompt lists. After ②: if SEALED, the next session runs ③ (post-seal deep audit — HIGH-STAKES);
the close (founder-gated path-scoped LOCAL commit + capstone + register-P4 close + defect-ledger
+ memory) happens after ③.

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

---

## ② OUTCOME (appended 2026-06-11, end of the ② session) — **SEALED**

- Verdict: **SEALED** — `.audit/u-seal/SEAL.md` is the authoritative record. Panel
  `wf_4f571d2b-780`: 5 fable lenses, 30 findings, **0 high**; 24/30 opus refuters died on a
  weekly usage limit → fail-safe SUSTAINED → hand-integrated by the in-session integrator with
  live evidence (no finding dropped).
- **⚠ SUPERSEDES §2.2 + §7(3) of this handoff:** the `reconcile.overdue_examined` carrier is
  **ERROR level**, not warn — a ② seal fix (M1, 4 lenses converged): logger.ts mirrors ONLY
  error-level into Sentry, so the warn carrier silently dropped the (S) item-4 sticky-class
  breakdown from the Sentry surface. Not a new page (the armed rule's two message filters don't
  match it). The same supersession applies to the plan §DELIBERATE #3 / Recipe 2c and trace
  §c.2 wording ("warn") — those stay as ① historical records.
- Other seal fixes (all licensed-file, frozen spine untouched): M2 — detector-availability now
  pins ALERT EMISSION order (proven red against an emission-hoist mutant, `m2-mutant-red.txt`);
  L13 — durable `reconcile.unconfirmed` reason pins; L14 — transport-isolation client-config
  key-set pins (+ the fix-class re-review caught and fixed an 8-error tsc break in L14's first
  version — `vi.fn` zero-arg Parameters inference).
- Final gate: tsc 0 · vitest **4368 / 191 / 0 fail** (②-entry 4366 + 2 seal-fix tests) ·
  build 0 · eslint 0 · numstat = the 4 licensed files · packages 0 · pinned suites zero-diff ·
  battery 19/19.
- **▶ NEXT session runs ③ (post-seal deep audit — HIGH-STAKES).** Enter via this handoff +
  `.audit/u-seal/SEAL.md`; the ③-relevant register notes from ② (close-time items): sweep
  sample-fail self-suppression (pre-existing, (T)-sealed block), hung-detector-query residual
  (P6), garbage-receipt-status hardening candidate, DC-15 supersession breadcrumbs for the
  (S)/b1.4 docs in the close capstone, modulo-dispatch → P7. The close (founder-gated
  path-scoped LOCAL commit + capstone + register-P4 close + defect-ledger + memory) happens
  AFTER ③.

---

## ③ OUTCOME (appended 2026-06-11, end of the ③ session) — **SEAL STANDS**

- **Verdict: SEAL STANDS** — `.audit/u-deep/VERDICT.md` is the authoritative record (panel
  `wf_412782ff-0d7`: 5 integrated-whole lenses + xhigh-intent collective-miss critic, 0 dead;
  24 findings → 18 distinct after dedup → 1 high, 5 med, 12 low — ZERO defects in the sealed
  (U) behavior; everything lands on pre-existing frozen surfaces, off-repo surfaces, or docs).
- **The headline (HIGH, register-routed): P8(g) live-engine LB-2 twin** — interpretReceipt's
  reverted-branch nonce-recheck catch still defaults `nonceConsumed:false` and BOTH live
  orchestrators terminalize 'failed' on it (settle.ts:169 / orchestrate.ts:216) — the same
  incomplete-evidence state (U) ruled non-terminal on the reconciler side; with the registered
  P8(b) untracked-hash window the loss is SILENT. Verified link-by-link this session. Fix shape
  recorded in VERDICT.md (one-branch broadcast-unconfirmed mapping, next engine chunk).
- ③ tree deltas: documentation-grade ONLY — the F8/F9 comment caveats (viem Retry-After
  override + headers-only timeout: the 6.15s figure is the timer-bound, not adversarial, shape;
  detectors structurally safe either way) in settle-engine.ts + reconcile.ts, and the
  defect-ledger F20 key correction. Post-edit: tsc 0 · eslint 0 · battery 19/19 · invariants
  12/12 · six settlement suites 83/83; the ② full gate (4368/191/0 · build 0) remains valid.
- **▶ NEXT session: the CLOSE** (founder-gated path-scoped LOCAL commit + capstone +
  register-P4 close + defect-ledger evidence folding + memory). BINDING input: the
  **CLOSE WORK-LIST in `.audit/u-deep/VERDICT.md`** (register addenda incl. P8(g) + the NEW
  credit-finality item; operator-doc edits incl. overdue_examined + the b1.4 breadcrumb +
  the ~60-75-min sweep-latency wording; the founder-side live block: Sentry rules+quota,
  prod RPC env, optional EXPLAIN + latency probe).
