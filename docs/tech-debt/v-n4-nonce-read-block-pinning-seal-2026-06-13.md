# (V-N4) — reconciler expiry-pass nonce-read block-pinning — ② SEAL-GATING REVIEW — RESOLUTION (SEALED, 2026-06-13)

> **② of the ARC.** The chunk was built (① handoff: `v-n4-nonce-read-block-pinning-handoff-2026-06-13.md`),
> its executable gate was green, and this session ran the independent hostile seal-gating review that
> DECIDES the seal. **VERDICT: SEALED.** Tier holds **HIGH-STAKES** (re-confirmed against the realized
> diff; not escalated, not lowered). Founder-gated: NOT committed / pushed / deployed; DB read-only.
> Nothing is committed — HEAD is still `b3b1e175`; the sealed bytes live UNCOMMITTED in the working
> tree, fingerprinted below for founder-commit integrity.

## One-line verdict
SEALED. 5-file diff (2 prod readers/pass + 2 test files + 1 deploy-precondition doc); **5** lens-distinct
fresh-context opus reviewers — 3 @ xhigh (correctness/determinism · spec-conformance/scope ·
test-fidelity/detector) + **1 isolated core-invariant @ /effort max** + **1 collective-miss critic @ max** —
returned **0 high / 1 med (accepted) / 6 low (accepted)**, no money-loss path, no wrong-terminalize,
no missed caller, no vacuous fix-assertion, no spec drift. Non-vacuity proven LIVE (11 tests RED on
pre-fix source). Gate green on the final fingerprinted tree. **③ post-seal deep audit warranted (HIGH-STAKES).**

## Tier re-confirmation
**HIGH-STAKES, not escalated, not lowered.** Realized diff = exactly the predicted 5-file footprint.
Touches a correctness/money boundary (the reconciler terminalize decision on real-USDC Base-mainnet
rows), binds to on-chain ground truth (DC-04), alters a determinism guarantee (the whole point), edits
a (V)-③-certified surface (the bounded readers + `runExpiryPass`), changes a fail-mode (DC-08). It does
NOT touch a frozen surface, open a new untrusted-input boundary (RPC is the same trusted dep), or
require a migration. Spec-conformance + core-invariant reviewers independently re-confirmed no escalation
trigger fired in the build. (V-N5 / the held un-pinned reads correctly excluded — §8 clean.)

## Sealed bytes — fingerprint (`shasum`; tree verified STABLE A==B across the final gate)
```
3216deac01e887f03cdd5583e50c086c9899939d  apps/web/src/lib/settlement/circle-nano/settle-engine.ts
5356b2a945b42cf900dd70e774449e1a1ab95195  apps/web/src/lib/settlement/reconcile.ts
da95d57d0a59279a4f3944f23c747b55a5aa5f1a  apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts
c27ffbbe25e0f974b32af967ac08ec8407c06535  apps/web/src/lib/settlement/__tests__/reconcile.test.ts
4c2ba1f0ecd3676ec4cbf3329748dddddcbf2784  docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md
```
Baseline = HEAD `b3b1e175` + the disjoint sealed-but-uncommitted (W) hygiene tree (8 files; a file set
DISJOINT from V-N4's — confirmed). Diff: **177 insertions / 35 deletions** (se.ts 48 · rc.ts 35 ·
se.test 60 · rc.test 40 · a2 29). ⚠ Shared-working-tree hazard is LIVE (~15 concurrent `claude`
sessions): a sibling commit/checkout could sweep these uncommitted bytes — founder should commit from a
state whose shasums match the above.

