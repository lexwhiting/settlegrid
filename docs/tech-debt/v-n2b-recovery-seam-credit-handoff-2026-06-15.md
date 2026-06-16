# V-N2b — credit the ACTUAL settled value on the IN-REQUEST path (recovery-seam credit) — ① BUILDABLE HANDOFF (2026-06-15)

> Standalone handoff for the FRESH build session. Read this FIRST, before any code. HIGH-STAKES, real-USDC
> Base-mainnet prod, **local-build cadence — never push without explicit founder say-so.** Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). Build base = clean `main`
> @ `43add9b7` (V-N2 committed local, NOT pushed). Source-of-truth register:
> `docs/tech-debt/s-deep-audit-register-2026-06-10.md`. This chunk is the **carried #2** from V-N2's ②/③.

---

## 0. Decision, tier, intent

- **Chunk:** V-N2b — the **in-request RECOVERY-CONFIRM credit** (`forwardAndBill` on-chain twin + kernel
  `/settle`) pays the CURRENT request's `costCents` while the PRIOR broadcast tx it confirmed actually moved a
  different value. V-N2 fixed the *reconciler tail* to credit the recorded settled value; this chunk closes the
  SAME invariant on the *in-request* (live) credit path that V-N2 deliberately fenced out.
- **Founder-chosen scope:** make the in-request on-chain credit pay the **actual settled value** (the value of
  the tx on `external_ref` that confirmed), sourced from the row's `metadata.settledValueBaseUnits` (recorded by
  V-N2 at broadcast), floored to cents — mirroring the reconciler — with the same fallback + signal; **plus**
  extend the divergence **detector to the recovery seam** (today it fires only at onBroadcast/fresh-submit).
- **Tier: HIGH-STAKES.** Triggers (record in the ② handoff): (a) **money invariant** — what value is credited
  and paid out as unclawbackable fiat; (b) touches the **(T)-sealed `forwardAndBill` credit writer** + the kernel
  `/settle` credit + the (V)/(T)-sealed orchestrator outcome/return semantics; (c) affects the **payout** pipeline
  (`developers.balanceCents` → `process-payouts`). Uncertain → HIGH-STAKES applies regardless.
- **Intent (WHY / who consumes / what it enables):** SettleGrid credits a developer's `balanceCents` at settlement
  and pays it out as fiat ≤24h later, unclawbackably. The credit MUST equal the USDC actually collected on-chain.
  V-N2 made "credited == collected" hold for the ASYNC (reconciler) path; the ②/③ then discovered the LIVE
  recovery-confirm path still credits `costCents` (re-sign-same-nonce-at-new-price → recovery confirms the prior
  tx → credits the wrong value), AND is **detector-blind** (no detect on recovery) and **sweep-masked** (the
  `credited_at` marker marks the wrong-amount credit "resolved", so the uncredited sweep never flags it). The
  consumer of this fix is platform **treasury integrity**: it makes "credited == collected" hold platform-wide,
  closing the last reachable over/under-credit vector in the V-N2 family.

## 1. The problem (GROUNDED against the live tree @ 43add9b7)

Three on-chain credit surfaces today (post-V-N2):
1. **Reconciler tail** (`reconcile.ts:185-251`) — CORRECT post-V-N2: reads `metadata.settledValueBaseUnits`,
   `settledBaseUnitsToCents`, credits unconditionally + fallback.
2. **Proxy `forwardAndBill` (T)-transactional twin** (`apps/web/src/app/api/proxy/[slug]/route.ts:1697-1760`)
   — credits `actualCost = costCents` (`:1695`), in one txn with the `credited_at` marker (`:1713` balance,
   `:1720` tool, `:1724` marker), gated by `isReplay = outcome.alreadySettled === true → skipCredit` (`:1958`).
   ⚠ THE VECTOR (live).
3. **Kernel `/settle`** (`apps/web/src/app/api/circle-nano/settle/route.ts:204-211`) — credits
   `amountCents: costCents`. ⚠ same vector via the kernel surface.

