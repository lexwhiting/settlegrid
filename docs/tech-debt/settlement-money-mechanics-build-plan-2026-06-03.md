# Settlement money-mechanics completion — BUILD PLAN (2026-06-03)

> Pre-build-audit-gated build plan for the next chunk. Read order: the handoff
> (`settlement-money-mechanics-handoff-2026-06-03.md`) → the A1 debt register
> (`a1-facilitator-ledger-writes-2026-05-30.md`) → the circle-nano SEAL
> (`circle-nano-funds-safety-seal-2026-06-02.md`) → THIS plan.
> Status: **DRAFT → pre-build audit pending.** No implementation code until the
> audit returns PLAN_READY (0 blocking) with all fixes applied.

---

## 1. Corrected framing (Step-0 ground truth — the handoff's premise is partly off)

The handoff frames this as "the platform takes $0; turn on monetization by wiring
`takeBps`." **Reading the actual code disproves that premise.** Verified facts
(every claim has a file:line; the audit must re-verify each):

- **Monetization is already LIVE.** `apps/web/src/lib/pricing.ts:35`
  `calculateTakeCents()` is a *progressive marginal* platform take —
  **0%** on a developer's first $1,000/mo, **2%** to $10k, **2.5%** to $50k,
  **5%** above (`TAKE_RATE_BRACKETS`, `pricing.ts:21-26`). It is applied at
  **payout** time: `apps/web/src/lib/payouts/process.ts:259-261`
  (`grossCents = balanceCents; platformFeeCents = calculateTakeCents(grossCents);
  payoutAmountCents = grossCents - platformFeeCents`). Also used by the payout
  cron (`api/cron/process-payouts/route.ts:351`) and the dashboard
  (`(dashboard)/dashboard/page.tsx:333`). Developers in the 0% bracket (most
  early ones) see an effective $0 take — but the mechanism is real and non-zero.