## Executable gate (final tree, post-battery-deletion; `.audit/v-n4-seal/gate.log`)
- `tsc --noEmit` → **0**
- `eslint` (4 changed code files) → **0**
- `vitest run` → **191 files / 4440 passed / 0 fail** (baseline 4434 + 6 net-new V-N4 tests; **update
  the register's gate baseline 4434 → 4440**)
- `next build` → **success** (route table emitted)

## The panel
Fan-out via **Agent-tool spawns** (operator did NOT opt into a Workflow this turn — flagged as a prime
candidate; the parallel-lenses → adversarial-verify → integrate shape is exactly what Workflow is for).
All reviewers + integrator on **opus (claude-opus-4-8)**, pinned at spawn. Effort sequenced at its
boundaries (operator-set, whole-session): **xhigh** for the 3 seal-deciding reviewers → **/effort max**
for the isolated core-invariant pass → the collective-miss critic also ran **at max** (a deliberate
small cost overage rather than down-switching to the "high" refuter floor, to keep the final adversarial
pass at max and save an operator round-trip — ≥high floor honored). Integration ran in this session at
**max** (≥ the xhigh integrator floor — no down-switch needed). Coverage mode throughout; no reviewer
refused.
1. **R1 Correctness / determinism** (xhigh) — every `chainTs`→`.ts`/`.blockNumber` consumer; the
   threading; null-narrowing + per-network cache; reader totality + guard order; stall-detector firing
   logic; stats/deadline accounting.
2. **R2 Spec-conformance / frozen-surface / scope** (xhigh) — §5 steps 1-5, §7 frozen list, §8 held
   scope, §9's 7 tests, the `:587` comment fix, the a2 deploy-precondition, the env.ts drift flag.
3. **R3 Test-fidelity (DC-05) / detector-truthfulness (DC-18)** (xhigh) — non-vacuity (reproduced 11
   RED + verified each fails for the right reason), the untyped-mock false-green trap, the scalar
   evidence guard, 6 independent detector probes, the differential-lag proof.
4. **R4 CORE INVARIANT — money / data-integrity** (/effort max, isolated) — the §6 LB-1 exactness proof
   attacked link-by-link (USDC strict `<` gate, Base strict timestamp monotonicity, viem end-of-N
   snapshot, the cancel lemma, the cross-replica correct-or-`unknown` closure, the lying-clamp backend).
5. **Collective-miss critic** (max) — charged to REFUTE the convergent verdict: current-vacuity hunt,
   missed-caller grep, wrong-terminalize hunt, evidence/detector integrity, spec-drift, the four-lens
   structural blind spot.

## Integrator's independent live evidence (the seal's filter)
- **Non-vacuity RED proof:** reverting ONLY the 2 source files to HEAD (keeping V-N4 tests) → **11 tests
  RED** (R-V30 threading, R-V31 detector, concrete-bigint pin, differential-lag, §5.1 totality, new
  return shape, + the shape-conversion tests). Restored byte-identical (shasum verified). The fix's tests
  genuinely catch the bug.
- **Hostile-input battery (19 cases, ephemeral, deleted before seal):** both readers total under
  malformed RPC — every bad block → `null` skip-direction (never NaN), pinned-throw → `unknown` with
  ONE call + carried `blockNumber` + no unpinned retry, exact bigint pin, differential-lag closes.
- **Final fingerprinted gate:** green; fingerprint A==B stable across the run (F-FLAP closure).

## Findings (0 high · 1 med · 6 low) and dispositions — NO fix landed
| ID | Lens | Finding | sev | conf | disposition |
|---|---|---|---|---|---|
| **VN4-TF-1** | R3 | `beforeEach` default `mockChainTs` is now `{ts,blockNumber}` but is NOT independently guarded — a FUTURE revert to a bare number would still pass (reproduced 60/60 green). | med | high | **ACCEPT, no fix.** NOT a current vacuity (the 4-arg/blockNumber behavior IS pinned by R-V30 + the settle-engine pin tests; my 11-RED proof + R3 + critic concur). Spec §9.4 CONSCIOUSLY accepted "R-V12/R-V17 ride the default." A guard would perturb spec-authorized test design = gold-plating. Class **DC-05**. Optional future test-tuning. |
| **VN4-D1** | critic | The new detector predicate `terminalized===0 && quarantined===0 && unknown>0` (`reconcile.ts:660`) is suppressed when an unrelated chain-independent **quarantine** co-occurs with a genuine pin-degraded `unknown` in the same ≤3-row pass (reproduced `{examined:2,quarantined:1,unknown:1}`→no fire). | low | high | **ACCEPT.** The predicate is EXACTLY what §5 step 5 / §6 LB-2 specified — build conforms; the weakness is a deliberate spec-level sensitivity/specificity tradeoff (page only on a TOTAL stall to avoid alert-fatigue). Masking is transient/self-resolving (quarantined rows set `expiryClass`, exit the pool) + fully backstopped (`pending_overdue` ≤6h + per-run `expiry_pass{unknown>0}` feed). Changing a spec-specified paging threshold under a seal = scope-creep + R-V31 redesign. Class **DC-18**. Observability follow-up. |
| **VN4-C1** | R1 | Sibling of D1: a pass that TERMINALIZES ≥1 while others read `unknown` also doesn't fire the same-run page (partial degradation). | low | high | **ACCEPT** — same root + same backstops as VN4-D1. By-design, documented. Class **DC-18**. |
| **VN4-TF-2** | R3 | The null-safe-head-anchor path fires `expiry_anchor_degraded` CORRECTLY (verified) but is not asserted by name in any test (R-V31 exercises the nonce-`unknown` path). | low | high | **ACCEPT** — pure coverage gap, behavior correct. Optional one-line test. Class DC-18/05. |
| **F-DC15** | R2 | `env.ts:280` "(Recommended, not required)" RPC comment is now UNDERSTATED by V-N4's hard deploy precondition — but `env.ts` is FROZEN (§7), correctly NOT edited. | low | high | **ACCEPT** — do not edit a frozen surface for a comment; a2 GO-LIVE item 5 now carries the authoritative version. Fold into the next chunk that legitimately opens `env.ts`. Class **DC-15**. |
| **clamping-backend** | R4 | A hypothetical RPC backend that silently clamps a FUTURE numeric block N to encoded-stale `false` (instead of erroring) could in principle wrong-read; no mainstream client documented to do this. | low | high | **ACCEPT** — inherent to ANY on-chain oracle read (a lying-encoded `false` is indistinguishable from truth), NOT introduced or worsened by V-N4 (strictly improved: pre-V-N4 'latest' silent-stale → now correct-or-`unknown` across all documented clients). The deploy precondition (single-view-consistent endpoint) is the operator-side mitigation. Class **DC-08**. |
| F-FLAP | R2 | The 2 prod source files transiently flapped HEAD↔V-N4 mid-review. | — | — | **NOT a V-N4 code defect** — artifact of R3's CONCURRENT non-vacuity reproduction (revert/restore) observed by read-only R2 on the shared tree. Resolved by the fingerprinted final gate (A==B stable). Reinforces the shared-worktree hazard (orchestration lesson: never run a tree-mutating reviewer concurrently with a tree-reading one). |

**Zero high-severity findings open. The one med (VN4-TF-1) is a consciously-accepted, spec-authorized,
adversarially-confirmed future-regression test-robustness residual — not a behavior defect and not a
current vacuity.** All lows accepted as documented residuals.

## Bookkeeping done on seal
- **Register** (`s-deep-audit-register-2026-06-10.md`): marked **V-N4 SEALED** (this doc + `.audit/v-n4-seal/`);
  bumped the gate baseline **4434 → 4440**.
- **Defect ledger** (`.audit/defect-ledger/`): appended V-N4 faces to **DC-04** (the block-pin
  ground-truth binding — the realized fix), **DC-08** (the pinned-read fail-mode + liveness precondition;
  the clamping-backend residual), **DC-18** (VN4-D1/C1 detector total-stall suppression + the new
  detector's truthfulness), **DC-05** (VN4-TF-1 unguarded default-mock regression surface), **DC-15**
  (F-DC15 env.ts comment drift held under a frozen surface); INDEX one-liners bumped.
- **Derived snapshots**: `.audit/v-n4-seal/{SEAL-STATUS.md, built.diff, gate.log, fingerprint.txt}`.
- **Next handoff**: `v-n4-post-seal-deep-audit-handoff-2026-06-13.md` (③, HIGH-STAKES).

## Forward notes (→ ③ post-seal deep audit, HIGH-STAKES — warranted)
The ③ deep audit inherits the integrated-whole view (the seal reviewed the BUILT diff in isolation; ③
re-derives the invariant across the integrated reconciler + the deploy posture). Concentrate ③ on:
- **The detector sensitivity class (VN4-D1 + VN4-C1):** is the spec-chosen "total-stall only" paging
  threshold the right sensitivity/specificity point, or should pin-degraded nonce-`unknown` be tracked
  SEPARATELY from anchor-null `unknown` and paged regardless of co-occurring quarantine/terminalize?
  (The critic's option (b).) Weigh against the alert-fatigue the (V) chunk cured.
- **The deploy precondition as a SAFETY (not just liveness) question:** R4's lying-clamp-backend residual
  — confirm against the ACTUAL prod `SETTLEGRID_BASE_RPC_URL` provider's documented behavior for a
  future/unknown numeric block (founder/ops input). This is the one spot where "liveness not safety"
  rests on an empirical provider property the code cannot defend.
- **VN4-TF-1 test-robustness:** decide whether a one-line default-mock guard is worth landing in a
  test-tuning pass (vs the spec's conscious acceptance).
- **F-DC15 / env.ts comment:** fold when env.ts next opens.

━━ CADENCE STATUS ━━
Done:  ② seal-gating review → **SEALED**
Tier:  **high-stakes**  (escalated? **n** — re-confirmed, not lowered)
Policy: **applied** — opus (claude-opus-4-8) all roles pinned at spawn; effort sequenced xhigh (3 reviewers) → max (isolated core-invariant) → max (critic; ≥high floor, deliberate no-down-switch) → max integration (≥xhigh floor). No reviewer refused.
Workflow: **proceeded via Agent-tool spawns** (operator did not opt in; ▸ prime candidate for next time — say "ultracode" / "run as a workflow").
▶ NEXT: **③ the post-seal deep audit (HIGH-STAKES)** — kickoff in `v-n4-post-seal-deep-audit-handoff-2026-06-13.md`.

---
## ③ POST-SEAL DEEP AUDIT UPDATE (2026-06-14) — RE-CERTIFIED
The ③ deep audit ran (resolution: `v-n4-post-seal-deep-audit-resolution-2026-06-14.md`; workflow `wf_bb0c329e-70a`).
**Verdict: RE-CERTIFIED.** This seal's money-safety verdict was INDEPENDENTLY RE-CONFIRMED (invariant re-derived from
canonical EIP3009.sol; both money-path candidates REFUTED; the two readers have NO caller outside `runExpiryPass`
repo-wide; 17-case hostile battery green). Prod readers + `runExpiryPass` are BYTE-IDENTICAL to this seal. Two
test-fidelity hardenings landed on the V-N4 test surface (non-vacuity proven LIVE):
- **TF-7** (= this seal's VN4-TF-2): R-V24's null-safe-head-anchor route now asserts `expiry_anchor_degraded` BY NAME.
- **TF-2** (new): R-V13's scalar-evidence guard tightened from `objectContaining` (superset) to EXACT-keys.

⚠ **The `reconcile.test.ts` fingerprint above is SUPERSEDED.** Re-certified fingerprints (use THESE for founder-commit):
```
3216deac01e887f03cdd5583e50c086c9899939d  apps/web/src/lib/settlement/circle-nano/settle-engine.ts          (unchanged)
5356b2a945b42cf900dd70e774449e1a1ab95195  apps/web/src/lib/settlement/reconcile.ts                          (unchanged)
da95d57d0a59279a4f3944f23c747b55a5aa5f1a  apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts (unchanged)
59341749da17cd0956241fde1ea8c79fa6f69053  apps/web/src/lib/settlement/__tests__/reconcile.test.ts           (③ HARDENED — was c27ffbbe)
4c2ba1f0ecd3676ec4cbf3329748dddddcbf2784  docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md    (unchanged)
```
The **VN4-D1/C1 detector-masking residual was STRENGTHENED** (the masking is broader than this seal's single-network
premise — multi-network + per-call-transient also mask it) and ROUTED to a dedicated observability chunk (money-safe;
NOT hotfixed). Gate green 4440/191/0 on the re-certified tree.
