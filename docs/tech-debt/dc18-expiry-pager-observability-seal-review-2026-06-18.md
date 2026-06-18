# DC-18 expiry-pager observability — ② SEAL-GATING REVIEW (2026-06-18)

> Independent, hostile, fresh-context review of the BUILT diff — the review that decides the seal.
> **Verdict: CLEAN — seal recommended. Zero high, zero medium findings open.** Claude cannot
> self-seal; the operator runs `/seal-go` to seal, after which ③ (post-seal deep audit) follows.
> Tier: HIGH-STAKES (re-confirmed against the realized diff; no escalation).

## Scope (in-scope diff)
- `apps/web/src/lib/settlement/reconcile.ts` — `ExpiryPassStats` + `NetworkExpiryBucket` + the
  `runExpiryPass` per-network pager/telemetry arm and per-network bucketing at the six canonical
  outcome sites (+120/−28-ish).
- `apps/web/src/lib/settlement/__tests__/reconcile.test.ts` — re-keyed R-V31/R-V24; new R-V32/R-V33/R-V34/R-V35.
- `docs/tech-debt/v-pending-lifecycle-runbook-2026-06-12.md` — DC-15 runbook sync (per-network shape).
- **EXCLUDED:** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (uncommitted out-of-scope
  slugify carry-forward — leave untouched, exclude at founder-close).

## Gate (clean isolated re-run by the integrator this session)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run`
- **tsc:** exit 0
- **lint:** 0 errors, 8 pre-existing warnings (`<img>` / exhaustive-deps / unused-disable)
- **vitest:** Test Files 197 passed / Tests **4576** passed / 0 failed (baseline 4572 → **+4** = the
  4 net-new pins; R-V31/R-V24 re-keyed not added)
- `reconcile.ts` shasum (post-review, restored tree): `9f10ae820f9c462a8823e3b6b4166f60a00e794bf702ca3c13b9203ecaf7ba34`

**Note:** cadence-state's `gate`/`result`/`seal`/`next` fields at review-start were STALE SLICE-5
(compliance.ts) residue — only `phase` flipped to `review`. The build's own "green" was therefore
evidence-free; this gate was re-derived from scratch, not trusted.

## Reviewer fan-out (Agent-tool spawns; operator-opted, recommended default)
5 fresh-context lens-distinct reviewers (model pinned `opus`; all self-reported `claude-opus-4-8[1m]`;
coverage mode), then integrator triage + live reproduction:
1. **L1 — correctness/determinism (core invariant):** no defect. Predicate depends only on bucket-N's
   own counters (no re-mask); total anchor outage pages via inclusive-OR; lazy-bucket existence
   faithfully realizes the per-network `examined>0` guard; six increments at the right sites
   (no double/miss/wrong-counter); ≤2 bounded deterministic pages.
2. **L2 — alert-fatigue + money-safety:** preserved + invariant. No-progress gate kept; no
   flip/credit/terminalize/quarantine decision edited; stay-pending `continue`s and V-N4 block-pin untouched.
3. **L3 — SEAM:** all 7 seams clean. Logger reserved keys `{level,msg,ts,error,stack}` — no collision;
   stateless-cron confirmed; flat `unknown` retained; canonical bucket key; `(S)` invariant untouched.
4. **L4 — literal-execution:** reference semantics correct; the fatal `bucketFor(null.network)` does
   NOT exist; precedence `(unknownAnchor+unknownNonce)>0` correct; no aliasing hazard (synchronous serialize).
5. **L5 — §6 spec-conformance + test-fidelity (DC-05) + DC-15/DC-08:** all 8 BINDING rulings conform;
   all six pins non-vacuous; comment + runbook fully synced.

**Effort note:** operator selected `/effort xhigh`; reviewer effort self-reports said "high"
(treated as known-unreliable per policy). Assurance rests on 5-lens convergence + adversarial
framing + the integrator's live revert→RED reproduction, not the self-reported tier.

## Non-vacuity (live revert→RED, fail-then-pass — re-derived; not on disk before this review)
Reverted `reconcile.ts` to HEAD (old pass-global predicate `terminalized===0 && quarantined===0 &&
unknown>0`), test file kept NEW, vitest run from `apps/web`:

