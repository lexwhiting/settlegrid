# V-N2b — in-request recovery-seam credit → ② SEAL-GATING HANDOFF (2026-06-15)

> BUILD COMPLETE, LOCAL ONLY (never pushed). Built from the ①-buildable handoff
> `docs/tech-debt/v-n2b-recovery-seam-credit-handoff-2026-06-15.md` §7 (the authoritative
> resolved design). Base = clean `main` @ `43add9b7`. Repo `/Users/lex/settlegrid` (npm monorepo).
> **This is the ② SEAL-GATING input — NOT self-sealed. Hand to the ② reviewers.**

---

## 0. What was built (one line)

The IN-REQUEST on-chain settlement credit (proxy `forwardAndBill` twin for x402 + circle-nano, AND
the kernel `/settle` route) now pays the **ACTUALLY-collected settled value** the orchestrator
resolved — fresh-submit = this proof's value (== costCents); recovery-confirm = the PRIOR
broadcast's recorded value (possibly ≠ costCents after a re-sign-at-a-changed-price) — **or DEFERS**
(credits nothing, leaves `credited_at` NULL) when that value is absent/unconvertible. This closes the
live over/under-credit vector V-N2 fixed only on the reconciler tail.

## 1. HIGH-STAKES tier — triggers (record per §0 of the ① handoff)

- **(a) Money invariant** — determines the cents credited to `developers.balanceCents`, paid out as
  **unclawbackable fiat ≤24h**. A wrong credit is a direct platform loss (over-credit) or developer
  short-pay (under-credit).
- **(b) Touches (T)-sealed surfaces** — the `forwardAndBill` (T)-transactional credit twin, the kernel
  `/settle` credit, and the (V)/(T)-sealed orchestrator outcome/return semantics.
- **(c) Affects the payout pipeline** — `developers.balanceCents` → `process-payouts`.
- Uncertain ⇒ HIGH-STAKES applies. ② should run the HIGH-STAKES lens set (money-invariant +
  completeness/scope + SEAM + literal-execution + adversarial refute), per the canonical policy.

## 2. THE PIVOT realized (§7) — credit-the-recorded-value-OR-DEFER, never guess in-request

Present + convertible (≥ 1¢) → credit `settledBaseUnitsToCents(recorded)`. Absent / unconvertible /
sub-cent-or-zero → **DEFER** (no balance/revenue/marker, `credited_at` stays NULL) + emit the
reconciler-mirrored signal; the reconciler + uncredited-sweep backstop with full context. Deferring is
exactly-once-safe (the `WHERE pending` flip stays the sole credit arbiter) and strictly better than
today's unconditional `costCents` credit on a recovery.

## 3. §7 finding → resolution provenance (item-by-item, as built)

