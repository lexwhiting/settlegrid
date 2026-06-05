# P3.K4 — A1: Facilitator unified-ledger writes (2026-05-30)

> ## ⚠️ FUTURE AGENTS — READ THIS BEFORE TOUCHING THE LEDGER OR BUILDING A2
>
> **A2 traps — do NOT get these wrong:**
> 1. **The shared writer's `ON CONFLICT DO NOTHING` is FIRST-WRITE-WINS, not an upsert.** To flip a circle-nano row `pending`→`settled` (+ on-chain `txHash`), A2 **MUST issue an explicit `UPDATE`** — matched on the **`operation_id` column** (which stores the stable `circle-nano:<network>:<from>:<nonce>` key) **+ `rail='circle-nano'`**. There is **NO `invocation_id` column** (the key lands in `operation_id`), and the PK-deriving `settlementEntryId()` is **module-private** — so match on `operation_id`, don't try to recompute the PK. Calling `recordSettlementEntry` again would be **SILENTLY SKIPPED** — you'd think you settled it and you didn't.
> 2. **A2 owns the prod env flip:** set **`SETTLEGRID_USDC_RECIPIENT`** in Vercel prod as part of real settlement. circle-nano is intentionally **DARK in prod** until then (record-only; must not accept payments it can't collect). Also flagged in `MEMORY.md`.
> 3. On-chain settle must **dedup on `(from, nonce)`**, NEVER signature bytes (EIP-3009 sigs are malleable).
>
> **Carried A1 DEBT — non-blocking but LIVE (full detail in "Carried-forward DEBT" below):**
> - `accountId = tool.developerId` — **RESOLVED-BY-DESIGN (B4, 2026-06-04): this is the PERMANENT semantic, not a stand-in. NEVER backfill settlement-row `account_id` to `accounts.id`** — the reconciler credits real money from it (`creditSettlement`: `developers.id = account_id`); a backfill would zero-match that UPDATE and un-credit collected USDC. Guard-tested (`B4 SEMANTIC GUARD`). See the B4 UPDATE at the bottom + `b4-account-attribution-resolution-2026-06-04.md`.
> - `takeBps: 0` — platform take is **NOT computed** in the settle path yet.
> - The ledger write is **FIRE-AND-FORGET** (no `waitUntil`/`after`) — can be dropped on a serverless freeze. Shared with `recordHop`/`postLedgerEntryAsync`.
> - ap2 cannot dedupe a VDC with no `transactionId` (inherent — no stable key exists).

**Chunk:** P3.K4 step **A1** — make the offline facilitator settle routes (`ap2`,
`circle-nano`) write a row to the unified `ledger_entries` table on settlement.
This is the "record" half of "make the rails actually settle + record"; the
"settle" half (real on-chain submission for circle-nano + the prod env flip) is
**A2**, deferred.

**Files touched (6):**
- `apps/web/src/app/api/ap2/settle/route.ts` — ledger write (status `settled`).
- `apps/web/src/app/api/circle-nano/settle/route.ts` — ledger write (status `pending`).
- `apps/web/src/lib/settlement/ledger.ts` — writer idempotency fix (see below).
- `apps/web/src/lib/__tests__/ledger.test.ts` — `recordSettlementEntry` conformance + idempotency tests (first coverage of this function).
- `apps/web/src/app/api/{ap2,circle-nano}/__tests__/route.test.ts` — ledger-write assertions + skip-condition + fallback tests.

---

## Decisions made (with rationale)

### 1. `accountId` = `tool.developerId` (NOT a real provider account)
`recordSettlementEntry` requires a non-null `accountId` (populates the legacy
`ledger_entries.account_id NOT NULL` column). The handoff assumed this resolves
to a provider account via `accounts (type='provider', entityId=developerId)` —
but **the `accounts` table has NO provisioning path anywhere in the codebase**
(zero `insert(accounts)` / `INSERT INTO accounts` / `entityId:` writes in app
code, SQL, scripts, or packages). The double-entry balance system is built but
unpopulated. So resolving a provider account would find nothing → A1 would
record nothing (inert).

**Decision (founder-approved 2026-05-30):** attribute settlement rows to
`tool.developerId`. `ledger_entries.account_id` has **no FK** (schema explicitly
notes this), and a settlement row is a single inert `credit` row that does **not**
touch balances (`recordSettlementEntry` only INSERTs; it never calls the
balance-updating `postLedgerEntry`), so `developerId` is a coherent attribution
tag. Functional now; reversible later.

> **DEBT (LOW):** when account provisioning is eventually built, settlement-row
> `account_id` should be remapped/backfilled from `developerId` → the real
> `accounts.id`. Reconciliation tooling (P3.RAIL2) must, until then, treat
> settlement-row `account_id` as a **developer id**, not an account id.

### 2. Honest per-rail status
- **ap2 → `settled`**: the AP2 VDC *is* the payment authorization (no external
  rail); settlement is final at validation. A `settled` row **MUST** carry
  `settledAt` (canonical validator throws `RangeError` otherwise; DB
  `ledger_entries_settled_at_shape` check backs it) — the route sets
  `settledAt: new Date().toISOString()`.
- **circle-nano → `pending`**: verified offline, but the USDC has **not** moved
  on-chain yet (that's A2). `pending` is the honest financial state.

### 3. Stable, invocation-rooted idempotency (shared writer fix)
The unified writer documented (and the `LedgerWriter` type contract requires)
idempotency on `entry.id`, but the implementation assigned a **random PK** and
did a plain INSERT with no `ON CONFLICT` — so a settle **retry wrote a duplicate
row**. Because `ap2` is **LIVE in prod** (`AP2_SIGNING_SECRET` set), this was a
real reconciliation-over-count defect introduced by A1 (caught by independent
audit).

**Fix:** `recordSettlementEntry` now derives a deterministic v5-format UUID from
`invocationId` (`settlementEntryId()`, sha256-based) and the INSERT uses
`.onConflictDoNothing()`. Same `invocationId` → same PK → exactly-once row.
- `ap2` keys on `invocationId = operationId` (= the VDC `transactionId` when present).
- `circle-nano` keys on `invocationId = circle-nano:<network>:<from>:<nonce>` (the
  stable authorization identity, NOT the random `SettlementResult.operationId`).
- **Safe for `recordHop`** (the other caller): its `invocationId = hopId`
  (random per hop) → unique derived id → conflict-guard never triggers → behavior
  unchanged.

> **`onConflictDoNothing` is FIRST-WRITE-WINS, not update-in-place.** A2 must flip
> a circle-nano `pending` row to `settled` (+ on-chain `txHash`) via an explicit
> `UPDATE` matched on the **`operation_id`** column (the stable key, stored there
> by the writer — there is no `invocation_id` column) **+ `rail`**, **not** a
> re-insert (which the conflict-guard would skip). Separately, the on-chain
> submitter dedups on `(from, nonce)` — USDC rejects nonce-reuse per signer.

---

## Carried-forward DEBT (non-blocking)

1. **(LOW) ap2 dedup gap when a VDC carries no `transactionId`.** The route's
   `operationId = verification.transactionId ?? randomUUID()`; with the random
   fallback, two settles of the same credential get different ids and don't
   dedupe. Inherent — no stable key exists for such a VDC. Unchanged by the
   idempotency fix (which is correct when a `transactionId` is present).
2. **(LOW) `takeBps: 0`.** No platform-take computation in the facilitator settle
   path; settlement rows record `takeBps=0`/`takeCents=0`. Real take computation
   is out of A1 scope.
3. **(LOW–MED, shared) Fire-and-forget without `waitUntil`/`after()`.** The
   ledger write is best-effort (`recordSettlementEntryAsync`, not awaited) — on a
   serverless freeze immediately after the response, the write can be dropped.
   At parity with `recordHop` / `postLedgerEntryAsync`. Consider Vercel `after()`
   for durable best-effort writes repo-wide.
4. **(LOW) `accountId` = `developerId` stand-in** — see Decision 1; backfill when
   account provisioning exists.

## Deferred to A2 / later (NOT in A1)
- **circle-nano real on-chain settlement** — submit `transferWithAuthorization`
  via the gas wallet (mirror `x402/settle.ts`), set **`SETTLEGRID_USDC_RECIPIENT`
  in Vercel prod** (founder-greenlit, bound to A2), flip `pending`→`settled` via
  UPDATE, dedup on `(from, nonce)`. circle-nano stays DARK in prod until then.
- **x402 ledger write** — x402 already submits on-chain (gas wallet) but has a
  *different* settle contract (raw `paymentPayload`, returns `{success, txHash}`)
  and no `toolSlug`/cost in the kernel-body shape; its ledger write belongs with
  the on-chain/real-money work (A2-grouped, with `externalRef = txHash`).
- **mpp ledger write** — no real `/api/mpp/settle` route exists (demo stub only);
  needs a route first.

---

## Audit-round record (the protocol earned its cost)

The L0/L1 gates were green (tsc, vitest, eslint, next build) AND the author's own
hostile pass found nothing — yet **3 independent fresh-context review rounds**
caught real defects the green suite masked:
- **R1** found **two BLOCKERS**: (a) ap2 `settled` without `settledAt` → the
  canonical validator throws → *every* ap2 write silently failed (zero rows);
  (b) the "idempotent by invocationId" comment was false (random PK + no
  `onConflict`). Both slipped because the route tests **mocked**
  `recordSettlementEntryAsync`, so the real validator never ran.
- **R2** confirmed the fixes AND surfaced a **FIX-NOW**: `ap2` is LIVE in prod
  (`AP2_SIGNING_SECRET` set), so the non-idempotent write was a real over-count —
  the "dark in prod" safety net only covered circle-nano. Fixed at root cause in
  the shared writer.
- **R3** (focused) verified the writer fix: PASS — dedupe path correct,
  `settlementEntryId` format/determinism/collision-safe, `recordHop` unaffected,
  only the PK unique-constraint on `ledger_entries`.

**Lesson reinforced:** for a unified-ledger write, a route test that mocks the
writer is insufficient — exercise the **real** `recordLedgerEntry` validator
against the exact input shape (now done in `ledger.test.ts`). cf.
`feedback-ke2-independent-audit-mandatory`.

---

## UPDATE — money-mechanics chunk (2026-06-04): debt resolutions

The "settlement money-mechanics completion" chunk
(`settlement-money-mechanics-seal-2026-06-04.md`, SEALED) re-grounded these debts
against the actual code and resolved/dispositioned them:

- **`takeBps: 0` → RESOLVED-AS-CORRECT (not a gap).** Monetization is already live as a
  *progressive payout-time* take (`lib/pricing.ts:calculateTakeCents`, 0/2/2.5/5%, applied
  at `payouts/process.ts:259-261`); the dev is credited GROSS at settle. So at the
  settlement *event* the platform takes 0 — `take_bps=0` on a settlement row is the honest
  record. Wiring a flat per-row take would misrepresent the progressive payout take and risk
  a double-count. `revenueSharePct` is legacy/ignored. Per-rail settlement-time take, if ever
  wanted, is a separate chunk (it would touch the sealed credit path + needs its own audit).
- **Fire-and-forget ledger write (ap2) → RESOLVED.** `/api/ap2/settle` now wraps the write
  in Vercel `after()` (`after(() => recordSettlementEntry(...).catch(...))`, Next ^15.1) so a
  serverless freeze can't drop the audit row. NOTE the void-returning `recordSettlementEntryAsync`
  could NOT simply be wrapped (after() would have nothing to await) — the awaited
  `recordSettlementEntry` is returned from the callback. Repo-wide fire-and-forget
  (`settlement/sessions.ts:469` `recordHop`, `postLedgerEntryAsync`) remains deferred.
- **`accountId = developerId` stand-in → STILL DEFERRED.** No `accounts` provisioning path
  exists anywhere (re-confirmed). Backfill settlement-row `account_id` → real `accounts.id`
  when provisioning lands; reconciliation must keep treating it as a developer id until then.
- **ap2 dedup gap (no `transactionId`) → STILL DEFERRED (inherent).** No stable key exists.

## UPDATE — ACP-claims chunk Step-0 (2026-06-04): B4 queued + a latent recordHop finding

- **`accountId = developerId` stand-in → QUEUED as the leading next real-settlement
  chunk** ("B4": accounts provisioning + settlement-row backfill + reconciliation-tooling
  update). Founder-ranked ahead of ACP-dark wiring. Own Step-0 + full audit chain.
- **Discovered (non-money, latent):** `recordHop`'s unified-ledger write
  (`sessions.ts:469`) is UNREACHABLE from prod — the only prod caller
  (`api/sessions/[id]/hop/route.ts`) has a zod schema that never accepts
  `rail`/`protocol`/`accountId`, so the P3.K4 per-hop settlement-row trail never fires.
  The "fire-and-forget durability" debt above is therefore moot for live traffic (every
  LIVE settlement write is durable: x402 + circle-nano await inline, ap2 uses `after()`).
  Fix when multi-hop ledger attribution is wanted = extend the hop route schema (and
  wrap the write durably then). JSONB budget accounting is authoritative + unaffected.

Also closed (not an A1 debt, but adjacent): **circle-nano over-collection** — the rail now
enforces `value === cost` (parity with x402) at the verify choke point, so an over-authorized
payment is rejected before any on-chain submit (was: full value collected, dev credited cost,
excess silently retained).

## UPDATE — B4 chunk (2026-06-04): the accountId stand-in is RESOLVED-BY-DESIGN

- **Decision 1's `accountId = developerId` "stand-in" → RESOLVED-BY-DESIGN (founder Step-0,
  option B).** "Settlement-row `account_id` IS the owning developer's id" is now the
  **PERMANENT, documented, guard-tested semantic**. The "backfill to real `accounts.id` when
  provisioning lands" instruction above (Decision 1 + Carried-forward DEBT #4) is **RETIRED —
  do NOT execute it**: the reconciler credits real money from settlement-row `account_id`
  (`reconcile.ts` `creditSettlement`: `developers.id = account_id`), so a backfill would
  zero-match that UPDATE and un-credit genuinely-collected USDC (loud since B4 —
  `settlement.credit_failed` — but still un-credited). `accounts` stays dormant until a real
  double-entry requirement lands; (A)(i)'s additive `provider_account_id` column remains the
  funds-safe shape if that day comes.
- **Hardening shipped with it:** `creditSettlement`'s developers UPDATE now detects a zero-row
  match (`.returning({id})` + throw-inside-txn → rollback → the existing catch logs
  `settlement.credit_failed`) instead of committing empty and logging a FALSE
  `settlement.credited`. Reachable via dangling developer ids (deleted dev) even without any
  backfill.
- **Guards:** `rg "B4 SEMANTIC GUARD"` — reconcile.test.ts (the `row.accountId → developers.id`
  credit-linkage pin + the zero-row alert) and both proxy settlement tests (writers pass
  `toolRow.developerId`). A code-side re-point now breaks CI, not prod.
- Full record: `b4-account-attribution-resolution-2026-06-04.md` (capstone) +
  `b4-account-attribution-build-plan-2026-06-04.md` (PLAN_READY R1) + the SEAL verdict
  (`.audit/b4-postbuild/`, local).
