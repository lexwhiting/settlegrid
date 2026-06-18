# DC-18 expiry-pager observability — ③ POST-SEAL DEEP AUDIT (2026-06-18)

> Post-seal integrated-whole deep audit of the SEALED DC-18 per-network expiry pager.
> **Verdict: RE-CERTIFIED — the shipped CODE seal STANDS unchanged (byte-identical); the
> in-scope runbook was HARDENED for three sustained documentation/alerting-config findings.**
> No code defect found; no SEAM or LITERAL-EXECUTION code recurrence. High-stakes tier
> (re-confirmed). The seal subject `reconcile.ts` is byte-identical to the ② seal
> (shasum `9f10ae820f9c462a8823e3b6b4166f60a00e794bf702ca3c13b9203ecaf7ba34`).

## Subject & scope
- Sealed subject: `apps/web/src/lib/settlement/reconcile.ts` — `runExpiryPass` (`:558-801`),
  shasum `9f10ae82…` (asserted unchanged before, during, and after this audit).
- ③ scope = the INTEGRATED WHOLE on the committed tree (distinct from ②'s diff scope): the
  pager → `reconcilePendingSettlements` → stateless cron → `logger` → Sentry alerting surface;
  the real per-network RPC plumbing; the accepted residual under dynamic arrival; DC-05 rig
  fidelity; and a defect-class recurrence sweep (DC-01..DC-20 + standing SEAM/LITERAL-EXECUTION).

## Mechanical pre-flight (integrator, this session — handed to the reviewers)
- Gate (clean, from `apps/web`): `npx tsc --noEmit` → exit 0; `npm run lint` → 0 err / 8
  pre-existing warns; `npx vitest run` → **197 files / 4576 tests / 0 failed** (= ② baseline).
- Env clean: `CLAUDE_CODE_FORK_SUBAGENT` / `_SUBAGENT_MODEL` / `_EFFORT_LEVEL` all UNSET.
- Independent invariant re-derivation (integrator ground-truth):
  - **Money-safety:** the quarantine *conditions* are byte-identical pre/post (`git diff`);
    only additive bucket increments were inserted inside existing `if`-bodies — no
    flip/credit/terminalize/quarantine DECISION edited.
  - **Reconciliation:** every `stats.unknown++` (`:662`,`:685`) and `stats.terminalized++`
    (`:722`) is paired with a canonical-network bucket increment downstream of the `:627`
    canonical gate ⇒ `Σ bucket(unknownAnchor+unknownNonce) === stats.unknown` and
    `Σ bucket.terminalized === stats.terminalized` EXACTLY. The only flat>bucket asymmetry is
    `quarantined` (network-less arms `:624`/`:628` have no bucket) — the documented residual.
  - **Backstop bound:** `overdueAfterMs = 6*3_600_000` (`:907`); `reconcile.pending_overdue`
    is a SEPARATE aggregate (`:992-1005`) independent of the expiry-pass examination — cannot
    be starved by a quarantine flood; anchor-stalled rows (pending, no `expiryClass`) fall in
    its predicate ⇒ the masking residual is genuinely bounded ≤6h under dynamic arrival.

## Reviewer fan-out (workflow, operator-opted; `wf_f3066bd7-9d3`)
5 fresh-context, lens-distinct, coverage-mode reviewers (all self-reported `claude-opus-4-8[1m]`,
effort `high`, shasum MATCHES) → collective-miss critic (xhigh; the optional `max` bump was
offered and the operator chose the no-stall xhigh default). Integrator triage + premise
verification stayed in the main session.
- **L1 SEAM (pager→cron→logger→Sentry):** code seam CLEAN (reserved-key/level/`logKey`
  stability all PASS; `network`/`byNetwork`/`unknown` collide with none of
  `{level,msg,ts,error,stack}`); two alerting-CONFIG/doc gaps → L1-1, L1-2.
- **L2 multi-network RPC reality:** predicate correct on all six degradation patterns, no
  cross-network misattribution, runbook covers every emittable page shape; low/info residuals.
- **L3 residual + bounding + DC-09:** residual real & TIME-bounded ≤6h (sound, money-safe);
  no DC-09 examination starvation; `pending_overdue` not co-occurrence-suppressible → L3-1.
- **L4 literal-execution:** fully CLEAN (8 correctness confirmations; no aliasing, no
  null-deref, precedence correct, cannot-throw confirmed, ≤2-line cap holds).
- **L5 DC-05 rig fidelity + recurrence sweep:** rig faithful; NO defect-class recurrence in
  source; two doc/rig residuals → L5-01, L5-02.
- **L6 collective-miss critic:** L6-1 (deadline-truncation × bucketing, unprobed by L1–L5),
  L6-2 (`≤2` is a network-count artifact), L6-3 (the cannot-throw claim's unstated dependency).

## Findings → disposition
| ID | Sev | Disposition |
|---|---|---|
| L1-1 | med | **FIXED (runbook §3).** Added the missing Sentry-arming decision row for `reconcile.expiry_anchor_degraded` (recommend every-event; default grouping otherwise collapses recurrent per-network stalls into one non-renotifying issue — the DC-18 class at the alerting-config layer). |
| L3-1 / L2-3 / L6-1 | med/low | **FIXED (runbook §5).** Disclosed the two bounded intra-network masking modes ("no same-run page ≠ healthy"): intra-network progress under sustained quarantine inflow, and budget-truncation under a multi-network outage. Both money-safe, both bounded ≤6h by `pending_overdue`. The *behavior is correct and was already the accepted residual*; the gap was operator mental-model disclosure. |
| L5-02 | info→low | **FIXED (runbook §5).** Corrected the factual error: the `unknownNonce` read is USDC `authorizationState` (a `readContract` eth_call at block N), NOT `eth_getTransactionCount` (DC-15 doc/contract drift). |
| L6-2 | low | **FIXED (folded into L1-1 edit):** reworded "≤2/pass" to "≤ the canonical-network count (2 today)" in the runbook so a future third-chain PR re-derives the fatigue/quota math. Sealed source comment left unchanged (accurate today; not re-opening the seal for a hypothetical). |
| L1-2 | low | **RECORDED, no change.** Page deliberately drops flat `examined` (lives in the info feed; runbook payload doc already accurate). Only out-of-repo Sentry/log saved-query risk — flagged for the founder's Sentry live-verification, not a code/doc defect. |
| L2-1, L3-3, L4-9, L5-01, L6-3, all INFO confirmations | low/info | **RECORDED, no change.** Accepted residuals / skip-direction properties / confirmations of correctness; no fix warranted (would be over-engineering or perturb a frozen surface). |

## What ③ did NOT change (asserted)
The shipped code is byte-identical to the ② seal — **zero code edits** (`reconcile.ts` shasum
`9f10ae82…` re-confirmed post-audit). The frozen surfaces (candidate SELECT/ordering,
decidability gates, `quarantineClassify` truth-CAS, the terminalize evidence-CAS, the LB-2
stay-pending rule, the V-N4 block-pin, the `(S)` summary invariant, `pending_overdue`) are
unchanged. No deferred work pulled in; the accepted intra-network-quarantine residual is NOT
de-masked. `tools/page.tsx` left untouched and excluded.

## Re-review of the hardening
Doc-only (markdown not compiled/linted/tested). The seal subject `reconcile.ts` was asserted
byte-identical before and after, so the green gate (tsc 0 / lint 0 / vitest 197/4576/0) holds
unchanged. Each fixed finding's premise was verified live against source: L5-02 vs
`settle-engine.ts:363` (`readContract authorizationState`); L1-1 vs the §3 table's existing
four-key set; L3-1/L6-1 vs the loop's deadline break (`:609`/`:671`) + FIFO recovery
(mark-before-examine `:613`) + the `pending_overdue` ≤6h aggregate.

## Verdict
**RE-CERTIFIED.** The DC-18 per-network expiry pager is correct, money-safe, and to-spec as
shipped; the seal STANDS on the code. Three sustained documentation/alerting-config findings
were closed fix-first in the in-scope runbook (the chunk's own DC-15 deliverable), hardening
the observability contract the chunk exists to deliver. No new defect class minted (the
findings are DC-18 alerting-config + DC-15 doc-drift instances); no SEAM/LITERAL-EXECUTION
code recurrence.