| §7 | Resolution as built | Site(s) |
|----|--------------------|---------|
| PIVOT / §7.1 value source | Fresh-submit resolves `creditCents` from the `settledValueBaseUnits` arg (== `proof.authorization.value`) — **NO row re-read**. Recovery-confirm (arg `undefined`) **re-reads the now-terminal row AFTER the flip** and resolves from `row.settledValueBaseUnits`. Both attach `creditCents: number \| null` to the settled outcome. | `x402/orchestrate.ts` applyOutcome settled-flip-winner; `circle-nano/settle.ts` twin |
| §7.2 `findSettlementRow` projection | Added read-only `settledValueBaseUnits: string \| null` projection via `metadata ->> ${SETTLED_VALUE_BASE_UNITS_KEY}` (bound param = the SHARED constant, no split-brain) + field on `SettlementRowState`. | `ledger.ts` |
| §7.3 outcome type | Settled variant of `X402SettlementOutcome` / `CircleNanoSettlementOutcome` gains `creditCents?: number \| null`. | both orchestrators |
| §7.4 handler bridge (MANDATORY) | BOTH proxy handlers copy `creditCents: outcome.creditCents` into the `settlement` literal. Pinned by a test asserting the credited NUMERIC value on a recovery with `creditCents ≠ costCents` (both rails). | `proxy/[slug]/route.ts` x402 ~handler + circle-nano ~handler |
| §7.5 `forwardAndBill` twin | NEW `const settledCreditCents = options.settlement.creditCents ?? null` INSIDE `if (options?.settlement)`; the whole credit txn gated on `settledCreditCents != null`; credits `settledCreditCents` at balance + revenue + marker; `null` → skip (defer). `:1695 actualCost` + the legacy `Promise.all` branch left **BYTE-IDENTICAL** (verified — not in diff). | `proxy/[slug]/route.ts` forwardAndBill |
| §7.5 `billing-credits.test.ts` migration | Added `settledCreditCents` to `GROSS_WRITER_PATTERN`, **count held at 6**, doc-comment updated (twin credits the GROSS settled value). `credit-writer-census` stays green un-edited (its regex ignores the operand — confirmed). | `__tests__/billing-credits.test.ts` |
| §7.6 kernel `/settle` | Credit gated `outcome.alreadySettled !== true && outcome.creditCents != null`; credits `amountCents: outcome.creditCents`; `null` → defer (skip the call). NEW dir `circle-nano/settle/__tests__/credit-value.test.ts` with non-vacuous value pins. | `circle-nano/settle/route.ts`; new test dir |
| §7.7 signals (the masking fix) | `settled_value_legacy_fallback` (warn, absent) / `settled_value_unconvertible` (error, unconvertible/sub-cent), reconciler-mirrored names/levels/payload `{operationId, rail, amountCents}`. **Emitted by the orchestrator** (see §4 below). PIN: absent-on-recovery → defer + warn + `credited_at` NULL. | `settled-value.ts` `resolveInRequestCreditCents` |
| §7.8 detector — DESCOPED | NO recovery-seam `detectSettledValueDivergence` added (DC-18). The broadcast-seam detector already fires at the originating broadcast; the one uncovered case (absent value) is covered by §7.7's defer+signal. **②: if you judge the redundancy argument has holes, it's a ~1-line add fed the RECORDED value (never `proof.value`).** | — (not built, by design) |
| §7.9 reconciler NOT re-opened + key-sync | Reconciler `reconcile.ts` **byte-identical** (not in diff). The shared funds-safe primitive (`settledBaseUnitsToCents`) is reused; the credit-or-defer POLICY is new and deliberately distinct (not drift). Key-sync guard added: a source-scan asserting `findSettlementRow` reads via `SETTLED_VALUE_BASE_UNITS_KEY` (no hardcoded literal). | `__tests__/settled-value.test.ts` |
| §7.10 analytics + header | `recordProtocolInvocation` records the credited value (`recordedCostCents`) on the settlement-credit path so `invocations.costCents` agrees with `tools.totalRevenueCents`; non-settlement / defer → `actualCost` (unchanged). `X-SettleGrid-Cost-Cents` header stays the QUOTED `actualCost` + a stated caveat (buyer-spend refinement registered → DC-18). | `proxy/[slug]/route.ts` forwardAndBill |
| §7.11 / §13.I / DC-06 pin | No code fix (the nonce-consumed revert never flips settled in-request). Added the in-request non-regression test: recovery confirm of a reverted-nonce-consumed row → NO in-request credit (`markSettlementSettled` never called). | both orchestrator tests |

## 4. ⚠ THE ONE DESIGN DECISION ② SHOULD SCRUTINIZE (signal emission locus)

§7.5/§7.6 say "the proxy twin + kernel emit the signal"; §7.7 says the differentiated
`legacy_fallback` (warn) vs `unconvertible` (error) fire "at the in-request seam." But §7.3 constrains
the settled outcome to a **bare `creditCents: number \| null`** — no reason field. **Only the
orchestrator can distinguish absent from unconvertible** (it reads the raw recorded value). Therefore
the differentiated signal is emitted **in the orchestrator** (inside `resolveInRequestCreditCents`),
which runs synchronously in-request within the proxy handler / kernel call chain — satisfying §7.7's
"at the in-request seam." The proxy twin + kernel **defer on `null` WITHOUT re-emitting** (to avoid
double-paging). This is the only resolution consistent with §7.3 + §7.7 simultaneously; a forgotten
bridge (creditCents undefined) degrades to a silent defer caught by the bridge-value test + the
uncredited sweep, never a wrong credit. **If ② prefers the seam to emit, it would require widening the
outcome to carry a reason — a §7.3 change — flag it.**

## 5. Files changed (LOCAL, uncommitted; path-scoped)

Source (6): `lib/settlement/settled-value.ts` (+`resolveInRequestCreditCents`), `lib/settlement/ledger.ts`
(+projection/field), `lib/settlement/x402/orchestrate.ts`, `lib/settlement/circle-nano/settle.ts`
(both: +`creditCents` type + resolution), `app/api/proxy/[slug]/route.ts` (twin + bridges +
recordProtocolInvocation + header caveat), `app/api/circle-nano/settle/route.ts` (kernel credit).

