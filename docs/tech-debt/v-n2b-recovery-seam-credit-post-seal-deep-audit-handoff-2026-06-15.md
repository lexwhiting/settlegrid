# V-N2b — in-request recovery-seam credit → ③ POST-SEAL DEEP-AUDIT HANDOFF (2026-06-15)

> ② SEAL-GATING REVIEW COMPLETE → **VERDICT: SEALABLE (zero high-severity open, gate green,
> reviewers' evidence supports).** Awaiting the operator `/seal-go` to finalize (Claude can't
> self-seal). LOCAL only, never pushed. Base = `main` @ `43add9b7`. This is the input to ③ (the
> HIGH-STAKES post-seal deep audit). Read the build's SEAL-HANDOFF
> (`v-n2b-recovery-seam-credit-SEAL-HANDOFF-2026-06-15.md`) and §7 of the ①-handoff first.

---

## 0. What ② did

Independent, hostile, fresh-context review of the BUILT diff (13 files, +539/-75). Five lens-distinct
Opus-4.8 reviewers drove the real diff + live code (money-invariant · correctness/determinism ·
spec-conformance · SEAM · literal-execution); the integrator reproduced every load-bearing claim at
source. The full gate was re-run in a CLEAN ISOLATED run and matched the build's manifest exactly.

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) was unavailable in
this environment — the available agent types are all generic, none carry `effort: max/xhigh`
frontmatter, and a running agent cannot stand up an effort-bearing definition mid-run. So the seal
reviewers ran at session effort (Opus 4.8, model-pinned), NOT a per-agent `max` money-lens / `xhigh`
mix. The integrator compensated by grounding every decisive claim at source in this session and
routing the `max`-depth money-invariant pass to ③. **③ should run the core-invariant lens at
`/effort max`** (Path-2 operator switch or Path-3 process), which is the one coverage element ②
could not realize at the policy's preferred tier.

## 1. Gate evidence (RE-VERIFIED clean isolated, 2026-06-15)

| check | floor @ 43add9b7 | ② re-run | matches build §7 |
|--|--|--|--|
| apps/web `tsc --noEmit` | 0 | **0** | ✓ |
| apps/web `lint` | 0 err | **0 err** (pre-existing warns: logo.tsx, academy-lessons) | ✓ |
| apps/web `vitest` | 4469 / 0 (193 files) | **4491 / 0 (194 files)** exit 0 | ✓ (exact) |
| packages/mcp `build` | 0 | **0** | ✓ |
| packages/mcp `test` | 1898 / 1 skip | **1898 / 1 skip** | ✓ |
| packages/mcp `lint` | 0 err | **0 err** (6 pre-existing warns) | ✓ |

