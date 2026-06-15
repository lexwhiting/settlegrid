# V-N2 — credit the ACTUAL settled value (reconciler-tail over-credit) — ① BUILDABLE HANDOFF (2026-06-14)

> Standalone handoff for the FRESH build session. Read this FIRST, before any code. HIGH-STAKES, real-USDC
> Base-mainnet prod, **local-build cadence — never push without explicit founder say-so.** Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). Source-of-truth register:
> `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N2 ≈ line 144). Prior chunk: V-N1 (②SEALED+③RE-CERTIFIED,
> pushed `origin/main` `2c777d94`).

---

## 0. Decision, tier, intent (RATIFIED by founder 2026-06-14)

- **Chunk:** V-N2 — the reconciler-tail credit pays a stale, frozen `amountCents` that can exceed the value
  actually collected on-chain, over-paying the developer in fiat (a platform loss). **Founder-chosen scope
  (2026-06-14): PREVENT (credit the actual settled value) + a DETECT/alert companion.** (Not detect-only; not
  the PATCH price-change guard — see §6 for why those were declined.)
- **Tier: HIGH-STAKES.** Triggers (record both in the ② handoff): (a) changes a **money invariant** — what
  value is credited and paid out as unclawbackable fiat; (b) touches the **frozen** credit path
  (`creditSettlement`) and the idempotent settlement writer (`recordSettlementEntry` ON CONFLICT DO NOTHING +
  the `markSettlement*` flip writers); (c) affects the **payout** pipeline (`developers.balanceCents` →
  `process-payouts` Stripe transfer). Uncertain→HIGH-STAKES applies regardless.
- **Intent (WHY this is built / who consumes it / what it enables):** SettleGrid credits a developer's
  `balanceCents` at settlement and pays it out as fiat (Stripe) ≤24h later, unclawbackably. The credit must
  equal the USDC actually collected on-chain. Today the **reconciler-tail** credit uses a value frozen at the
  pending row's first write, which can diverge from the value the settling transaction actually moved — so the
  platform can pay a developer more fiat than it collected in USDC. The consumer of the fix is the
  **payout/treasury integrity** of the platform: V-N2 makes "credited == collected" hold for the async credit
  path, closing a real fiat-loss vector and giving the founder a detection signal if it ever diverges again.

## 1. The problem (GROUNDED — verified against the live tree at `2c777d94`)

**Two credit trigger points** (`grep creditSettlement`):
1. **In-request** — `apps/web/src/app/api/circle-nano/settle/route.ts:204` credits `amountCents: costCents`
   (the cost computed IN THIS request, at settle time). ✅ CORRECT — no staleness (it bills the value it is
   settling now).
2. **Reconciler tail** — `apps/web/src/lib/settlement/reconcile.ts:198-204` credits
   `amountCents: row.amountCents` — the value **frozen** on the pending row at its FIRST write
   (`recordSettlementEntry` → `db.insert(ledgerEntries)...onConflictDoNothing()`, `ledger.ts:465`). ⚠ **THE
   VECTOR.**

> ⚠ **CORRECTION (pre-build audit, §13 finding A1) — supersede the next sentence:** an earlier draft claimed
> "x402 has NO in-request credit." **FALSE.** x402 *does* credit in-request via the proxy `forwardAndBill`
> (`proxy/[slug]/route.ts:1711-1734`, credits `actualCost = costCents` = current cost — CORRECT). The
> authoritative credit-site map (`credit-writer-census.test.ts`): **three in-request credits** (x402 proxy,
> circle-nano proxy, circle-nano kernel `/settle` — ALL at current cost, correct) **+ one reconciler tail**
> (the frozen-`amountCents` site — THE VECTOR). So the vector is narrowly **the reconciler-tail credit when the
> in-request credit was skipped** (the settle returned `pending` on timeout/crash), **for BOTH rails** — not
> "every x402 credit." The fix locus (reconcile.ts:198-204) is unchanged; see §13 for the full census + the
> corrected value-recording design.

**The over-credit sequence (reproducible; victim = the platform):**
- t0: buyer signs `(from, nonce, value=P1)` for a tool at price **P1**. A settle attempt writes a `pending`
  row with `amountCents = P1` (frozen). The attempt does **not** broadcast successfully → row stays `pending`,
  `external_ref` NULL.
- t1: the developer **lowers the price to P2 < P1** via `PATCH /api/tools/[id]` (route updates `pricingConfig`
  at `route.ts:248`; **no pending-settlement guard** — verified by reading the whole PATCH handler 203-280).
  The billable price lives in `pricingConfig` (the `costCents` fields are nested in `pricingConfigSchema`:
  `defaultCostCents` / `methods[].costCents` / `tiers[]` / `outcomeConfig`).
- t2: buyer re-signs the **same `(from, nonce)`** at `value=P2` (exact-amount verify requires
  `value == current cost == P2`); this broadcasts **P2** USDC on-chain and the row eventually confirms `settled`.
  `recordSettlementEntry` is first-write-wins, so `amountCents` STAYS **P1**.
- The reconciler tail confirms the P2 tx and credits `row.amountCents = P1` → developer credited P1 gross,
  paid out as fiat; only **P2** USDC collected. **Platform loss = (P1 − P2).** (Dev is credited GROSS at
  settle; the platform take is realized at payout — `lib/pricing.ts:calculateTakeCents`, `take_bps=0` at
  settle. So the gross over-credit is a direct treasury loss net of the take.)

## 2. ⚠ THE #1 LOAD-BEARING DECISION (where audit judgment concentrates — most likely to be silently wrong)

**Where does the "actual settled value" come from at reconciler-tail credit time, and how is it recorded
WITHOUT re-opening a DC-06 idempotent-writer trap?**

- The naive guard **does not work**: both `row.amountCents` AND `row.metadata.authorizedValueBaseUnits` are
  frozen at t0 by the SAME `ON CONFLICT DO NOTHING` (`x402/orchestrate.ts:166`, `circle-nano/settle.ts:30`), so
  they are **consistent-but-stale** (both P1). Comparing the two stored columns finds no divergence. The
  actually-collected value (P2) lives only in the **broadcast/settled transaction**.
- **Design direction to specify + audit:** record the **settled-tx value in cents** on the row at the point the
  settling tx is known — the broadcast/flip writers (`markSettlementBroadcast` `ledger.ts:642`,
  `markSettlementSettled` `ledger.ts:543`) are **UPDATE…WHERE pending** writers (NOT the frozen INSERT), so a
  new `settledAmountCents` (or equivalent) written there does **not** break the INSERT's first-write-wins
  freeze. The reconciler-tail credit then uses that settled value; `creditSettlement` keeps its single
  WHERE-pending flip gate so the once-only credit invariant is preserved.
- **The traps the ② audit MUST hunt (each can pass every test yet be wrong):**
  1. **DC-06 idempotent-writer / replay:** does writing the settled value at broadcast/flip interact with the
     recovery path (a re-broadcast that re-points `external_ref`, `ledger.ts:576`)? A re-sign at a NEW value
     that re-broadcasts must update the settled value coherently, and a concurrent loser / idempotent replay
     must not double-credit. The once-only credit gate (the WHERE-pending flip) must remain the sole arbiter.
  2. **Units & rounding:** `amountCents` is CENTS; the on-chain value is USDC base units. The conversion
     (`USDC_BASE_UNITS_PER_CENT`) and its rounding direction must not introduce a sub-cent over/under-credit
     or a new mismatch. (Confirm the constant + its existing use; pick a rounding rule and state it.)
  3. **Legacy/in-flight rows:** rows already `pending`/`settled` BEFORE the new field exists have no recorded
     settled value. The reconciler-tail credit must fall back safely (credit `amountCents` as today, or
     quarantine) — never `NULL`-credit or throw. (Prod `ledger_entries` is currently EMPTY per the V-N1 §5
     census, so the legacy population may be zero — RE-VERIFY at build; if empty, the migration risk is moot
     but the code must still be correct for the post-deploy in-flight window.)
  4. **The detect companion's truthfulness (DC-18):** the alert must fire on a REAL divergence (settled value
     ≠ frozen `amountCents`) and not false-fire on the legitimate `value ≥ cost` overpay case the verifier
     still allows on non-exact circle-nano (confirm whether exact-amount is now universal — the money-mechanics
     chunk made circle-nano enforce `value === cost`; x402 exact too — so a divergence SHOULD be anomalous).

## 3. Scope — exactly what to build (and what NOT to)

**BUILD:**
- **Prevent:** make the **reconciler-tail credit** (`reconcile.ts:198-204`) credit the **actual settled
  value**, sourced per §2 (recorded at broadcast/flip; converted to cents). The in-request circle-nano credit
  (`route.ts:204`) already uses the current cost — leave it, but VERIFY it stays correct under the new field.
- **Detect:** emit a structured alert (Sentry-mirrored, ERROR-level per the project's detector convention)
  when the settled value diverges from the frozen `amountCents` beyond a sub-cent tolerance — at the credit
  seam, so it catches both the prevented case (as a signal) and any future regression.
- Tests (DC-05): a settle-then-lower-price-then-re-sign reproduction proving the reconciler now credits P2 (not
  P1); the divergence-alert firing; the legacy/no-field fallback; units/rounding boundary; the once-only credit
  invariant intact (no double-credit on idempotent replay / concurrent loser).

**DO NOT build (reject scope creep):**
- The PATCH price-change guard (§6 — declined as primary; a later defense-in-depth option).
- Any change to the **frozen** V-N1 cap, the (V)/(V-N4)-sealed reconciler **expiry** pass
  (`runExpiryPass`/`markSettlementExpiredNoBroadcast`/`refreshPendingValidBefore`), EIP-712 recovery, the
  payout/Stripe pipeline, or the price-derivation logic.
- The R1 refresh `createdAt`-ceiling (different seam — the V-N1 ③ ratchet follow-up) and V-N3-erasure (PII) —
  NOT merged (see §7).

## 4. Frozen / existing surfaces to build ON (do not perturb without authorization)

- `recordSettlementEntry` INSERT + its `ON CONFLICT DO NOTHING` freeze (`ledger.ts:408-468`) — the first-write
  freeze is load-bearing for replay-safety; V-N2 adds the settled value via the UPDATE writers, NOT by mutating
  the INSERT freeze.
- The reconciler **expiry** pass + its evidence-CAS writers (V/V-N4 sealed). V-N2 touches the **credit** arm
  (`processReconcileOutcome`/`creditSettlement`), NOT the expiry/terminalization arm.
- `creditSettlement`'s **once-only WHERE-pending flip gate** + its `developerId`/`amountCents>0` guard
  (`reconcile.ts:308-360`) — preserve the gate; change only the value sourced into it.
- The V-N1 `validBefore` cap (just shipped) — independent; leave intact.

## 5. Test blast-radius + gate (DC-05)

- Real credit/settle tests likely under `apps/web/src/lib/settlement/__tests__/` + `reconcile*.test.ts` +
  `circle-nano/__tests__/settle*.test.ts` + the proxy settlement tests. LOCATE BY CONTENT. Any fixture that
  asserts the reconciler credits `row.amountCents` must migrate to the new settled-value basis; prove
  non-vacuity (revert the source → the new credit-value test goes RED).
- **Gate (run FULL, green, both packages):** `cd packages/mcp && npm run build && npm test && npm run lint`;
  `cd apps/web && npx tsc --noEmit && npm run lint && npm test`. Record the floor (current: apps/web
  **4449/191/0**, mcp **1898/1**) and the post counts.

## 6. Why the other two options were declined (founder-ratified)

- **Detect-only:** leaves the loss occurring (only observed). For real, unclawbackable fiat, prevention is
  warranted; the detect ships as the companion, not the whole fix.
- **PATCH price-change guard:** indirect — it closes the *precondition* but not the root decoupling (a frozen
  credit basis ≠ collected value), and it touches the developer-facing tool API (could block legit price
  changes; post-V-N1 the block would be ≤1h since pending rows now expire ≤1h — so it remains a viable LATER
  defense-in-depth, but not the primary fix).

## 7. Sizing / merge decision (stated explicitly)

**V-N2 stays as a single focused chunk: prevent + detect on the credit seam.** NOT merged with R1 (refresh
`createdAt`-ceiling — a different seam: the `validBefore` refresh, not the credit value), V-N3-erasure (PII /
`operation_id` dedup — different invariant), or the V-N5/6/7 ops/hygiene/buyer-facing bundles. Merging would
fold unrelated seams into a high-stakes money audit and blur the single "credited == collected" invariant the
seal must certify. The detect companion IS in-scope (same seam, same invariant, one spec states "done" for both).

## 8. Lifecycle + defect classes

- **Lifecycle:** scope-confirm (this file) → draft plan (this file §2-§3) → **pre-build plan audit (runs in the
  ① session, closes before any build code)** → build → executable gate → ② seal-gating review → seal +
  bookkeeping. Founder-close (LOCAL commit, never push) at the end.
- **Defect classes to fold into the lens charges** (`.audit/defect-ledger/INDEX.md`): **DC-01**
  (settlement billing non-atomicity / credited-without-collection), **DC-06** (idempotent-writer trap — the #1
  decision), **DC-18** (the detect alert's truthfulness), **DC-05** (test-fixture migration), **DC-12**
  (units/rounding boundary), **DC-14** (legacy-row/migration fallback), **DC-15** (any doc/contract claim).

---

## 13. PRE-BUILD PLAN AUDIT — disposition + FOLDED findings (2026-06-15) — THIS SECTION IS AUTHORITATIVE

A HIGH-STAKES pre-build plan audit ran as a 3-lens independent Agent-tool fan-out (NOT a workflow — operator
did not opt in), all reviewers `claude-opus-4-8`, coverage mode: (1) money-correctness/credit-invariant,
(2) completeness/scope/migration, (3) units-rounding/detect-truthfulness. Every mechanically-checkable claim was
settled with live probes first and fed in. **29 findings total (incl. 3 BLOCKER + 8 HIGH); 0 invalidate the
chunk — all FOLD into a sharper spec.** Each load-bearing correction was re-confirmed LIVE by the integrator
before folding (the credit census, `confirmSettlementTx`-returns-only-`txHash`, the writer signatures,
`exactAmount` universality, the freeze, the floor precedent). Where §1-§8 conflict with §13, **§13 wins.**

### 13.A — CORRECTED credit-site census (finding A1, HIGH, all 3 lenses)
Authoritative source: `apps/web/src/lib/settlement/__tests__/credit-writer-census.test.ts` (a BUILD-GATE —
`expect(found).toEqual(CENSUS)`). Sites that increment `developers.balanceCents`:
- **In-request, CURRENT cost (CORRECT — leave them):** x402 proxy `forwardAndBill` (`proxy/[slug]/route.ts:1711-1734`);
  circle-nano proxy `forwardAndBill`; circle-nano kernel `/settle` (`circle-nano/settle/route.ts:204`). All credit
  `actualCost = costCents` (the request-time cost). They do NOT read the frozen field → unaffected by V-N2; ②
  must assert they stay GREEN (non-regression).
- **Reconciler tail (THE ONLY STALE SITE — the vector):** `reconcile.ts:198-204`, credits `row.amountCents`.
- **Out of scope, enumerate-and-fence (finding L):** sessions `processSettlementBatch` (`sessions.ts:691-699`,
  pooled non-on-chain disbursement — on-chain hops are excluded by construction at `sessions.ts:472-488`);
  prepaid `consumerToolBalances`→dev (`route.ts:696-700`, current cost); AP2 settle (`ap2/settle/route.ts:176`,
  writes an audit-only `recordSettlementEntry` row, credits NOTHING). State each reason so the ② census is
  provably complete, not reliant on an under-inclusive grep.

### 13.B — THE VALUE SOURCE + RECORDING (findings B/C, BLOCKER+HIGH — the #1 decision, now pinned)
- The actually-collected value ≡ `proof.authorization.value` of the tx that BROADCAST (EIP-3009 moves exactly
  `value`; `settle-engine.ts:217`). The confirm result carries **only `{kind:'settled', txHash}`** — NO amount
  (`settle-engine.ts:75`). So the reconciler tail (which confirms by hash) has NO independent access to the value.
- **MUST source the settled value from the in-flight BROADCASTING proof — NEVER from a stored row column.** Both
  `row.amountCents` AND `row.metadata.authorizedValueBaseUnits` are frozen at t0 by the first-write-wins INSERT
  (re-sign does NOT update them), so reading either re-credits P1 and **every test still passes** (the silent-fail
  trap). `metadata.authorizedValueBaseUnits` is FORBIDDEN as the source/alert-basis (it == frozen amountCents →
  vacuous). Name the new field DISTINCTLY (e.g. `metadata.settledValueBaseUnits`) to prevent the mix-up.
- **Record it AT BROADCAST, in the SAME UPDATE that sets `external_ref`** (`markSettlementBroadcast`, `ledger.ts:642`),
  so value and tx-hash are atomically paired (a recovery re-point updates both together). Thread it as a new param
  (`settledValueBaseUnits`) from the orchestrators' `onBroadcast` (`settle.ts:321`, `orchestrate.ts:447`) — both
  `onBroadcast` and `markSettlementBroadcast` (and `markSettlementSettled` for the in-request submit→confirm path
  that calls it WITH the proof in scope) gain the param. ⚠ These are (V)/(T)-SEALED write-ahead writers — bring
  their seal invariants (no-clobber CAS, WHERE-pending, settled-at-shape) into the ② charge; the added SET must
  not perturb them. The jsonb merge must be NULL-safe: `COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(...)`.
- **The reconciler READS the recorded value off the row** (add the new field to the `reconcileOneRow` SELECT,
  `reconcile.ts:~901-914`, + `ReconcilableRow`) and passes the floored cents into `creditSettlement`. The
  reconciler's `markSettlementSettled` call does NOT supply a value (no proof in scope).

### 13.C — CREDIT UNCONDITIONALLY THE SETTLED VALUE — reject min/max (finding E, HIGH/MED)
Resolve §3's fork: credit the actual settled value **unconditionally**. Under universal `exactAmount` (13.D),
settled == what the buyer paid, so it is correct in BOTH price directions: price-LOWERED (P2<P1) stops the
over-credit; price-RAISED (P2>P1) stops a symmetric UNDER-credit (today shorts the dev). `min(cost, settled)` is
REJECTED: the tail has no current-cost to min against, and `min(frozenCost=P1, settled)` preserves the raise
under-credit. Add BOTH a price-lower AND a price-raise reproduction test (mirror), proving symmetry.

### 13.D — `exactAmount:true` is the load-bearing INVARIANT DEPENDENCY (finding F, MED, all 3) — guard it
Verified live: the ONLY two non-test verifier callers hardcode `exactAmount:true` (x402 `orchestrate.ts:348`;
circle-nano `circle-nano-proxy.ts:120` = the sole wrapper for proxy + kernel verify + kernel settle). So in prod
`value === requiredBaseUnits === costCents × 10_000` exactly. BUT the verifier's non-exact `value >= required`
branch (`circle-nano/verify.ts:201`) is LIVE-but-callerless and the param DEFAULTS falsy. "Credit settled value"
is correct ONLY while exact is universal; a future non-exact caller would over-credit a legit overpay. **Add a
census/guard test that FAILS if any verifier caller omits `exactAmount:true`** (mirror of credit-writer-census).
Record the dependency in the plan + the detect companion's contingency on it.

### 13.E — UNITS/ROUNDING (findings G1-G3, BLOCKER) — state the rule verbatim
- Store the settled value as **integer BASE UNITS** (lossless). Convert at credit/alert with **BigInt FLOOR**:
  `Number(settledBaseUnits / USDC_BASE_UNITS_PER_CENT)` where `USDC_BASE_UNITS_PER_CENT = 10_000n` (existing
  literal; floor precedent `packages/client/src/protocols/x402.ts:88` — "sub-cent truncates down, conservative
  seller-side"). FLOOR is the only funds-safe direction (round/ceil over-credit a sub-cent the platform didn't
  collect). Divide in BigInt BEFORE `Number()` (a `value` > 2^53 loses precision; `amount_cents` is a 4-byte int
  with a `>0` CHECK). **Overflow guard:** if `cents > Number.MAX_SAFE_INTEGER` (or > int4 max) → reject + alert,
  do NOT silently `Number()`. Under exact-amount the floored result == frozen `amountCents` exactly (alert silent
  on the happy path). NEVER compare or credit a raw base-unit value against a cents column (off-by-10_000×).

### 13.F — THE DETECT COMPANION (findings H + units-lens detect set, HIGH/MED)
- Fire at the **BROADCAST seam** (where the broadcasting proof's P2 AND the frozen `amountCents` P1 coexist) —
  NOT the reconciler tail (structurally blind: only P1-vs-P1). Persist the value there; the alert reads the
  broadcasting proof, never a row column.
- Predicate: `logger.error` (Sentry-mirrored — `logger.error` is the money-incident convention) **ONLY on the
  LOSS direction** `floor(settledCents) < frozen amountCents`. The price-RAISE / overpay direction
  (`settled > frozen`) is NOT this incident → route to info/warn or a separate key (alarm-fatigue — the (V)/(S)
  lesson). Exact integer-cents `<` (no float epsilon "tolerance" — both sides are integer cents). A floored
  `settledCents === 0` defers to the existing `credit_skipped_no_data` guard (`reconcile.ts:317`) — no double-page.

### 13.G — LEGACY / IN-FLIGHT FALLBACK (finding I, MED) — fall back WITH a signal
Rows broadcast BEFORE the field exists, confirmed AFTER deploy, have a NULL settled field. Fallback =
`metadata.settledValueBaseUnits ?? row.amountCents` (NOT `?? null`); the `creditSettlement` guard makes a
fallback-to-`amountCents` safe (no NULL-credit/throw). BUT this re-creates the vector for that bounded window, so
emit the detector in **"legacy-fallback" mode** (a distinct structured warn: "credited frozen amountCents —
settled value unrecorded, pre-deploy row") so the residual is observable. Bound: V-N1 now caps pending ≤1h, so
the window is ~1h of pre-deploy rows. Prod `ledger_entries` re-confirmed EMPTY (V-N1 §5 census → backfill moot) —
**RE-VERIFY at build** (circle-nano is dark; x402 may be live). Add a test: NULL field → credits amountCents + logs
the legacy-fallback signal.

### 13.H — STORAGE = metadata JSONB, no migration (finding J, LOW, all 3) — DECISION
Store `settledValueBaseUnits` as a **metadata JSONB key** via the COALESCE-jsonb-merge the existing UPDATE writers
use (`markSettlementExpiredNoBroadcast`/`refreshPendingValidBefore`) — **no new column, no migration `0017`, no
INSERT-shape change, no schema-doc (DC-15)**, matching the `validBefore`/`authorizedValueBaseUnits` precedent.
(`schema.ts:918-920` warns a deploy-first non-null column = a settlement-admission OUTAGE — avoid entirely.) If a
typed column is ever chosen instead, mandate migrate-first ordering + nullable + the DC-15 schema-doc.

### 13.I — DC-06 RECOVERY COHERENCE INVARIANT (finding D, HIGH) — state + test
The recorded value is only CONSUMED for a credit when the row flips `settled` via `markSettlementSettled` keyed to
the `external_ref` whose value was recorded, and the flip happens ONLY on a confirmed `success`. A reverted-tx row
never flips settled → never credits → the recorded value is never wrongly consumed via the automated path. ⚠ The
genuinely subtle case: re-point external_ref→txB(P2), txB reverts because txA(P1) confirmed concurrently
(nonce-consumed) → row goes `pending-nonce-consumed`, stays pending, **never auto-credits** (safe) — but the
recorded `settledValueBaseUnits=P2` is then NON-AUTHORITATIVE (the real settler txA moved P1). **Runbook note:** a
manual credit of a `pending-nonce-consumed` row must read the on-chain Transfer log, NOT the row's settled field.
Add a test for this exact sequence proving NO auto-credit fires and the row stays pending.

### 13.J — TEST BLAST-RADIUS + BUILD-GATES (findings K/N, MED) — deliberate, not flailed-green
- `credit-writer-census.test.ts` is a BUILD-GATE: threading the new param must update its CENSUS allowlist
  DELIBERATELY (keep the single `reconcile.ts` balanceCents site; every `creditSettlement` still passes `rail`).
- `billing-credits.test.ts` pins the in-request increment regex — extend ONLY if the proxy credit changes (it
  should NOT; it uses current cost → stays GREEN as a non-regression assertion).
- `reconcile.test.ts:345,374` literally assert "credits … by amountCents" (`amountCents: 50`) → MIGRATE to the
  settled-value basis; prove non-vacuity (revert source → RED).
- Consume the settled value INSIDE the existing credit transaction so the `credited_at` marker commits iff the
  credit commits at that value (the (T) honesty contract, `reconcile.ts:366-380`).

### 13.K — Disposition: confirmed-sound (the lenses concur)
Fix locus (reconcile.ts tail) correct; freeze analysis correct; once-only WHERE-pending flip preserved as the sole
credit arbiter (value only READ into `creditSettlement`, no new credit path); end-to-end loss path real
(credit→balanceCents→process-payouts ≤24h unclawbackable); scope exclusions coherent (expiry pass, V-N1 cap,
EIP-712, payout, PATCH-guard all correctly fenced); record-at-broadcast the right instinct. Detect companion
correctly IN; R1/V-N3-erasure correctly NOT merged; PATCH-guard correctly OUT.

### 13.L — Build-ready checklist (post-fold)
1. New `metadata.settledValueBaseUnits` written at `markSettlementBroadcast` (same UPDATE as external_ref) +
   `markSettlementSettled` (in-request path), threaded from `onBroadcast`'s proof value; NULL-safe jsonb merge.
2. Reconciler tail reads it (SELECT + `ReconcilableRow`), floors to cents via BigInt, credits unconditionally;
   fallback `?? amountCents` + legacy-fallback signal.
3. Detect at broadcast: `logger.error` on `floor(settledCents) < amountCents`; info/warn on the raise direction.
4. `exactAmount:true` census-guard test; price-lower + price-raise + nonce-consumed-recovery + legacy-fallback +
   units-boundary tests; migrate `reconcile.test.ts:345/374`; update `credit-writer-census.test.ts` CENSUS.
5. Full gate green both packages (floor apps/web 4449/191/0, mcp 1898/1); record post counts. Runbook note (13.I).