Tests (7): `settled-value.test.ts`, `x402/__tests__/orchestrate.test.ts`,
`circle-nano/__tests__/settle.test.ts`, `proxy/[slug]/__tests__/{x402,circle-nano}-proxy-settlement.test.ts`,
`proxy/[slug]/__tests__/billing-credits.test.ts`, `circle-nano/__tests__/route.test.ts`, **NEW**
`circle-nano/settle/__tests__/credit-value.test.ts`.

## 6. Frozen-surface compliance (verified)

- Reconciler (`reconcile.ts`) — **not in diff** (byte-identical). ✓
- `forwardAndBill` legacy `Promise.all` branch + `:1695 const actualCost` — **byte-identical** (the
  `actualCost` credit lines do not appear as changed in the route.ts diff). ✓
- `markSettlement*` writers — untouched. ✓
- `settledBaseUnitsToCents` / `SETTLED_VALUE_BASE_UNITS_KEY` / `detectSettledValueDivergence` — unchanged
  (only the NEW `resolveInRequestCreditCents` added to that file). ✓
- `verifier-exactamount-census` + `credit-writer-census` — GREEN, un-edited (census count stays 6). ✓
- Exactly-once `WHERE pending` flip + `alreadySettled→skipCredit` — unchanged (the change is ONLY the
  credited VALUE / a defer-skip; no new credit path, no second `balanceCents` site). ✓

## 7. GATE (FULL, both packages) — GREEN

| | floor @ 43add9b7 | post-build |
|--|--|--|
| apps/web `tsc --noEmit` | 0 | **0** |
| apps/web `npm run lint` | 0 errors | **0 errors** (pre-existing warnings only: logo.tsx, academy-lessons — untouched) |
| apps/web `npm test` (vitest) | 4469 / 0 (193 files) | **4491 / 0 (194 files)** — +1 file (new kernel credit-value test), +22 tests, all V-N2b |
| packages/mcp `npm run build` | 0 | **0** |
| packages/mcp `npm test` | 1898 / 1 skip | **1898 / 1 skip** (no mcp edits) |
| packages/mcp `npm run lint` | 0 errors | **0 errors** (6 pre-existing warnings) |

## 8. Non-vacuity — PROVEN

Sabotaged the 3 credit-resolution sites simultaneously (orchestrator recovery fed `'500000'` instead of
the re-read; proxy twin credited `actualCost`; kernel credited `costCents`) → **12 V-N2b credit-value
tests went RED** across all 5 affected files (orchestrator RAISE/LOWER/absent-defer/unconvertible-defer
x402+circle-nano; proxy bridge value pins both rails; kernel recovery 30 + 70), while the **87 other
tests stayed GREEN** (structural/idempotency tests don't depend on the credit value). Sabotage then
**byte-exactly reverted** (verified `git diff` matches the pre-sabotage saved patch); suites re-run all
green (99/99).

## 9. Residuals / known minor items (none block; for ② awareness)

- **`tools.totalInvocations` on a DEFER**: the deferred credit skips the whole txn including the
  `totalInvocations + 1` bump. This MATCHES the reconciler tail (its later credit via `creditSettlement`
  also never bumps `totalInvocations`), so a deferred-then-reconciled settlement is counted in
  `invocations` (the per-row table, via `recordProtocolInvocation`) but not the denormalized
  `tools.totalInvocations` counter. Bounded, rare residual; consistent with existing reconciler behavior.
- **`X-SettleGrid-Cost-Cents` = quoted price** on a recovery-confirm (may differ from the credited
  recorded value). Stated caveat in code; buyer-spend-reporting refinement registered → DC-18.
- **DC-18** carries: the recovery-seam detector (§7.8), the `frozenAmountCents`-basis refinement, and
  the buyer-spend header question. NOT this chunk.

## 10. STATUS — STOP for founder/② review

Build complete, gate green, frozen surfaces intact, non-vacuity proven. **NOT self-sealed.** Next:
② seal-gating review (HIGH-STAKES lens set) → ③ post-seal deep audit → seal + LOCAL founder-close
commit (path-scoped, NEVER push). Cadence: LOCAL only; do not `vercel --prod` from the worktree.
