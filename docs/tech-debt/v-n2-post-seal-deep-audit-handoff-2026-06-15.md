# V-N2 — ③ POST-SEAL DEEP AUDIT — HANDOFF (2026-06-15)

> For the FRESH ③ session. V-N2 (credit the ACTUAL settled value) is **② SEALED** (capstone
> `v-n2-seal-2026-06-15.md`). HIGH-STAKES → ③ post-seal deep audit IS warranted. The ③ reviews the
> **integrated whole** (V-N2 in the live settlement system), not just the diff — the ② already drove the
> diff with 3 lenses + the 8-sequence core-invariant proof. LOCAL atop `3bcf27ac`, NOT pushed; founder-close
> (path-scoped LOCAL commit, NEVER push) happens AFTER ③.

## State handed over
- **Seal:** `docs/tech-debt/v-n2-seal-2026-06-15.md` (panel, dispositions, carried findings). Build record:
  `v-n2-build-record-2026-06-15.md`. Register V-N2 → SEALED. Memory `settlegrid-debt-chunks.md` updated.
  Ledger faces DC-01/06/12/18/05 charged (gitignored `.audit/`).
- **Diff (10 files):** src — NEW `settlement/settled-value.ts`; `settlement/ledger.ts`,
  `settlement/x402/orchestrate.ts`, `settlement/circle-nano/settle.ts`, `settlement/reconcile.ts`. test —
  NEW `__tests__/settled-value.test.ts`, NEW `__tests__/verifier-exactamount-census.test.ts`,
  `__tests__/reconcile.test.ts`, `circle-nano/__tests__/settle.test.ts`, `x402/__tests__/orchestrate.test.ts`.
  (+ the 3 docs above.)
- **Gate (clean, post-fix):** apps/web tsc 0 · lint 0 errors · vitest **4469 passed / 0 failed** (193 files);
  packages/mcp build 0 · vitest **1898 passed / 1 skipped** · lint 0 errors.

## ③ PRIORITY TARGETS (where the ② concentrated suspicion / accepted residuals)

1. **[HIGH — the headline] The carried in-request RECOVERY-CONFIRM credit divergence.** The ② surfaced + live-confirmed
   that `forwardAndBill` (`proxy/[slug]/route.ts:1695,1713,1720`) credits `actualCost = costCents` (current
   request) and the orchestrator recovery branch (`x402/orchestrate.ts:432`, `circle-nano/settle.ts:373`)
   returns `settled` WITHOUT `alreadySettled` when it confirms a PRIOR broadcast tx — so a re-sign-same-nonce-at-
   new-price retry credits the new cost while the prior tx collected a different value (over-credit on raise,
   short-pay on lower). PRE-EXISTING, OUT OF V-N2 SCOPE, registered for its own chunk. ③ should: (a) independently
   confirm/refute reachability (the nonce-reuse-with-new-value precondition — does any SDK/client path produce
   it?); (b) decide whether the fix belongs to a dedicated chunk now (the recorded `settledValueBaseUnits` is
   already on the row — the live recovery credit could read it, mirroring V-N2); (c) re-examine the register
   ③-(T) "exact-amount closes the amount face in practice" note this corrects.

2. **[MED] exactAmount enforced only by a CI test, not at runtime.** The unconditional settled-value credit is
   correct ONLY while `value === cost` (exactAmount:true) at every verifier caller. The sole structural guard is
   `verifier-exactamount-census.test.ts` (build-time). The non-exact `value >= required` branch
   (`circle-nano/verify.ts:201`) is live-but-callerless and DEFAULTS falsy. ③: is a runtime assertion warranted,
   or is the CI census + the cross-rail hardcoding sufficient? Trace what credits if a non-exact authorization
   ever settled.

3. **[LOW] Detector `frozenAmountCents` basis** (`existing?.amountCents ?? params.costCents`,
   `orchestrate.ts`/`settle.ts` onBroadcast): under first-write / NULL-amount / Redis-down-unlocked, the
   comparison basis can mis-source — observability-only (no money impact, silent under exactAmount). ③: confirm
   no false-page / no missed-loss-page sequence on the unlocked path.

4. **[LOW] §13.F seam-silence at settledCents===0** (spec-verbatim): a sub-cent-collected-against-positive-frozen
   loss is silent at the broadcast seam (defers to credit_skipped_no_data at the reconciler). Spec-chosen; ③
   confirm the deferral is still the right call for the integrated alarm posture.

5. **Integrated-whole seams the ② did not own:** the live in-request credit surfaces (proxy + kernel /settle) as
   a SYSTEM with the reconciler tail — exactly-once across ALL creditors under concurrency (the ② proved the
   reconciler-vs-live race exactly-once for sequence 4; ③ should stress the full creditor set incl. the F1 sweep
   and the credited_at marker under process-kill); the uncredited-sweep / pending_overdue detectors' interaction
   with the new legacy-fallback + unconvertible signals (false-positive / alarm-fatigue); the `data-retention` /
   GDPR path vs the new `metadata.settledValueBaseUnits` (a NEW indexed-row metadata field carrying a value — V-N3
   erasure lineage).

## Defect classes to charge (③ lens briefs)
DC-01 (credited-without-collection — the carried #1/#2 twin) · DC-06 (idempotent-writer / recovery coherence) ·
DC-12 (units/floor/int4 boundary) · DC-18 (detect truthfulness + alarm-fatigue) · DC-05 (test-double/non-vacuity) ·
DC-20 (write-ahead-failure-aliases-as-absence — the legacy-fallback NULL-as-"no value" read) · DC-16 (the
register ③-(T) note this corrects — a planning artifact asserting a now-false "closed in practice").

## Method (same cadence policy as the ②)
Opus 4.8 throughout; xhigh integrated-whole lenses + a /effort-max core-invariant/collective-miss pass; coverage
mode; reproduce sustained high/med live (fail→fix→pass); refuters at /effort high on contested findings. Reject
out-of-scope/gold-plating fixes. The carried #1/#2 is the prime hunt — confirm it live and decide its chunk.
Founder-close AFTER ③.