**The over/under-credit sequence (reproducible; victim = platform on a raise, developer on a lower):**
- t0: buyer signs `(from,nonce,value=P1)`; a settle broadcasts txA (moves P1), times out → row `pending`,
  `external_ref=txA`, `metadata.settledValueBaseUnits=P1` (recorded by V-N2's onBroadcast), `amount_cents=P1`.
- t1: developer changes the tool price to P2 (`PATCH /api/tools/[id]`, no pending guard).
- t2: buyer re-signs the SAME `(from,nonce)` at `value=P2` and retries through the proxy. Verify passes
  (`exactAmount`: value==P2). Step-5 RECOVERY confirms the stored `external_ref=txA` → `confirmed.kind==='settled'`
  → `applyOutcome(operationId, confirmed, existing.externalRef)` (recovery, no value arg — `orchestrate.ts:441` /
  `settle.ts:382`) → `markSettlementSettled` flips → returns `{status:'settled'}` **WITHOUT `alreadySettled`** →
  `isReplay=false` → `forwardAndBill` credits `actualCost=costCents=P2`. **txA moved P1; dev credited P2.**
  Over-credit (P1−P2 platform loss) if price raised; short-pay if lowered. Paid as unclawbackable fiat ≤24h.
- Reachability: buyer-controlled (the wallet picks the nonce + value; EIP-3009 lets the same unconsumed nonce be
  re-signed at any value); narrow (needs nonce-reuse + price-change + the original broadcast-then-timeout), but a
  real money path. The recorded `settledValueBaseUnits=P1` (the CORRECT value) is already on the row — the live
  credit just doesn't read it.
- Observability gaps (③): the detector runs only at onBroadcast (`orchestrate.ts:476` / `settle.ts:349`), so the
  recovery path emits NO `settled_value_below_frozen`; and the `credited_at` marker marks the wrong-amount credit
  resolved, so `reconcile.uncredited_settled` never flags it. Both are closed by fixing the credit value (no more
  wrong credit to detect/sweep) PLUS adding a recovery-seam detect for forward-looking signal.

## 2. ⚠ THE LOAD-BEARING DECISIONS (where audit judgment concentrates — most likely to be silently wrong)

> ⚠ **SUPERSEDED IN PART BY §7** (plan-audit resolutions). §7 reverses Decision A's "fallback to `costCents`"
> (→ credit-or-DEFER, never guess), names the read-WHERE (fresh = proof value; recovery = re-read after the flip),
> and is the authoritative build spec. Read §7 before building from §2/§3.

**Decision A — WHERE the in-request credit value comes from, and that it equals the SETTLED tx's value for BOTH
fresh-submit AND recovery-confirm.** The credit must use the value of the tx on `external_ref` that actually
confirmed `success`. V-N2 records exactly that at `markSettlementBroadcast` into `metadata.settledValueBaseUnits`,
keyed to `external_ref`. So the in-request credit must **read `metadata.settledValueBaseUnits` off the row and
credit `settledBaseUnitsToCents(it)`** — NOT `costCents`. Why this is correct in both cases:
- Fresh-submit: the row's `settledValueBaseUnits` == this proof's value == `costCents` (exact) → credit unchanged
  on the happy path (non-regression).
- Recovery-confirm: the row's `settledValueBaseUnits` == the PRIOR tx's value (recorded at ITS broadcast) == what
  txA moved → credits the collected value (the fix). 
- The SILENT-WRONG trap: crediting `costCents` (current) — correct on fresh-submit, wrong on recovery; OR reading
  the frozen `amount_cents` (stale, == P1 first-write) instead of `settledValueBaseUnits` (== the settled tx).
  Mirror the reconciler exactly (`reconcile.ts:210/226`): `meta?.[SETTLED_VALUE_BASE_UNITS_KEY]` →
  `settledBaseUnitsToCents` → fallback to `costCents` (NOT `amount_cents`, since the in-request path's
  request-time cost is the best fallback) + a distinct legacy-fallback signal when the field is absent.
  **Sub-decision: WHERE to read it.** Two options — (i) the orchestrator threads the settled value into the
  `settled` outcome (`{status:'settled'; txHash; alreadySettled?; settledValueBaseUnits?}`) so the proxy/kernel
  credit it; or (ii) `forwardAndBill`/kernel read the row directly (extend `findSettlementRow` to return
  `metadata`, or a dedicated read). Recommend (i) for x402/circle-nano proxy + kernel (single source: the
  orchestrator already holds/【reads the row】), with (ii) as the fallback if the outcome can't carry it. Name the
  chosen path in the build and keep it consistent across both rails + the kernel.

**Decision B — exactAmount dependency + fallback + exactly-once preservation.** Crediting the recorded settled
value is correct ONLY while `exactAmount:true` is universal (same dependency V-N2 pinned — `verifier-exactamount-census.test.ts`).
The fallback when `settledValueBaseUnits` is absent (legacy/in-flight) must keep the OLD behavior (credit
`costCents`) + emit a distinct signal — never NULL-credit/throw. The **exactly-once gate is FROZEN**: the credit
still fires only on the flip-winner (`alreadySettled→skipCredit` unchanged); the change is ONLY the value
credited, never a new credit path or a second balanceCents site. The `credited_at` marker + `rail` pass-through
stay (keep `credit-writer-census.test.ts` GREEN — same site count, marker preserved).

## 3. Scope — exactly what to build (and what NOT to)

> ⚠ **SUPERSEDED IN PART BY §7.** Key reversals: the recovery-seam **detector is DESCOPED to DC-18** (§7.8, NOT
> built here); the in-request fallback is **defer-not-guess** (§7 pivot); the handler **bridge** (§7.4),
> `billing-credits` gate migration (§7.5), kernel test dir (§7.6), and `recordProtocolInvocation`→settled (§7.10)
> are ADDED. Build the §7 test list, not the §3 one, where they differ.

**BUILD:**
- Make the **in-request on-chain credit** pay `settledBaseUnitsToCents(row.settledValueBaseUnits)` instead of
  `costCents`, at: `forwardAndBill`'s (T)-transactional settlement twin (`route.ts:1713/1720`) AND kernel
  `/settle` (`route.ts:207`). Source per Decision A. Fallback to `costCents` + a distinct legacy-fallback signal
  when the field is absent. Floor/overflow via the existing `settledBaseUnitsToCents`.
- Extend `detectSettledValueDivergence` to the **recovery-confirm seam** (so a recovery-settled divergence emits
  the loss-direction signal, mirroring §13.F; reuse the existing helper).
- Tests (DC-05): a price-LOWER recovery-confirm reproduction (live credits the recorded value, not `costCents`);
  a price-RAISE mirror; the fresh-submit non-regression (credits the recorded value == `costCents`); legacy
  fallback (no recorded value → `costCents` + signal); the exactly-once gate intact (no double-credit on replay /
  concurrent winner); `credit-writer-census` + `verifier-exactamount-census` stay GREEN. Prove non-vacuity
  (revert source → the new credit-value test goes RED).

**DO NOT build (reject scope creep):**
- The separate DC-18 detector-TUNING residuals (the `frozenAmountCents` basis under the Redis-down/unlocked path;
  the error-vs-warn level on a legitimate re-sign-lower) — their own DC-18 observability chunk; do NOT fold LOW
  observability tuning into this HIGH money chunk.
- V-N3-erasure (GDPR), the PATCH price-change guard, the V-N1 cap, the expiry pass, EIP-712, the payout pipeline,
  the reconciler tail (already V-N2-correct). Do NOT change the exactly-once flip gate or add a new credit path.

## 4. Frozen / existing surfaces to build ON (do not perturb without authorization)

- `forwardAndBill` (T)-transactional credit twin + its `credited_at` marker / lock-order (developers→tools→marker)
  — change ONLY the credited VALUE; keep the txn shape, marker, `devMatched` guard, and `rail`.
- `markSettlementSettled` / `markSettlementBroadcast` / `markSettlementBroadcast`'s settledValueBaseUnits writes
  (V-N2) — READ the recorded value; do not alter the writers.
- The exactly-once `WHERE pending` flip gate + `alreadySettled→skipCredit` — preserve as the sole credit arbiter.
- `settledBaseUnitsToCents` / `SETTLED_VALUE_BASE_UNITS_KEY` (`settled-value.ts`) — reuse; do not re-implement.
- `credit-writer-census.test.ts` (BUILD-GATE) + `verifier-exactamount-census.test.ts` — keep GREEN; update the
  CENSUS only DELIBERATELY if a site genuinely changes (it should NOT — same sites, same marker, new value only).

## 5. Test blast-radius + gate (DC-05)

- Likely tests: `apps/web/src/lib/settlement/__tests__/` (reconcile/credit), the proxy settlement tests
  (`forwardAndBill`), the kernel `/settle` tests, the orchestrator tests (recovery branch). LOCATE BY CONTENT.
  Any fixture asserting the in-request credit is `costCents` on a recovery-confirm must migrate to the recorded
  settled-value basis; prove non-vacuity.
- **Gate (run FULL, green, both packages):** `cd apps/web && npx tsc --noEmit && npm run lint && npm test`;
  `cd packages/mcp && npm run build && npm test && npm run lint`. Floor (current, committed @ 43add9b7):
  apps/web tsc 0 · lint 0 · vitest **4469/0** (193 files; note: 0 skipped — memory's "191 skip" is stale) ·
  packages/mcp build 0 · **1898/1**. Record post counts.

## 6. Lifecycle + defect classes

- **Lifecycle:** scope-confirm (this file) → draft plan (this file §2-§3) → **pre-build plan audit (this ① session;
  closes before build code)** → build → executable gate → ② seal-gating review → ③ post-seal deep audit
  (HIGH-STAKES) → seal + bookkeeping. Founder-close (LOCAL commit, never push).
- **Defect classes to fold** (`.audit/defect-ledger/INDEX.md`): **DC-01** (credited-≠-collected — the chunk's
  core), **DC-06** (the recorded value consumed only when authoritative — the same recovery-coherence V-N2 proved;
  re-confirm for the in-request path), **DC-12** (floor/units, reuse settledBaseUnitsToCents), **DC-18** (the
  recovery-seam detect truthfulness), **DC-05** (test-fixture migration + non-vacuity), **DC-07** (the credit-value
  source now in 3 surfaces — keep them consistent; census), **DC-20** (settledValueBaseUnits-absent fallback).

---

## 7. ⚠ PLAN-AUDIT RESOLUTIONS — THE RESOLVED DESIGN (folded 2026-06-15; SUPERSEDES §2 Dec. A/B, §3 BUILD/DO-NOT, §4 where noted)

> Source: pre-build plan audit = 4 lens reviewers (money-invariant · completeness/scope · SEAM · literal-execution)
> + 2 adversarial refuters on the *resolved design* (money-on-design · scope/decision-on-design), all Opus 4.8.
> Every structural fact below was GROUND-TRUTH verified by direct code read. **BUILD FROM THIS SECTION** — where
> it conflicts with §2/§3/§4, §7 wins.

**THE PIVOT (read first): credit-the-recorded-value-OR-DEFER — never credit a guess in-request.** The in-request
on-chain credit reads the row's recorded `settledValueBaseUnits` (the authoritative value of the tx on
`external_ref` that settled). Present + convertible → credit `settledBaseUnitsToCents(it)`. ABSENT (the bounded
swallowed-`onBroadcast` / double-swallow DC-20 residual) or UNCONVERTIBLE / sub-cent → **do NOT credit a fallback
guess**; leave `credited_at` NULL, emit the signal, and let the reconciler / uncredited-sweep backstop with full
context. Why: on a multi-re-pointed absent-value row NEITHER `costCents` NOR `amount_cents` reliably equals the
settling tx's value (money-adversary F1). Deferring is exactly-once-safe (`credited_at` still arbitrates), strictly
better than today's unconditional `costCents` credit, and a forgotten bridge degrades to defer-not-miscredit.

1. **Value source — split by path (literal-F1–4, completeness-F2/3, SEAM-F2/4, money-F3/F6):**
   - **Fresh-submit:** credit `settledBaseUnitsToCents(proof.authorization.value)` — the orchestrator already
     holds it (passed to `applyOutcome`'s existing 4th arg). **NO row re-read** (avoids a hot-path DB round-trip +
     the null-re-read failure mode). == `costCents` under exactAmount (non-regression).
   - **Recovery-confirm:** the orchestrator lacks the prior tx's value, so on the settled-flip-TRUE recovery path
     it **re-reads the row AFTER the flip** (row then terminal/frozen) to get `settledValueBaseUnits`. Credit
     `settledBaseUnitsToCents(it)` or DEFER (per the pivot).
   - Both attach the resolved `creditCents: number | null` to the settled outcome (`null` ⇒ defer).
   - **DO NOT** feed `proof.authorization.value` on recovery (= P2, the re-signed value ≠ the settling tx) — the
     silent-wrong trap §2 warns of.

2. **`findSettlementRow` projection (literal-F1, completeness-F6) — PRE-AUTHORIZED read-only carve-out:** extend it
   (or add a dedicated typed read) to project `settledValueBaseUnits` for the recovery re-read; update
   `SettlementRowState` + the `orchestrate.test.ts` / `settle.test.ts` mocks. Recovery-test mocks MUST return a row
   whose `settledValueBaseUnits` ≠ `costCents` AND the test MUST assert the credited VALUE (non-vacuity, money-F10).

3. **Outcome type (PRE-AUTHORIZED carve-out):** the settled variant of `X402SettlementOutcome` /
   `CircleNanoSettlementOutcome` gains `creditCents?: number | null`.

4. **The handler bridge (money-F3 — the silent fall-through; MANDATORY):** BOTH proxy handlers MUST copy the
   resolved value into the settlement literal: `settlement: { operationId, rail, creditCents: outcome.creditCents }`
   (x402 ~`route.ts:1983-1990`, circle-nano ~`:2134`). Today neither reads `outcome.creditCents`. PIN with a test
   asserting the credited NUMERIC value (not just the SET property) on a recovery with `creditCents ≠ costCents`,
   both rails. (Forgotten bridge ⇒ `creditCents` undefined ⇒ defer-always — a perf regression caught by this test,
   NOT a wrong credit.)

5. **`forwardAndBill` twin (money-F1 shared-`actualCost`; SEAM-F1/F8 + money-F2 gate):** introduce a NEW variable
   scoped INSIDE `if (options?.settlement)` (e.g. `const settledCreditCents = options.settlement.creditCents`);
   gate the WHOLE credit txn on `settledCreditCents != null` → credit it at `:1713` (balance) + `:1720` (revenue)
   + write the `credited_at` marker; when `null` → skip the txn (no balance/revenue/marker) + emit the signal
   (defer). **Leave `:1695 actualCost` + the `:1751` legacy `Promise.all` branch BYTE-IDENTICAL** — they serve the
   non-settlement rails (`actualCost` is SHARED across both branches; verified). Serves BOTH proxy rails via the
   one `forwardAndBill` body (completeness-F1).
   - **`billing-credits.test.ts` (ADD to the frozen-test list — DELIBERATE migration):** the twin RHS
     `${actualCost}` → `${settledCreditCents}` breaks `GROSS_WRITER_PATTERN` (`:63`, an allowlist of RHS tokens,
     asserts exactly 6). Add `settledCreditCents` to the allowlist, keep the count at 6, and update the gate's
     doc-comment to state the twin credits the settled value (still GROSS — full collected, no fee netting).
     `credit-writer-census` stays green automatically (its regex ignores the RHS operand — verified).

6. **Kernel `/settle` (completeness-F3/F7, SEAM-F4, money-F4):** credit `outcome.creditCents` when present; when
   `null`, defer (its `creditSettlement` no-data guard already skips WITHOUT a marker → sweep backstops) + emit the
   signal. `outcome` is in scope (`:203`); the orchestrator's re-read populates it. **CREATE**
   `apps/web/src/app/api/circle-nano/settle/__tests__/` (does not exist today) with NON-VACUOUS value-pinning
   tests. ⚠ ②-audit-worthy: a brand-new test file for a real-money route is easy to write vacuously.

7. **Signals (scope-DECISION-1 — the masking fix; HIGH):** the in-request defer MUST emit
   `settlement.settled_value_legacy_fallback` (warn, absent) / `settlement.settled_value_unconvertible` (error,
   unconvertible) AT THE IN-REQUEST SEAM (proxy twin + kernel), mirroring the reconciler's names / levels / payload
   `{operationId, rail, amountCents}`. Without it the bounded mis-credit window is unswept (today) AND unpaged. PIN
   with a test (absent recorded value on recovery → defer + warn fires + `credited_at` stays NULL).

8. **Detector — DESCOPED to DC-18 (completeness-F4, SEAM-F6; money-F8 dissent CONSIDERED + REFUTED):** do NOT add a
   recovery-seam `detectSettledValueDivergence`. Rationale: the broadcast-seam detector already fires the instant
   the value is recorded (in `onBroadcast`, right after `markSettlementBroadcast`), so a present-and-divergent
   recovery's divergence is already paged at the originating broadcast; a recovery detector would be redundant AND
   would violate the helper's documented "fresh-proof-value, never-frozen-column" contract (the recovery value is a
   stored column). The one genuinely-uncovered case — absent value from a swallowed write — is covered by #7's
   defer+signal. The `frozenAmountCents`-basis refinement stays a DC-18 follow-up (applies to BOTH seams). **This
   REVERSES §0/§3's "extend the detector to the recovery seam."** [If ② judges the redundancy argument has
   edge-case holes, the detector is a cheap ~1-line add — fed the RECORDED value, never `proof.value`.]