| Pin | Old source | Why RED |
|---|---|---|
| R-V31 | RED | page lacks `network`/split keys |
| R-V32 (de-masking) | RED | old pass-global paged NEITHER (A's terminalize ⇒ `terminalized≠0`) → B's page absent |
| R-V33 | RED | no `byNetwork` in info feed |
| R-V34 ((V)-preservation) | RED | info-feed split keys absent |
| R-V35 (DC-08) | RED | info-feed split keys absent |
| R-V24 (null-anchor) | RED | page lacks `network`/`unknownAnchor` |

Exactly 6 RED, the other 64 expiry/reconcile tests GREEN (surgical to the DC-18 pins). Restored
(`git stash pop`) → 70/70 GREEN. **Harness note:** a first revert attempt produced a spurious
whole-file collection RED (`Failed to load url @/lib/env`) because vitest ran from the repo root,
not `apps/web` — diagnosed and rerun from `apps/web` for the meaningful per-pin result above.

## Integrator source-level ground-truth
- Six `bucketFor` sites at `:638,647,664,687,703,723` — all downstream of the `!parsed` (`:623`) and
  non-canonical (`:627`) `continue`s; the network-less arms (`:624` unparseable, `:628` unsupported)
  increment flat `stats.quarantined` only (no bucket) → no null-deref, no mask/misattribution.
- Money-safety: every decision `continue`/`flip` logically unchanged; only counter+bucket increments
  inserted before existing `continue`s; `:665`/`:688` stay-pending and `:683` V-N4 pin untouched.
- The emit loop (`:773-784`) + info feed (`:790-798`) sit inside `if (stats.examined>0)` but OUTSIDE
  the try/catch (`closes :739`) — identical position to the OLD pager; pre-existing structure, plain-
  number payload, cannot throw in practice. Not DC-18-introduced.

## Findings ledger (all LOW/INFO/cosmetic — none blocks the seal; no fix warranted)
- **Flat-vs-bucket quarantine asymmetry** (converged L1/L2/L3/L4): `Σ bucket.quarantined ≤
  stats.quarantined` because network-less quarantines (`:624`/`:628`) stay flat-only. **INTENDED**
  and documented in the `NetworkExpiryBucket` JSDoc; the flat `unknown` reconciles exactly. R-V33
  asserts only the canonical-scenario reconciliation (correct). A fix would be scope creep.
- **Page payload omits `examined`** (L2): per-network page carries per-network counters; the flat
  `examined` remains in the `reconcile.expiry_pass` info feed. No programmatic consumer (Sentry only);
  runbook documents the new shape. Not a regression.
- **Info-feed comment `:785-787` uses pass-global phrasing** (L5 cosmetic): accurately describes the
  INFO feed's flat cross-run cue (not the per-network page); the §6 DC-15 deliverable (the PAGER
  comment `:741-772`) was fully rewritten. No fix.
- **`unknown` recomputed twice** (L4 DRY nit), **shared `'unparseable'` class string at two sites**
  (L1 F-B): cosmetic. No fix.
- **`tools/page.tsx`** out-of-scope carry-forward: EXCLUDE at founder-close.

## Money-safety (asserted, unchanged)
No flip/credit/terminalize/quarantine DECISION edited — only counters, the pager block, and comments.
A masked/missed page is bounded ≤6h by `pending_overdue`; correct bias is toward NOT over-firing.

## Policy
Applied. Env clean (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all UNSET). Path 1 (mixed-effort named
subagents) unavailable — no pre-existing effort-bearing pool — so the operator-recommended default
(Agent-tool spawns at session effort) was used; the `max` core-invariant pass was offered and the
operator chose to skip it (focused diff). Allowlist GREEN for the integrator's foreground gate/repro
(git/tsc/vitest/lint); reviewers ran read/reason/`git diff` only (the `cd`-prefixed gate would
silently auto-deny in background — mitigated by integrator-side live reproduction, the intended model).

## Next
1. Operator: `/seal-go DC-18-expiry-pager-observability` (the manual seal gate).
2. Then ③ post-seal deep audit (high-stakes).
3. Founder-close: path-scoped LOCAL commit of the 3 in-scope files (EXCLUDE `tools/page.tsx`), then `/push-go`.