- **The developer is credited GROSS at settle; the take is realized once at
  payout.** `metering.ts:304-306` ("developer receives full costCents at
  invocation time. Platform take is calculated and deducted at payout time").
  A guard test, `proxy/[slug]/__tests__/billing-credits.test.ts`, **actively
  forbids** any `balanceCents + X*revenueSharePct/100` net-credit write — the
  gross-credit-at-settle invariant is sealed.

- **`take_bps`/`take_cents` on a settlement row is a SEPARATE per-row recording
  field** (`ledger_entries`, nullable; `schema.ts:877-878`; CHECK
  `take_bps ∈ [0,10000]`, `take_cents ≥ 0`, `schema.ts:935-941`). At a
  settlement *event* the platform takes **0** (gross credit); the take is an
  aggregate-payout-time deduction. So **`take_bps = 0` on settlement rows is the
  CORRECT record, not a gap.** Wiring a flat per-row take cannot reconcile to the
  *progressive* payout take (which depends on the dev's running monthly total)
  and would create misleading records + a double-count footgun.

- **`revenueSharePct` is legacy/ignored** (`schema.ts:27` "Legacy — progressive
  take rates now calculated dynamically"; `metering.ts:298` "Legacy — ignored").
  Still *read* in ~10 places (proxy, sdk/meter, sessions, settings) but never
  applied to a credit. Not touched by this chunk.

- **Real funds issue confirmed (the one true gap): circle-nano over-collection.**
  `circle-nano/verify.ts:189` — circle-nano verifies `value >= requiredBaseUnits`
  (tolerant), while x402 passes `exactAmount:true` → `value === requiredBaseUnits`
  (`x402/orchestrate.ts:277-281`). EIP-3009 `transferWithAuthorization` transfers
  the FULL signed `value` atomically; so an over-authorized circle-nano payment
  collects `value` on-chain to the platform wallet but credits the dev only
  `costCents` (`circle-nano/settle.ts:89` records `amountCents: costCents`;
  proxy/kernel credit `costCents`) — the excess `value - cost` is **silently
  retained** (payer overpaid, platform gains silently). The SDK *advertises*
  exact cost (`packages/mcp/src/adapters/circle-nano.ts:558`,
  `String(safeCents * 10_000)`), so the happy path is already exact; only an
  anomalous over-authorization triggers the over-collection.

- **De-scoped by ground truth:**
  - "Unowned priced tool" (handoff §3.3) **cannot occur**: `tools.developerId` is
    `.notNull()` with `onDelete:'cascade'` (`schema.ts:92-94`). The ap2/circle
    `if (... && toolRow.developerId)` checks are belt-and-suspenders.
  - "Where the take accrues / accounts" (handoff §3.4): the `accounts` table has
    **zero** provisioning anywhere (`rg insert(accounts)` → none; A1 Decision 1).
    The take accrues *implicitly* (gross credited, withheld at payout). No
    platform account exists or is needed for the live model.
  - **AP2 is a verification FACILITATOR, not a money intermediary.** The ap2
    settle route NEVER credits `balanceCents`/`totalRevenueCents` (it has no
    `creditSettlement`/meter call — `api/ap2/settle/route.ts` only records a
    ledger row); "the VDC IS the payment" (route header), money flows payer→dev
    directly. So AP2 take-recording is meaningless (SettleGrid takes nothing from
    AP2) and the ap2 ledger row is a pure **audit** record.

## 2. Step-0 decisions (founder delegated to research-based judgment)

| # | Decision | Call | Rationale |
|---|----------|------|-----------|
| 1 | Take model / `take_bps` | **Keep `take_bps = 0`; document, don't wire.** | `0` is the correct settlement-event record; the live take is progressive-at-payout. A flat per-row take can't reconcile + risks double-count. Per-rail settlement-time take = a clean future chunk (would touch the sealed credit path; own audit). |
| 2 | Over-collection | **Enforce exact on circle-nano.** | Matches x402; SDK already advertises exact; only rejects anomalous over-auths; eliminates silent over-collection; fail-closed (safe direction) on a live money rail. The chunk's primary funds-correctness fix. |
| 3 | Accounts | **Defer (keep `developerId` stand-in).** | Take accrues implicitly; `accounts` unprovisioned everywhere; a provisioning subsystem on live money is large + unneeded for the current model. |
| 4 | Scope adds | **Include AP2 ledger durability (`after()`); exclude AP2 take-recording + ap2 dedup gap.** | Durability is a real (low) gap on a live rail's audit trail; AP2 take is meaningless (facilitator); ap2 dedup is inherent (no stable key). |

**Coverage of handoff §3 (all six dispositioned):** (1) take → documented-as-correct;
(2) over-collection → **FIXED**; (3) unowned-tool → moot (schema); (4) accountId →
deferred-with-rationale; (5) durability → **FIXED** (ap2 `after()`); (6) ap2 dedup →
deferred-inherent.

## 3. Scope — what ships (IN)

**A. Enforce-exact circle-nano** (funds-correctness; live-rail behavior change).
**B. AP2 settlement ledger-write durability via `after()`** (audit-record integrity).
**C. Decision/reconciliation documentation** (take-model truth + debt-register update;
no economic change).

Net: **two surgical code changes + their tests + documentation.** Additive; no schema
migration; no `packages/mcp` change; no money-movement change to any credit/payout path.

## 4. ⚠️ SCOPE GUARD (§6a — byte-stable / OUT of scope; reject audit findings that grow these)

**Byte-stable — do NOT modify:**
- The offline verifier `circle-nano/verify.ts` (`verifyEip3009Authorization`) — it
  already supports `exactAmount`; we flip the **caller's flag**, not the verifier.
- The on-chain orchestrators `circle-nano/settle.ts` + `x402/orchestrate.ts`
  (idempotency, write-ahead pending row, lock, guarded flip, return shape).
- `ledger.ts` exactly-once machinery: `recordSettlementEntry`, `settlementEntryId`,
  `markSettlementSettled`/`Failed`/`Broadcast`, `findSettlementRow`.
- `reconcile.ts` `creditSettlement` + the credit-iff-you-flipped invariant.
- The payout pipeline (`payouts/process.ts`) + the progressive take (`pricing.ts`).
- The on-chain engines/verifiers (`circle-nano/settle-engine.ts`).
- The x402 + circle-nano SEAL commits.

**Explicitly OUT of scope (deferred, documented in §10):** wiring a non-zero
`take_bps`; account provisioning / `accountId` backfill; ap2 dedup; repo-wide
fire-and-forget→`after()` migration (`sessions.ts:469`, `recordHop`,
`postLedgerEntryAsync`); `revenueSharePct` cleanup; per-rail differentiated take;
P5 rail expansion. **An audit finding that adds any of these is REJECT-with-rationale,
not auto-apply.**

## 5. Change A — enforce-exact circle-nano (the funds fix)

**Single choke point** (verified): all three on-chain-settling circle-nano entry
points verify through `validateCircleNanoCredentialString` —
- kernel `/verify` (`api/circle-nano/verify/route.ts:130`),
- kernel `/settle` (`api/circle-nano/settle/route.ts:126`, re-verifies before settle → not bypassable),
- direct proxy `handleCircleNanoProxy` (`proxy/[slug]/route.ts:1967`).

`validateCircleNanoPayment` (the SDK structural pre-check) has **no app callers**
(`rg` → import + doc only), so it gates nothing.

**Edit (one site):** `apps/web/src/lib/circle-nano-proxy.ts:113-116`
```ts
// BEFORE
const result = await verifyCircleNanoAuthorization(parsed, {
  recipient,
  requiredBaseUnits,
})
// AFTER
const result = await verifyCircleNanoAuthorization(parsed, {
  recipient,
  requiredBaseUnits,
  // circle-nano now requires value === cost (parity with x402). EIP-3009
  // transfers the FULL signed value atomically, so tolerating value > cost
  // over-collected the payer (excess silently retained). The SDK already
  // advertises exact (adapters/circle-nano.ts:558); only anomalous
  // over-authorizations are now rejected (CIRCLE_NANO_AMOUNT_MISMATCH).
  exactAmount: true,
})
```
This makes all three paths reject `value !== requiredBaseUnits` BEFORE any on-chain
submit. The verifier + orchestrator stay byte-stable. Error code is
`CIRCLE_NANO_AMOUNT_MISMATCH` with the exact-scheme reason (`verify.ts:194-196`),
surfaced as **HTTP 402** on `/settle` (`settle/route.ts:138`) and the proxy
(`route.ts:1979`), and **HTTP 200 with `{valid:false, code}`** on kernel `/verify`
(`verify/route.ts:142-146`; `successResponse` defaults 200) — each route's existing
mapping, unchanged. **Free-tool edge (fail-closed, benign):** a cost-0 tool has
`requiredBaseUnits=0`, so under `exactAmount:true` a non-SDK client attaching a
`value>0` authorization is now rejected at the verify gate (which precedes the free
branch: proxy `route.ts:1967`→`1984`, kernel `settle/route.ts:126`). No money moves
(the free path never submits on-chain) and no test breaks (cost-0 tests mock the
validator).

**Why complete / no bypass:** the kernel `/settle` route re-verifies through the same
helper (`settle/route.ts:126`) before `executeCircleNanoSettlement`; the proxy verifies
before `executeCircleNanoSettlement` (`route.ts:1967` → `2022`). There is no settle path
that reaches the on-chain engine without this verify. The orchestrator reads the same
signed `value`, so verify-time exactness ⇒ settle-time exactness (the value is fixed in
the signed authorization).

**Live-rail risk:** LOW and fail-closed. SDK payers sign exact (unaffected). A
non-SDK/custom client that over-authorizes is now rejected at `/verify` (and re-signs
exact) instead of silently overpaying. No money moves differently on the happy path.

## 6. Change B — AP2 ledger-write durability via `after()`

**Edit:** `apps/web/src/app/api/ap2/settle/route.ts` (the fire-and-forget write at
`:168`). AP2 is facilitator/audit-only (no money credit), so this protects the unified
ledger's **audit-trail completeness** on a serverless freeze — not funds.

```ts
// add imports
import { after } from 'next/server'              // stable in Next ^15.1.0 (verified)
import { recordSettlementEntry } from '@/lib/settlement/ledger'  // awaited variant
// (drop recordSettlementEntryAsync import from this route)

// BEFORE  (line ~168, inside `if (costCents > 0 && toolRow.developerId)`)
recordSettlementEntryAsync({ /* ...fields incl. takeBps: 0, settledAt... */ })

// AFTER
after(() =>
  recordSettlementEntry({ /* ...same fields, unchanged... */ }).catch((err) =>
    logger.error('ap2.settle_ledger_write_failed',
      { invocationId: settlement.operationId, rail: 'ap2', protocol: 'ap2' }, err),
  ),
)
```

**Why `after()` not `await` (alternative considered + rejected):** `await`-before-
response would re-couple the settle response latency (and a hang risk) to a best-effort
audit write — the very thing the fire-and-forget avoided. `after()` keeps the write OFF
the response critical path AND makes it durable (Vercel keeps the Fluid invocation alive
to run the callback). Fields are byte-identical (`takeBps: 0` stays — settlement-time
take is 0, per §1/§2). The `.catch` preserves today's "a ledger hiccup never breaks the
SettlementResult" guarantee.

**Why call `recordSettlementEntry` (awaited variant), NOT wrap the existing
`recordSettlementEntryAsync`:** `after(() => recordSettlementEntryAsync({...}))` would
NOT be durable — `recordSettlementEntryAsync` (`ledger.ts:472-484`) returns `void` (it
fires `recordSettlementEntry(input).catch(...)` without returning the promise), so
`after()` has nothing to await and releases the invocation before the floating write
completes (the exact freeze-drop we are fixing). The callback MUST RETURN the write's
promise for `after()` to keep the invocation alive — hence `recordSettlementEntry(...).catch(...)`
returned from the callback. (Do NOT change `ledger.ts` to return the promise — it is a
shared, byte-stable writer also used by `recordHop`.)

## 7. Deliverable C — decision/reconciliation documentation

- A capstone SEAL doc (written post-build): what shipped + the SEAL verdict.
- Update the A1 debt register (`a1-facilitator-ledger-writes-2026-05-30.md`
  "Carried-forward DEBT"): mark `takeBps:0` **resolved-as-correct** (with the
  payout-take reconciliation), the ap2 fire-and-forget **resolved** (`after()`); keep
  `accountId` stand-in + ap2 dedup as **deferred** with rationale. Note over-collection
  **closed**.
- A short "take model" reconciliation note so the next agent doesn't re-derive it:
  progressive-payout = canonical live take; `revenueSharePct` = legacy; `take_bps` = 0
  is the honest settlement-event record.

## 8. Forced test edits (a literal follow ⇒ GREEN suite)

**Baseline:** `vitest` 4218 pass / 1 pre-existing fail (`processDataDeletion` in
`settlement-moat.test.ts`, unrelated). Goal: ≥4218 pass + new tests, same 1 known fail.

**A. Enforce-exact — NO existing test breaks; ADD a real-path proof:**
- `circle-nano-proxy-settlement.test.ts` and `circle-nano/__tests__/route.test.ts`
  both **mock** `validateCircleNanoCredentialString` AND use **exact** amounts
  (cost 50¢ → required 500000 = `value:'500000'`). → unaffected. Confirm
  `circle-nano/__tests__/e2e-smoke.test.ts` does not rely on over-auth acceptance.
- **ADD** a test exercising the REAL verify path (`validateCircleNanoCredentialString`
  → real `verifyEip3009Authorization`) proving the helper now **wires** `exactAmount:true`
  (the verifier's exact-reject is already proven at `verify.test.ts:136`). **Place it in
  `circle-nano/__tests__/e2e-smoke.test.ts`**, which already wires the two prerequisites
  (else the test asserts the wrong code): (i) `validateCircleNanoCredentialString` first
  calls `getCircleNanoRecipient()` (`circle-nano-proxy.ts:71`) — the recipient env is
  UNSET in tests, so it must be mocked (`vi.mock('@/lib/env')` → valid recipient; mirror
  `e2e-smoke.test.ts:31-36`) or it short-circuits `CIRCLE_NANO_NOT_CONFIGURED`; (ii) the
  signed proof must **pay that recipient** (payee bind `verify.ts:149` precedes the amount
  check `:189`, else `CIRCLE_NANO_WRONG_RECIPIENT`). The `signedProof` helper in
  `verify.test.ts:78` is local/non-exported → re-create it (or reuse e2e-smoke's signer
  at `:63`). Assert: an **over-authorized** proof (`value > required`, paying the recipient)
  → `valid:false`, `CIRCLE_NANO_AMOUNT_MISMATCH`; an **exact** proof → `valid:true`.
  (A1 lesson: prove behavior against the REAL validator, not a mock.)

**B. AP2 `after()` — update `ap2/__tests__/route.test.ts`:**
- Partial-mock `next/server` to run `after` synchronously, preserving `NextRequest`:
  `vi.mock('next/server', async (orig) => ({ ...(await orig()), after: vi.fn((cb)=>cb()) }))`.
  (Mocking `after` synchronous runs the callback INSIDE the route's `try` — see next point.)
- Swap the ledger mock from `recordSettlementEntryAsync` → `recordSettlementEntry`
  (`route.test.ts:52-54`), **and the swapped-in mock MUST resolve a Promise** so the route's
  new `recordSettlementEntry(...).catch(...)` chain is valid. The current mock is a bare
  `vi.fn()` (`route.test.ts:31`) returning `undefined`; with `after` mocked synchronous,
  `undefined.catch(...)` throws `TypeError` → caught by the route's outer `try/catch`
  (`ap2/settle/route.ts:188`) → HTTP 500 → RED. **Fix:** declare it in the `vi.hoisted`
  factory as `vi.fn().mockResolvedValue(undefined)` (`:31`) OR add
  `mockRecordSettlement.mockResolvedValue(undefined)` to `beforeEach` (`:101-111`). NOT a
  per-test `.mockResolvedValue` — `beforeEach`'s `vi.clearAllMocks()` (`:102`) would wipe it
  before the later write-reaching test. (Production is unaffected: `recordSettlementEntry`
  returns `Promise<LedgerEntry>` at `ledger.ts:404`, so `.catch` is valid; the real `after`
  runs the callback off-response, outside the `try`.)
- **FOUR** ledger-assertion tests now assert on the `recordSettlementEntry` mock (fields
  unchanged, incl. `takeBps:0`): `:219` (records on success → expects 200, **reaches the
  write**), `:238` (not-called on cost 0), `:246` (not-called on failed verify), and `:255`
  ("mints a UUID ledger key" when no `transactionId`, asserts `mock.calls[0]?.[0]` at `:258`,
  **reaches the write**). `:219` + `:255` reach the write and depend on the resolved-Promise
  fix above; `:238` + `:246` don't reach the write but still need the export-key swap for
  their `not.toHaveBeenCalled` assertions.

**eslint:** run on all changed files (0 warnings/errors).

## 9. Funds-safety invariants preserved (correctness lens)

- **Exactly-once credit** unchanged (no credit-path edits): credit-iff-you-flipped
  across proxy/kernel/reconciler holds.
- **Gross-credit-at-settle** unchanged (no balance-credit edit; `billing-credits.test.ts`
  guard still green).
- **Progressive payout take** unchanged (`pricing.ts`/`process.ts` untouched) → **no
  double-take** (take still realized exactly once, at payout).
- **No new money movement.** Change A only *rejects* over-auths (moves no new money);
  Change B only changes *when/how durably* an audit row is written (no balance effect).
- **Over-collection closed:** post-change, every settled circle-nano payment has
  `value === cost`, so `amountCents (=cost)` honestly equals the on-chain collected
  amount; no silent retention; payer pays exactly cost.
- **A2 traps honored:** no re-insert vs flip change; dedup still on `(from,nonce)`; the
  ap2 `settled` row still carries `settledAt` (fields unchanged).

## 10. Out of scope / deferred (documented, NOT fixed here)

- Wiring a non-zero `take_bps` (settlement-time take) — needs the sealed-credit redesign;
  future chunk if per-rail differentiated take is wanted.
- `accounts` provisioning + `accountId`→real-account backfill (A1 Decision 1).
- ap2 dedup gap when a VDC carries no `transactionId` (inherent — no stable key).
- Repo-wide fire-and-forget→`after()` (`sessions.ts:469` multi-hop, `recordHop`,
  `postLedgerEntryAsync`) — handoff defers "repo-wide"; this chunk does only the ap2
  settle write.
- `revenueSharePct` legacy cleanup; P5 kernel-dispatch expansion; Task C facilitator.

## 11. Verification gates (§9)

`cd apps/web` → `npx tsc --noEmit` (0) · `npx vitest run` (≥4218 pass + new; 1 known
pre-existing fail) · `npx eslint <changed files>` (0) · `npx next build` (0). No
`packages/mcp` change. The enforce-exact test proves the DB-affecting amount policy
against the REAL verifier (not a mocked writer) — the A1 lesson.

## 12. Post-build gate

Mandatory post-build funds-safety SEAL panel (§7 of the handoff) before any commit:
adversarial lenses attempt over-collection-still-open, double-take, dev under-credit,
exactly-once break, byte-stable-core altered, payout-SoT diverged, durability regression.
SEAL (0 blocking) required. Then founder-gated local commit (no push, no prod env).