9. **Reconciler — DO NOT re-open (money-F5; resolves the scope↔money adversary tension):** do NOT refactor
   `reconcile.ts:210-241` into a shared resolver. The money-critical primitive (`settledBaseUnitsToCents`,
   floor/overflow) is ALREADY shared and both paths call it; the surrounding POLICY legitimately differs
   (reconciler = fallback-and-credit backstop; in-request = credit-or-defer fast path), so they are NOT the same
   logic — not sharing them is correct, not drift. Reconciler stays BYTE-IDENTICAL (no seal re-opening; smaller
   blast radius). Add a **key-sync guard** (mirror `settled-value.test.ts:115-121`): assert the in-request reader
   resolves via the SAME `SETTLED_VALUE_BASE_UNITS_KEY` the writers use.

10. **Analytics + header (SEAM-F5, scope-DECISION-2):**
    - `recordProtocolInvocation` (`route.ts:~1786`): on the settlement common path record the SAME value credited
      (so `invocations.costCents` agrees with `tools.totalRevenueCents` → no dashboard self-contradiction at
      `stats/route.ts:46` headline vs `:61` 24h chart + the dev CSV export); non-settlement / defer → `costCents`
      (unchanged). FOLDED IN (prevents a DC-05 the chunk would otherwise introduce).
    - `X-SettleGrid-Cost-Cents` header (`~:1816`): stays `costCents` (the QUOTED price) + a STATED caveat. **Named
      carry:** the buyer-spend-reporting question (consumers `gridbot.ts`, `packages/langchain/.../tool.ts`,
      `packages/mcp/.../mcp.ts`) → register for DC-18 / a follow-up. No funds impact (payout is on `balanceCents`).

