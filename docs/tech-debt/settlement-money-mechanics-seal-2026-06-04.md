# Settlement money-mechanics chunk — SEALED (2026-06-04)

> Capstone for the money-mechanics completion chunk. Builds on the handoff
> (`settlement-money-mechanics-handoff-2026-06-03.md`) + the build plan
> (`settlement-money-mechanics-build-plan-2026-06-03.md`, pre-build audit PLAN_READY).
> x402 + circle-nano are LIVE on Base mainnet; ap2 is LIVE as a verification
> facilitator — this was real money. Commit is LOCAL-ONLY (push founder-gated).

## The reframe (Step-0 ground truth — the handoff's premise was off)

The handoff framed this as "the platform takes $0 → wire `takeBps` to turn on
monetization." Reading the actual code disproved that:

- **Monetization is ALREADY live** via a *progressive payout-time take* —
  `lib/pricing.ts:calculateTakeCents` (0% on a dev's first $1k/mo, 2% to $10k,
  2.5% to $50k, 5% above), applied at payout (`payouts/process.ts:259-261`). The
  dev is credited **GROSS** at settle; the take is realized **once at payout**.
- So **`take_bps = 0` on a settlement ROW is the CORRECT settlement-event record**,
  not a gap — at the settlement event the platform takes 0. Wiring a flat per-row
  take would misrepresent the progressive payout take and risk a double-count.
- `revenueSharePct` is **legacy/ignored** (schema + metering.ts say so; a guard test
  forbids net-crediting the balance).
- The one *real* funds gap was **circle-nano over-collection**.

So the chunk completed + corrected the per-settlement money mechanics by fixing the
real gap and documenting the take model — NOT by adding a misleading per-row take.

## What shipped (two surgical changes + docs)

- **A. Enforce-exact circle-nano** (`lib/circle-nano-proxy.ts`):
  `validateCircleNanoCredentialString` now passes `exactAmount: true` to the
  byte-stable verifier → `value === cost` (parity with x402), at the **single choke
  point** fronting all three settling paths (kernel `/verify` + `/settle`, direct
  proxy `handleCircleNanoProxy`). Closes the silent over-collection: EIP-3009
  `transferWithAuthorization` moves the FULL signed value atomically, so tolerating
  `value > cost` over-charged the payer and the excess was retained. + two REAL-verifier
  over-auth-rejection tests (`circle-nano/__tests__/e2e-smoke.test.ts`).
- **B. AP2 ledger-write durability** (`app/api/ap2/settle/route.ts`): the
  fire-and-forget `recordSettlementEntryAsync({...})` is now
  `after(() => recordSettlementEntry({...}).catch(...))` — durable OFF the response
  critical path (`after` is stable in Next `^15.1.0`). AP2 is a facilitator (the row
  is an AUDIT record, no funds). + ap2 route test (`after` mock + resolved writer mock).

## Coverage of handoff §3 (all six dispositioned)

1. `take_bps:0` → **resolved-as-correct** (settlement-event take is 0; realized progressively at payout).
2. over-collection → **FIXED** (enforce-exact).
3. unowned-priced-tool → **moot** (`tools.developerId` is NOT NULL + cascade FK).
4. `accountId` stand-in → **deferred** (no `accounts` provisioning anywhere; backfill when it lands).
5. ledger durability → **FIXED** (ap2 `after()`); repo-wide fire-and-forget (`sessions.ts`/`recordHop`) deferred.
6. ap2 dedup → **deferred-inherent** (no stable key for a VDC without `transactionId`).

## Gates (ground truth at build)

`tsc --noEmit` **0** · `vitest` **4220 pass / 1 pre-existing fail** (`processDataDeletion`
in `settlement-moat.test.ts`, unrelated; baseline was 4218 — exactly +2 for the new
over-auth tests) · `eslint` (4 changed files) **0** · `next build` **0**. No schema
migration; no `packages/mcp` change. Only **4 tracked files** changed (2 src + 2 test).

## Pre-build audit (HARD gate, 2 rounds) → PLAN_READY

- **R1** (`wf_44207650-59f`) **PLAN_NEEDS_FIXES** — exactly **1 blocking**: the ap2
  test-recipe gap (the `after()`-wrapped `.catch` on a bare `vi.fn()` mock → `undefined.catch`
  → TypeError → 500; fix = global `mockResolvedValue` + enumerate the 4 write-reaching
  tests) + 3 improvements (§8.A env/recipient wiring, §5 402-vs-200 prose, free-tool
  edge). All applied. **2 over-reaching findings correctly refuted** by the adversarial-verify
  layer (the over-auditing scope guard held).
- **R2** (`wf_60e60b02-837`) **PLAN_READY** (0 blocking; only doc-precision nits — incl. a
  good catch that `:175`/`:187` also reach the write, reinforcing the GLOBAL mock fix; and
  a rejected "smaller-diff" nit — wrapping the void-returning `recordSettlementEntryAsync`
  would NOT be durable, so the awaited form is required).
- Verdicts: `.audit/money-mechanics-prebuild/round{1,2}-verdict.txt`.

## Post-build funds-safety SEAL panel → ✅ SEAL (0 blocking)

`wf_8fb17915-80f` (4 lenses → adversarial verify → synthesis). Zero confirmed
funds-breaking findings across 6 vectors: over-collection-closed (all 3 paths, reject
BEFORE on-chain submit), no valid-payment regression (SDK signs exact; genuine exact
still validates), exactly-once + gross-credit intact, all 8 byte-stable cores UNCHANGED
(git-diff verified), payout source-of-truth undiverged (AP2 writes no balance), ap2
`after()` durable + response-safe + funds-neutral (`recordSettlementEntryAsync` still used
by `sessions.ts`, not orphaned). Full output: `.audit/money-mechanics-postbuild/seal-verdict.txt`.

## Founder-gated follow-ups (NOT code)

1. **PUSH is gated** — this is a LOCAL commit only (no `origin/main` push → no Vercel build).
2. **circle-nano enforce-exact is a LIVE-rail behavior change (fail-closed):** an
   over-authorizing *non-SDK* client now gets `402 CIRCLE_NANO_AMOUNT_MISMATCH` (and must
   re-sign exact) instead of silently overpaying. SDK clients sign exact → unaffected. No
   money moves differently on the happy path.
3. **Deferred (documented):** `accounts` provisioning + `accountId` backfill; ap2 dedup;
   repo-wide fire-and-forget→`after()` (`sessions.ts:469`, `recordHop`,
   `postLedgerEntryAsync`); per-rail settlement-time take (would touch the sealed credit
   path — its own chunk + audit, if differentiated pricing is ever wanted). `revenueSharePct`
   legacy cleanup.