⚠ GATE-RUN HAZARD (recorded so ③ doesn't repeat it): running apps/web `vitest` CONCURRENTLY with
packages/mcp `npm run build` races — `proxy-equivalence.test.ts` loads `packages/mcp/dist/index.mjs`
while the build is rewriting it → spurious 1-suite load failure (NOT a V-N2b defect; that file is not
in the diff). Build mcp FIRST and let dist settle, THEN run apps/web in isolation.

## 2. Tier — RE-CONFIRMED HIGH-STAKES (no escalation, no silent lowering)

Money invariant (credit → `balanceCents` → unclawbackable fiat ≤24h); touches (T)-sealed
`forwardAndBill` twin + kernel `/settle` + (V)/(T) orchestrator outcome semantics; payout pipeline.
The realized diff stayed WITHIN the §7 pre-authorized carve-outs (findSettlementRow projection;
settled-outcome `creditCents?`; `options.settlement.creditCents`; billing-credits migration; test
mocks). No un-authorized frozen-surface touch found. `reconcile.ts` is byte-identical (`git diff
HEAD -- reconcile.ts` empty).

## 3. What ② VERIFIED at source (load-bearing claims — ground-truthed, NOT inspected)

- **Fresh-submit non-regression is EXACT.** `verifier-exactamount-census` pins `exactAmount:true` at
  every prod verify call-site (≥2 callers) → `value === floor(costCents)*10_000` → `settledBaseUnits
  ToCents(proof.value) === costCents` exactly (BigInt floor). Happy-path credit unchanged on all 3
  surfaces. (circle-nano/verify.ts:201; settled-value.ts:64-75; orchestrate.ts:390-400.)
- **4th-arg wiring.** Fresh-submit passes `proof.authorization.value` (orchestrate.ts:539,
  settle.ts:435); recovery passes nothing → `undefined` (orchestrate.ts:477, settle.ts:411). The
  `!== undefined` discriminator is sound; the param type is `string?` (no `null`), so no
  null-vs-undefined mis-route.
- **Recovery re-read.** Happens AFTER `markSettlementSettled` (flipped===true path only); the flip's
  `undefined`-value branch does NOT touch metadata, so the prior broadcast's `settledValueBaseUnits`
  survives; re-read keyed on unique `(operationId, rail)`; post-flip the row is terminal so no
  concurrent writer can mutate it. Credits ONLY from `settledValueBaseUnits`; `amountCents` feeds the
  signal payload only (never the credit).
- **Exactly-once intact.** No new credit path; the `WHERE pending … isNull(credited_at)` marker stays
  the sole arbiter; `alreadySettled` outcomes never carry `creditCents` and route to `skipCredit`.
  `credit-writer-census` stays green (its regex ignores the swapped operand). Only the flip-winner
  resolves `creditCents`.
- **Defer safety.** `null` ⇒ write NOTHING (no balance/revenue/marker/invocation-count); `credited_at`
  stays NULL; `<= 0`/overflow/non-integer all fold into defer (no masking 0-marker). `0` is
  unreachable from the resolver, so the downstream `?? null` / `!= null` gates are safe.
- **Key-sync.** Reader `metadata ->> ${SETTLED_VALUE_BASE_UNITS_KEY}` (bound param) == the writers'
  inline `jsonb_build_object('settledValueBaseUnits', …)` literals (ledger.ts:597,717). New source-
  scan guard pins it.
- **Signals.** Emitted ONLY in `resolveInRequestCreditCents` (the only layer distinguishing absent
  from unconvertible); proxy twin + kernel defer on null WITHOUT re-emitting. Names/levels/payload
  mirror the reconciler.
- **Detector correctly DESCOPED** (no recovery-seam `detectSettledValueDivergence`); reconciler NOT
  re-opened; new kernel + credit-value tests are NON-VACUOUS (assert the numeric credited value AND
  `.not.toBe(costCents)`; revert-source → RED per the build's non-vacuity proof).

## 4. RESIDUALS for ③ (all NON-BLOCKING; behavior correct, verified live)

### MED-1 — "reconciler backstop" comments overstate auto-recovery of a DEFERred row (DC-15)
The defer path flips the row `settled` + `credited_at` NULL. The reconciler's confirm-and-credit loop
selects `WHERE settlement_status='pending'` (reconcile.ts:514,558) and credits only on a flip it
performs (`:188 if (flipped && …)`); a row already `settled` is **never re-selected → never
auto-credited** (`:331` says so explicitly). Only the uncredited-SWEEP (`:752`+) COUNTS + alerts
(`reconcile.uncredited_settled`); closure is a MANUAL runbook UPDATE. So a DEFER = a real (but rare)
developer short-pay until an operator acts — **funds-safe (never a wrong/double credit), observable
(alert), strictly better than the pre-V-N2b wrong `costCents` credit**, but NOT the automatic
recovery the comments imply ("the reconciler + uncredited-sweep backstop" — settled-value.ts ~117-119,
orchestrate.ts ~96-98, circle-nano/settle.ts ~82-83, route.ts ~1623/1729, settle/route.ts ~206). The
build's own SEAL-HANDOFF §9 ("deferred-then-reconciled") carries the same imprecise model.
- DEFER trigger = absent (bounded DC-20 double-swallow residual, already backstopped by V-N2 ③) or
  unconvertible/corrupt value — both rare.
- **③ actions:** (a) confirm the operational closure actually exists — does the
  `reconcile.uncredited_settled` alert route to a runbook that credits the in-request-DEFER class (not
  only the process-kill-pending class)? (b) correct the comment wording (DC-15) → "uncredited-sweep
  enumerates+alerts → operator/runbook credit; the reconciler tail does not re-credit an
  already-settled row." Run the money lens at `/effort max` here.

### MED-2 — analytics divergence on the DEFER path; inline comment overstates agreement (DC-18)
On DEFER, `recordProtocolInvocation` records `costCents = actualCost` (e.g. 50) while
`tools.totalRevenueCents` gets NO bump and `tools.totalInvocations` is not incremented (the whole txn
is skipped). The inline comment route.ts ~1816-1818 claims `invocations.costCents` "agrees with
tools.totalRevenueCents … on every … defer path" — it does NOT on defer. The dashboard derives the
headline revenue from the `tools.totalRevenueCents` counter (stats/route.ts:46) but the 24h chart from
`sum(invocations.costCents)` (`:61`), so deferred rows make the two diverge by `actualCost`. **Bounded,
rare, analytics-only — NO money lost** (payout source-of-truth is `balanceCents`, correctly deferred).
The build's §9 acknowledges the `totalInvocations`-on-defer divergence but not this
`invocations.costCents`-vs-counter one, and the comment actively claims agreement.
- **③ actions:** correct the inline comment; register the defer-path analytics treatment with DC-18
  (alongside the already-registered `X-SettleGrid-Cost-Cents` buyer-spend item). Decide if the defer
  path should record `0` / skip the invocation row to keep the two revenue sources consistent (a
  behavior change — out of ②'s scope, do NOT fold a behavior change under the seal).

### LOW / cosmetic (batch)
- **L-3 latent zero-credit (DC-13):** `0 != null` would credit 0 + write a masking marker IF the
  resolver ever returned 0 — currently UNREACHABLE (resolver folds `<= 0` → defer). The `cents <= 0 →
  defer` guard is load-bearing for the no-masking-marker invariant; any future relaxation (e.g. a
  genuinely-free settled tool) MUST preserve it. (settled-value.ts ~836; route.ts ~1733;
  settle/route.ts ~209.)
- **L-4 orphaned JSDoc (cosmetic):** the new `resolveInRequestCreditCents` + its JSDoc were inserted
  BETWEEN `detectSettledValueDivergence`'s JSDoc (settled-value.ts ~78-96) and its body, so the
  detector's doc now floats above the wrong function. No behavior/gate impact; reposition in
  founder-close/③.
- **L-5 kernel/header quoted price on recovery (DC-18, already registered):** `X-SettleGrid-Cost-
  Cents` (route.ts ~1853) and the kernel response `costCents` (settle/route.ts ~224) stay the QUOTED
  price while the credit may differ on a recovery. Disclosed; buyer-spend reporting → DC-18.
- **L-6 log line:** `proxy.${method}_invocation` logs `actualCost` not `recordedCostCents` (route.ts
  ~1835) — outside §7.10 scope; on a recovery the log reads the quoted price. Diagnostic only.
- **L-7 (pre-existing, out of scope):** reverted-nonce-consumed re-points `external_ref` without
  re-pointing `settledValueBaseUnits` — but returns `pending` (no in-request credit), so V-N2b's twin
  never reads it; predates this diff.

## 5. Defect-class touchpoints (for the ledger at seal)

DC-01 (the carried live-recovery twin — CLOSED by this chunk: credit-the-recorded-value-OR-DEFER);
DC-06 (recorded value consumed only on the authoritative settling-tx flip — re-confirmed);
DC-12 (floor/units via the shared `settledBaseUnitsToCents`); DC-20 (the absent-value DEFER trigger is
the bounded double-swallow residual). NEW recurrence candidates surfaced by ②: **DC-15** (MED-1, the
"reconciler backstop" comment-drift) and **DC-18** (MED-2, the defer-path analytics divergence) — fold
at ③/founder-close, do not edit the INDEX before `/seal-go`.

## 6. Seal bookkeeping checklist (operator, after `/seal-go`)

1. `/seal-go` → finalize seal + cadence transition. 2. Founder-close LOCAL commit (path-scoped, NEVER
push). 3. Fold DC-15/DC-18 recurrences + the DC-01 CLOSED note into `.audit/defect-ledger/INDEX.md`.
4. Run ③ (HIGH-STAKES) with the money lens at `/effort max`, prioritizing MED-1's operational-closure
question. ③ may correct the MED-1/MED-2 comments + L-4 JSDoc (low-risk doc-only) if it judges fit.