11. **§13.I / DC-06 on the in-request trigger (money-F7 — RESISTS; pin only):** the nonce-consumed revert never
    flips `settled` in-request (it hits `applyOutcome`'s reverted/nonceConsumed arm → `pending`), and re-points
    move value+ref atomically in one UPDATE — so "recorded value is authoritative when `external_ref` confirms
    settled" holds on the in-request trigger. **No code fix;** ADD the in-request non-regression test (recovery
    confirm of a reverted-nonce-consumed / re-pointed row → NO in-request credit), mirroring `reconcile.test.ts:569`.

**Frozen / PRE-AUTHORIZED carve-outs (updates §4):** AUTHORIZED edits this chunk — `findSettlementRow` projection
(read-only +`settledValueBaseUnits`); the settled outcome variant (+`creditCents?`); `options.settlement`
(+`creditCents`); `billing-credits.test.ts` (deliberate gate migration); the affected test mocks. STILL FROZEN:
the `WHERE pending` flip + `alreadySettled→skipCredit` gate (sole credit arbiter); the `markSettlement*` writers;
the reconciler (byte-identical); `settledBaseUnitsToCents` / `SETTLED_VALUE_BASE_UNITS_KEY`;
`verifier-exactamount-census`; `credit-writer-census` (stays green un-edited).

