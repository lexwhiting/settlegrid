# V-N2 — credit the ACTUAL settled value — BUILD RECORD (2026-06-15)

> Build-session output for the ② seal-gating review. HIGH-STAKES (money invariant + frozen credit
> path + payout). LOCAL working tree atop V-N1 `2c777d94`, **NOT committed / pushed** (founder-gated).
> Spec = `v-n2-credit-actual-settled-value-handoff-2026-06-14.md` **§13** (authoritative folded). Where
> §1–§8 conflict with §13, §13 wins.

## What was built (the invariant)

The reconciler-tail credit (`reconcile.ts`) paid the **frozen** first-write `amountCents` (frozen by
`recordSettlementEntry`'s `ON CONFLICT DO NOTHING` INSERT). A same-`(from,nonce)` re-sign under a tool price
change between the pending row's first write and a later broadcast makes that frozen value diverge from the
USDC the settling tx actually moved — over-crediting on a price LOWER, under-crediting on a price RAISE. The
credit is paid out as unclawbackable fiat ≤24h later, so the gross over-credit is a direct treasury loss.

**Fix:** the reconciler now credits the **actually-collected value**, sourced from the IN-FLIGHT broadcasting
proof's `authorization.value` (EIP-3009 `transferWithAuthorization` moves EXACTLY `value`), recorded at
broadcast and READ back by the reconciler. Plus a broadcast-seam detect companion.

## The load-bearing decisions (§13.B/.C/.D/.E/.F/.G/.H/.I) — as built

1. **Source (§13.B):** value = `proof.authorization.value`, recorded in the SAME UPDATE that sets
   `external_ref` (`markSettlementBroadcast`) keyed to the broadcasting tx hash, under the DISTINCT metadata
   key `settledValueBaseUnits` (NEVER the frozen `amountCents` / `metadata.authorizedValueBaseUnits` — both
   frozen-stale → the silent-fail trap). The reconciler READS `metadata.settledValueBaseUnits` off the row
   (it has no proof; `confirmSettlementTx` returns only `{kind,txHash}`). `markSettlementSettled` also gains
   the optional value for the in-request submit→confirm path (atomic value↔ref pairing if the broadcast CAS
   was rejected); the reconciler and the recovery confirm path OMIT it (so a prior-recorded value is never
   overwritten with this request's possibly-resigned value).
2. **Unconditional credit (§13.C):** the reconciler credits the floored settled value — NO min/max. Correct
   in BOTH directions under universal `exactAmount` (lower → stops over-credit; raise → stops under-credit).
3. **`exactAmount` dependency (§13.D):** correct ONLY while `exactAmount:true` is universal. New build-gate
   `verifier-exactamount-census.test.ts` fails if any non-test `verify{Eip3009,CircleNano}Authorization`
   caller omits it (both prod callers — x402 orchestrate, circle-nano-proxy — pinned).
4. **Units/floor (§13.E):** `settledBaseUnitsToCents` — `BigInt(value) / 10_000n` (FLOOR; only funds-safe
   direction), BigInt-divided BEFORE `Number()`, rejects negative and `cents > Number.MAX_SAFE_INTEGER`
   (→ null → reject + alert, never silent `Number()`). Mirrors the `packages/client/x402.ts` seller floor.
5. **Detect (§13.F):** at the BROADCAST seam (where P2-from-proof and P1-frozen-amountCents coexist; the
   reconciler tail is structurally P1-vs-P1 blind). `logger.error settlement.settled_value_below_frozen` on
   the LOSS direction only; `logger.warn ..._above_frozen` on raise (off the page); silent when equal; silent
   when `settledCents === 0` (defers to `credit_skipped_no_data`). Best-effort, never throws.
6. **Legacy/in-flight (§13.G):** NULL field → fall back `?? amountCents` (NOT null) + distinct
   `settlement.settled_value_legacy_fallback` warn (the residual is observable; bounded ≤~1h by the V-N1 cap).
7. **No migration (§13.H):** stored as a metadata JSONB key via `COALESCE(metadata,'{}'::jsonb) ||
   jsonb_build_object('settledValueBaseUnits', …::text)`. No column, no migration, no INSERT-shape change.
8. **DC-06 recovery coherence (§13.I):** a reverted-but-nonce-consumed row NEVER auto-credits (stays
   `pending-nonce-consumed`); its recorded value is non-authoritative and is never auto-consumed (test +
   runbook: manual repair reads the on-chain Transfer, not the field).

## Frozen-surface discipline

`markSettlementBroadcast` / `markSettlementSettled` are (V)/(T)-sealed write-ahead writers. The added
`settledValueBaseUnits` param is OPTIONAL; when omitted the `.set(...)` is byte-identical to pre-V-N2 and the
WHERE/CAS (no-clobber `or(isNull,=txHash,=expectedPriorRef)` + WHERE-pending) is UNCHANGED in both branches.
The `applyOutcome` reverted-nonce-consumed / broadcast-unconfirmed `markSettlementBroadcast` calls pass NO
value (they don't re-point to a new tx — the value already paired with the ref stands). `terminal-transition`
+ `credit-writer-census` pass unchanged (non-perturbation evidence).

## Files (10) — diff scope, credit seam only

Source (5): `settlement/settled-value.ts` (NEW: floor + detect helpers) · `settlement/ledger.ts`
(findSettlementRow +amountCents; optional value param on the 2 writers) · `settlement/x402/orchestrate.ts` ·
`settlement/circle-nano/settle.ts` (onBroadcast value+detect; fresh-submit applyOutcome passes value) ·
`settlement/reconcile.ts` (credit block). Test (5): `reconcile.test.ts` (migrated 345/374 + credit_failed;
+(V-N2) block) · `circle-nano/settle.test.ts` · `x402/orchestrate.test.ts` (writer-arg assertions) · NEW
`settled-value.test.ts` · NEW `verifier-exactamount-census.test.ts`.

## Evidence (grounded in this session's runs)

- **Independent fresh-context verifier vs §13:** ALL 9 load-bearing claims CONFIRMED (incl. DC-06 recovery
  coherence — value supplied on fresh submit, OMITTED on recovery confirm + reconciler); 0 deviations.
- **Non-vacuity:** reverting the credit value to `row.amountCents` → exactly **6 RED** (2 migrations +
  credit_failed amount + price-lower + price-raise + units-floor); legacy/overflow/nonce-consumed correctly
  stay green (value-independent); source restored byte-clean (full suite re-green).
- **Gate (FULL, both packages):**
  - apps/web: `tsc` 0 · `lint` 0 errors (warnings only) · `vitest` **4468 passed / 0 skipped / 0 failed**
    (193 files) = recorded floor 4449 + 19 new V-N2 tests.
  - packages/mcp (UNTOUCHED by this diff): `build` 0 · `vitest` **1898 passed / 1 skipped** · `lint` 0 errors.
  - ⚠ The memory floor's "191 skipped" for apps/web is STALE — `grep` finds 0 skip markers in `src`, and
    mcp's 1-skip confirms vitest reports skips when present, so apps/web genuinely has 0 skipped. The reliable
    anchor is the PASSED delta (4449 → 4468 = +19, exactly the new tests) with 0 failures.

## Defect-class charge for ②

DC-01 (credited-without-collection — the chunk's core) · **DC-06** (idempotent-writer trap — the #1 decision:
value from the in-flight proof not the frozen row; recovery coherence) · DC-12 (units/floor boundary) · DC-14
(legacy-row fallback, no migration) · DC-18 (detect truthfulness — loss-only error, raise→warn) · DC-05 (test
migration non-vacuity) · DC-15 (doc/contract).

## Effort note (directive (i))

The DC-06 recovery-coherence / value-recording-atomicity proof (§13.B/.I) was the genuinely subtle stretch.
It was carried at `xhigh` and independently confirmed by the fresh-context verifier; flagged here for the ②
review to scrutinize specifically (the fresh-submit-supplies / recovery-omits-value split and the
reverted-nonce-consumed non-auto-credit).

## NEXT

② seal-gating review (HIGH-STAKES) → founder-close (path-scoped LOCAL commit, NEVER push).
