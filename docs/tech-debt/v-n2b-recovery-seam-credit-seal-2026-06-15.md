# V-N2b — in-request recovery-seam credit → SEALED (2026-06-15)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed** (push is a separate `/push-go` gate). Base = `main` @ `43add9b7`. Closes the carried
> live-recovery twin of DC-01 (the in-request over/under-credit vector V-N2 fixed only on the
> reconciler tail).

## Verdict
**SEALED** — gate green, zero high-severity findings open, reviewers' evidence supports it.

## What shipped (one line)
The in-request on-chain settlement credit (proxy `forwardAndBill` twin for x402 + circle-nano, and the
kernel `/settle` route) now pays the orchestrator-resolved **actually-collected settled value**
(fresh-submit = this proof's value == costCents; recovery-confirm = the prior broadcast's recorded
`settledValueBaseUnits`) — **or DEFERS** (credit nothing, `credited_at` NULL, emit the differentiated
signal) when that value is absent/unconvertible — never `costCents` on a recovery.

## Gate (re-verified clean isolated, this session)
apps/web `tsc` 0 · `lint` 0 err · **`vitest` 4491 / 0 (194 files), exit 0** (matches build §7 exactly);
packages/mcp `build` 0 · `test` 1898 / 1 skip · `lint` 0 err. ⚠ never run apps/web `vitest`
concurrently with packages/mcp `build` (dist-rebuild race fails `proxy-equivalence.test.ts`, which is
not in this diff).

## Review shape
5 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff (money-invariant · correctness ·
spec-conformance · SEAM · literal-execution) + integrator live source-grounding. **Policy note:** PATH 1
(effort-bearing named subagents) was unavailable, so reviewers ran at session effort, not a per-agent
`max` money-lens; the `max`-depth money pass is routed to ③. Allowlist gap (`npm/npx` un-granted)
handled by running all gate/repro Bash in the foreground main session; reviewers were read-only.

## Verified at source (load-bearing)
Fresh-submit non-regression EXACT (census-pinned `exactAmount` → `settledBaseUnitsToCents(value) ===
costCents`, BigInt floor); 4th-arg wiring (fresh = `proof.authorization.value`, recovery = undefined);
recovery re-read AFTER the flip reads the surviving recorded value, never the frozen `amountCents`;
exactly-once intact (`WHERE pending … isNull(credited_at)` sole arbiter, no new credit path); defer
writes nothing & never a masking 0-marker (`0` unreachable from the resolver); key-sync (reader bound
param == writer literal); signals emitted once in the orchestrator; detector correctly DESCOPED;
`reconcile.ts` byte-identical. Non-vacuity per the build's triple-sabotage → 12 credit-value tests RED.

## Frozen-surface compliance
Realized diff stayed within the §7 pre-authorized carve-outs (findSettlementRow projection;
settled-outcome `creditCents?`; `options.settlement.creditCents`; billing-credits gate migration; test
mocks). `WHERE pending` flip + `alreadySettled→skipCredit`, the `markSettlement*` writers,
`settledBaseUnitsToCents` / `SETTLED_VALUE_BASE_UNITS_KEY`, `reconcile.ts`, and both census tests
untouched. No ② code edits — only the 2 handoff docs + this record + the ledger were added.

## Open residuals (NON-BLOCKING → ③ / founder-close)
- **MED-1 (DC-15):** the "reconciler + uncredited-sweep backstop" comments overstate AUTO-recovery — a
  deferred `settled`+`credited_at`-NULL row is never re-credited by the reconciler (pending-only
  selection); recovery is sweep-alert → manual runbook. ③ confirm the runbook covers the
  in-request-defer class + correct the wording.
- **MED-2 (DC-18):** defer-path `invocations.costCents` (= actualCost) vs `tools.totalRevenueCents` (no
  bump) divergence; inline comment `route.ts:1816-1818` wrongly claims agreement. Analytics-only.
- **LOW:** latent zero-credit guard (unreachable, keep the `<=0→defer`); orphaned JSDoc in
  `settled-value.ts`; kernel/header quoted-price on recovery (DC-18, registered); diagnostic log line.

## Defect-class ledger
DC-01 carried twin → **CLOSED** (recorded). New recurrences recorded: DC-15 (MED-1), DC-18 (MED-2).
Touchpoints: DC-06, DC-12, DC-20 (the absent-value defer trigger).

## Next
HIGH-STAKES → ③ post-seal deep audit
(`v-n2b-recovery-seam-credit-post-seal-deep-audit-handoff-2026-06-15.md`), money lens at `/effort max`,
prioritizing MED-1's operational-closure question. Founder-close LOCAL commit (path-scoped), then
`/push-go` only on explicit founder say-so.