**Tests in V-N2b (DC-05 + the pins) — supersedes §3/§5 list:** recovery price-LOWER + price-RAISE → credits
`floor(recorded) ≠ costCents` on ALL 3 surfaces (x402 proxy, circle-nano proxy, kernel), non-vacuous (assert the
VALUE); fresh-submit non-regression (credits `costCents` == `floor(proof.value)`, no re-read); §13.I pin (#11);
absent recorded value on recovery → DEFER (no credit, `credited_at` NULL) + warn fires (#7); unconvertible /
null-re-read → defer + error; handler-bridge value pin (#4); `billing-credits` gate migration (count 6, new token,
doc updated); key-sync guard (#9); `recordProtocolInvocation` == credited value on settlement (#10); mocks updated
with `settledValueBaseUnits ≠ costCents` + credited-value assertions (#2). Prove non-vacuity (revert source → new
tests RED). Gate floors unchanged (§5).

**Net (money-invariant adversary):** no reachable wrong / double / missing credit in this resolved design; the
three breaks it found in the prior synthesis (fallback basis, the un-wired handler bridge, the re-read totality
gap) are closed by the credit-or-defer pivot + the mandatory bridge + the in-request defer signal. Highest-risk
build steps to get exactly right: #4 (the bridge), #5 (new variable, legacy branch byte-identical), #1 (recovery
re-read AFTER the flip).
