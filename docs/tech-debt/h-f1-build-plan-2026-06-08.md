# (H) multi-hop ledger guard + (F1) NAT-fairness IP-raise — BUILD PLAN

> **STATUS: PLAN_READY** — Phase-3 pre-build audit (`.audit/h-prebuild/`, runId `wf_770141d2-15b`) returned
> **PLAN_READY / 0 blocking / 0 dead lenses / 0 null verdicts** (full 7-dimension coverage; every
> load-bearing claim independently re-derived). The 3 actionable non-blocking improvements are FOLDED below.
> TIER: **HIGH-STAKES** (money/reconciler invariant + rate-limit security boundary + the moat). Source:
> `h-f1-trace-2026-06-08.md`. HEAD `839455fb`. Single-writer build. No push / prod-env / migration-apply / publish.

> ### Phase-3 audit fold (2026-06-08 — non-blocking improvements applied)
> - **#3 (F1 split — security-tightening + smaller diff):** the audit confirmed financial abuse is impossible
>   at any N, but flagged that the ROW-INSERTING session routes (`create`, `delegate`→`createSession` insert)
>   at 5000/min/IP would 5× a pre-existing unbounded-`workflow_sessions`-growth DoS (no DELETE/purge anywhere),
>   while the structural twin `outcomes-create` sits at 1000. **Fold:** keep `create`+`delegate` byte-stable on
>   `sdkLimiter` (1000); apply the new `sessionLimiter` (5000) ONLY to the non-inserting in-session ops
>   (`hop`, `get`, `finalize`, `complete`). Strictly safer; 4 route edits instead of 6. Verified live:
>   `delegate`→`createSession` inserts (delegate/route.ts:48→sessions.ts:126); `complete`/`finalize`/`hop`/`get`
>   do not (UPDATE/SELECT/JSONB-append only).
> - **#4 (hop test code 422):** the hop route's `parseBody` throws **422** on a zod violation (api.ts:73-76);
>   400 only on unparseable JSON. §5 corrected.
> - **#5 (numstat skips untracked):** `git diff --numstat` omits untracked files; §7 now leads the confinement
>   proof with `git status --porcelain` (lists net-new files as `??`) + `git add -N` for a unified numstat.

## 1. Goal + honest framing

Two surgical, separable workstreams on two surfaces:

- **(H) — funds surface.** Close the **reconciler-starvation trap** by construction: a `recordHop` hop
  ledger row carrying an on-chain rail (`x402`/`circle-nano`) + an `external_ref` is re-SELECTed by the
  settlement reconciler **forever** (`skipped-unparseable`), starving its bounded 25-row batch. Fix =
  a **rail-enum guard** at the single hop write site, sharing the reconciler's own `RECONCILABLE_RAILS`
  constant so the exclusion is provable-by-construction and drift-proof. Plus the **durability decision**
  (keep lib fire-and-forget — justified) and the **missing hop API-layer test**. **Honest scope:** this is
  a *liveness/starvation* hardening of a **latent** path (no prod caller — the hop route's zod strips rail
  fields); **mis-credit was already impossible** (`skipped-unparseable` precedes any credit). It is
  **provably ledger-neutral** (no new ledger write fires in prod). We are **not** activating the trail.

- **(F1) — rate-limit posture.** Raise the per-IP limit on the **4 non-inserting in-session routes**
  (`hop`/`get`/`finalize`/`complete`; a NAT/cloud egress fronting many legitimate agents is collectively
  throttled at the shared 1000/min, dominated by `hop`). Add a dedicated `sessionLimiter` (5000); leave the
  row-inserting `create`/`delegate` and every other `sdkLimiter` route — including all money paths — at
  1000/min. **Deliberate, bounded flood-posture loosening** on budget-capped, non-financial routes.

## 2. Resolved load-bearing decisions (proofs in trace §1–§2)

- **LB-1a:** (H) = **Subsystem 1** (unified ledger). Subsystem 2 (`processSettlementBatch`, unwired — no
  prod caller; `createSession` hardcodes `immediate`) and **trail activation** (auth'd `accountId` + zod
  wiring) are **OUT** (future items; founder-flag the latter).
- **LB-1b:** Guard lives in `recordHop` (`sessions.ts:461-468`), the **only** caller of
  `recordSettlementEntryAsync`. It **cannot** live in the shared writer `recordSettlementEntry` — that is
  the legit on-chain settle path (`ap2/settle/route.ts:176`, `circle-nano/settle.ts:85`,
  `x402/orchestrate.ts:136`) which **must** keep writing reconcilable rows. **Proof:** reconciler selects
  only `inArray(rail, RECONCILABLE_RAILS)`; guard excludes exactly `RECONCILABLE_RAILS` (same constant) ⟹
  hop rows ∉ reconciler selection. No migration (rail is free `text`; single app writer ⟹ by-construction).
- **LB-1c:** Durability = **lib fire-and-forget** retained (budget is authoritative via the synchronous
  JSONB+`spentCents` write `sessions.ts:446-453`; hop ledger row is non-authoritative audit; route-durable
  `after()` breaks request-scope-free tests — the B2-moot finding — and needs the activation we ruled out).
- **LB-2a:** F1 = **new `sessionLimiter` (5000)** on the 4 NON-inserting in-session routes (`hop`/`get`/
  `finalize`/`complete`); the row-inserting `create`+`delegate` stay byte-stable on `sdkLimiter` (1000).
  Raising shared `sdkLimiter` would loosen the money proxy / sdk-meter / billing-webhook — OUT.
- **LB-2b:** Exact forced mock-sweep = **0 files** (S = {`sessions.test.ts`}; it mocks `checkRateLimit`,
  asserts no limiter identity ⟹ swap invisible). Corrects the "~84" estimate. **Re-proven empirically at
  build** (green suite post-rewire). F1 test work is **additive**.
- **LB-2c:** N = **5000/min/IP** for the non-inserting in-session ops (bounded, non-financial, no row insert);
  `create`/`delegate` stay at **1000** (row-inserters, parity with `outcomes-create`). Audit/founder-tunable.

## 3. EXACT per-file recipes

### (H-1) NEW `apps/web/src/lib/settlement/rails.ts` — single source of truth
```ts
/**
 * On-chain settlement rails — single source of truth.
 *
 * These rails settle USDC on-chain (broadcast→confirm) and are SELECTed by the
 * pending-settlement reconciler (reconcile.ts) by txHash: a row with rail ∈ this
 * set + non-null external_ref + status 'pending' enters the confirmable window.
 *
 * The multi-hop hop→ledger attribution path (recordHop) MUST exclude these rails
 * by construction. A hop's operation_id is a bare random UUID (the hopId), which
 * can never parse as a settlement operation_id (`<rail>:<network>:<from>:<nonce>`),
 * so a hop row carrying an on-chain rail + external_ref would be re-SELECTed by
 * the reconciler every run forever (skipped-unparseable), starving its bounded
 * batch. Sharing THIS constant between the reconciler's selection (inArray) and
 * the hop guard's exclusion makes the exclusion provable-by-construction and
 * drift-proof. See docs/tech-debt/h-f1-trace-2026-06-08.md §1b.
 */
export const RECONCILABLE_RAILS = ['circle-nano', 'x402'] as const

export type ReconcilableRail = (typeof RECONCILABLE_RAILS)[number]

/** True iff `rail` settles on-chain and is reconciled by the settlement reconciler. */
export function isReconcilableRail(rail: string): boolean {
  return (RECONCILABLE_RAILS as readonly string[]).includes(rail)
}
```

### (H-2) EDIT `apps/web/src/lib/settlement/reconcile.ts` — source the constant (behavior-neutral)
- Add near the relative imports (after `import { confirmSettlementTx } …` :26):
  `import { RECONCILABLE_RAILS } from './rails'`
- Delete the local definition (`:28-29`):
  ```ts
  /** Rails that settle on-chain (broadcast→confirm) and so can be reconciled by txHash. */
  const RECONCILABLE_RAILS = ['circle-nano', 'x402'] as const
  ```
- `:304` `inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS])` is unchanged (spreads the imported readonly
  tuple). **Confirm logic byte-stable.** This is the ONE intentional touch to the frozen reconciler.

### (H-3) EDIT `apps/web/src/lib/settlement/sessions.ts` — the rail-enum guard
- Add to imports (after `:17` `import { recordSettlementEntryAsync } from './ledger'`):
  `import { isReconcilableRail } from './rails'`
- Replace the settlement-write block (`:461-483`): wrap the existing `recordSettlementEntryAsync({…})`
  call (body unchanged) in an `else`, guarded by an on-chain-rail skip:
  ```ts
    if (
      typeof input.rail === 'string' &&
      input.rail.length > 0 &&
      typeof input.protocol === 'string' &&
      input.protocol.length > 0 &&
      typeof input.accountId === 'string' &&
      input.accountId.length > 0
    ) {
      if (isReconcilableRail(input.rail)) {
        // Rail-enum guard (H, 2026-06-08). On-chain rails (x402 / circle-nano)
        // settle via their own engines, which write the authoritative,
        // reconcilable ledger row with a parseable operation_id. A HOP row for
        // an on-chain rail carries a bare-UUID hopId as operation_id, so the
        // reconciler would re-SELECT it every run forever (skipped-unparseable)
        // and starve its bounded batch. Exclude on-chain rails from the hop
        // attribution path BY CONSTRUCTION — the hop is still recorded for
        // budget (above); only the duplicative on-chain ledger row is skipped.
        // Shares RECONCILABLE_RAILS with reconcile.ts so the two cannot drift.
        // See docs/tech-debt/h-f1-trace-2026-06-08.md §1b.
        logger.warn('session.hop_settlement_skipped_onchain_rail', {
          sessionId,
          hopId,
          rail: input.rail,
        })
      } else {
        recordSettlementEntryAsync({
          invocationId: hopId,
          sessionId,
          rail: input.rail,
          protocol: input.protocol,
          amountCents: input.costCents,
          currency: input.currency ?? 'USD',
          takeBps: input.takeBps ?? 0,
          status: 'pending',
          externalRef: input.externalRef ?? null,
          metadata: input.metadata ?? null,
          accountId: input.accountId,
          description: `Hop ${input.serviceId}/${input.method} via ${input.rail}/${input.protocol}`,
        })
      }
    }
  ```

### (F1-1) EDIT `apps/web/src/lib/rate-limit.ts` — new export (after `sdkLimiter` :100)
```ts
/**
 * 5000 requests per minute — for the multi-hop IN-SESSION operation routes
 * (session-hop / session-get / session-finalize / session-complete), keyed
 * `session-*:<ip>`. Deliberately higher than the shared sdkLimiter (1000/min;
 * F1, 2026-06-08): a single NAT/cloud egress fronting many legitimate agents was
 * collectively throttled at 1000/min, dominated by the high-frequency hop route.
 * These four routes are budget-capped, non-financial, and do NOT insert a
 * workflow_sessions row (recordHop appends JSONB + increments spentCents; get
 * reads; finalize/complete are state transitions), so a higher per-IP ceiling
 * raises only infra load. The ROW-INSERTING session routes (session-create /
 * session-delegate, both via createSession's insert) deliberately STAY on the
 * shared sdkLimiter (1000/min) — in line with the platform's existing
 * unauth-row-insert limit (outcomes-create) — so this change does NOT amplify the
 * unbounded workflow_sessions growth (there is no purge cron). Every money path
 * (proxy / sdk-meter / billing-webhook / mcp) also stays on sdkLimiter.
 * See docs/tech-debt/h-f1-trace-2026-06-08.md §2 + the Phase-3 audit fold.
 */
export const sessionLimiter = lazyLimiter(5000, '1 m')
```

### (F1-2) EDIT the 4 NON-inserting session routes — swap `sdkLimiter` → `sessionLimiter` (import + call)
| file | import line | call |
|---|---|---|
| `app/api/sessions/[id]/route.ts` | `:5` | `:18` `session-get` |
| `app/api/sessions/[id]/hop/route.ts` | `:6` | `:28` `session-hop` |
| `app/api/sessions/[id]/finalize/route.ts` | `:5` | `:18` `session-finalize` |
| `app/api/sessions/[id]/complete/route.ts` | `:5` | `:18` `session-complete` |

**UNCHANGED — byte-stable, stay on `sdkLimiter` (1000/min); the row-inserting routes (Phase-3 fold #3):**
`app/api/sessions/route.ts` (`session-create`) and `app/api/sessions/[id]/delegate/route.ts`
(`session-delegate` → `createSession`'s insert). Bucket-key strings unchanged; only the limiter symbol
changes on the 4. `finalize` has no route test today (pre-existing gap; swap is tsc-checked + covered by the
empirical suite).

## 4. (H) worked before/after ledger-flow (the guard-by-construction demonstration)

| hop input | BEFORE (unguarded) | AFTER (guarded) |
|---|---|---|
| `rail='stripe-connect'`, protocol, accountId, `externalRef='pi_abc'` (off-chain) | writes ledger row; reconciler `inArray(rail,{circle-nano,x402})` ✗ → **never selected** | identical — row written, never selected |
| `rail='x402'`, accountId, `externalRef='0x…'` (on-chain) — **the trap** | writes row; reconciler: `x402∈set ✓ ∧ external_ref≠null ✓ ∧ pending ✓ ∧ old ✓` → **SELECTED** → `parseSettlementOperationId(hopId,'x402')`=null → `skipped-unparseable` → stays pending → **re-selected forever → STARVATION** | **no settlement row written** (guard skips + `logger.warn`); hop still recorded for budget; reconciler has nothing to select → **trap closed by construction** |
| `rail='circle-nano'`, … (on-chain) | same trap | same — skipped |

Off-chain hop rows remaining `pending` (no flip path) is **pre-existing latent behavior** of the
non-activated trail (nothing reads them; not reconciler-visible) — **out of scope.** (H) addresses only
the on-chain-rail starvation vector.

## 5. Tests (behavior-change ⟹ FAIL pre-fix; regression-guarded behavior-neutral ⟹ stay green)

**Behavior-change (must fail pre-fix — proven empirically, recorded to `.audit/h-build/`):**
- `lib/settlement/__tests__/hop-rail-guard.test.ts` (NEW, hoisted-mock style à la `reconcile.test.ts`;
  mocks `@/lib/settlement/ledger` to spy `recordSettlementEntryAsync`, plus db/redis/logger/drizzle):
  - `rail='x402'` (+ protocol + accountId) + externalRef ⟹ `recordSettlementEntryAsync` **NOT** called +
    `logger.warn('session.hop_settlement_skipped_onchain_rail', …)`. **Fails pre-fix** (unguarded calls it).
  - `rail='circle-nano'` ⟹ NOT called.
  - control `rail='stripe-connect'` ⟹ **IS** called (off-chain unaffected).
  - shared-constant pin: guard excludes exactly the imported `RECONCILABLE_RAILS`.
- `app/api/sessions/[id]/hop/__tests__/route.test.ts` (NEW — the (H) missing API test; mirrors
  `tools/serve/[slug]/__tests__/route.test.ts`): 200 success, rate-limit 429 (via `sessionLimiter`), 402
  `BUDGET_EXCEEDED`, 404 `SESSION_NOT_FOUND`, **422** on a zod violation (`parseBody`→`ParseBodyError(...,422)`,
  api.ts:73-76; 400 is only for unparseable JSON). **New coverage** (route had none).
- `lib/__tests__/rate-limit.test.ts` (EDIT): `sessionLimiter` defined + `typeof .limit==='function'` +
  pin its configured limit (so a silent re-tune trips CI). **Fails pre-fix** (no export).
- `app/api/__tests__/sessions.test.ts` (EDIT): tag the rate-limit mock with distinguishable stubs
  (`sdkLimiter:{__id:'sdkLimiter'}`, `sessionLimiter:{__id:'sessionLimiter'}`); assert `get`+`complete` call
  `checkRateLimit` with `sessionLimiter` while `create`+`delegate` still call it with `sdkLimiter` (the test
  imports all four → it pins the SPLIT directly). **Fails pre-fix** (`get`/`complete` still use `sdkLimiter`).

**Behavior-neutral / regression pins (must stay green):**
- `lib/settlement/__tests__/reconcile.test.ts` (EDIT, +1 assertion): the SELECT calls
  `inArray(ledgerEntries.rail, RECONCILABLE_RAILS)` with the exported constant (locks the link). All 355
  existing lines unchanged.
- `multi-hop.test.ts`, `settlement-moat.test.ts`, `compare-nevermined.test.ts`, `smoke.test.ts`:
  **no edits** — verified none exercise the on-chain-rail hop path or assert session-route limiter identity.

**N_new = 18** (LOCKED at build): hop-rail-guard 5 + hop API 5 + reconcile-pin +1 + rate-limit sessionLimiter +3
+ sessions split-pins +4. End-state **4301 tests / 184 files** (4283 + 18; 182 + 2 new files), zero regression.

## 6. Byte-stable SPINE (verbatim) + embedded SCOPE GUARD

**OUT (byte-stable unless the trace proved a planned change requires it):** Subsystem 2 batch settlement
(`processSettlementBatch` / `finalizeSession` deferred branch / `createSession` deferred mode /
`settlementBatches` take math — (C) made it take-correct; do NOT activate); **hop-trail activation**
(auth'd `accountId` + hop-route zod wiring); the reconciler **confirm logic** (`reconcileOneRow` /
`creditSettlement` / `parseSettlementOperationId` / on-chain settle engines / `interpretReceipt` / nonce);
`recordSettlementEntry` (shared writer) + its 3 legit callers; `lib/pricing.ts`; `lib/payouts/**`; the
meter credit path; `deductCreditsRedis` / balance authority / dedup / B4 `account_id` semantics;
`lib/crypto.ts` / key formats; x402/ap2/circle-nano adapters; ALL `packages/mcp`; ALL `packages/sdk-python*`;
**all other `sdkLimiter` routes** (proxy/sdk/billing/mcp/tools-serve/agents/outcomes/settlements — keep
1000/min) **including the row-inserting `session-create` + `session-delegate`** (Phase-3 fold #3 — NOT
rewired); settled designs (F2/F3/F4/N/M/H1/R/(C)).

**SCOPE GUARD (embed in the audit + seal VERBATIM):** Objective confidence, NOT finding-count. **Zero
findings is a valid outcome.** A finding that grows scope is `rejected-scope-expansion`, NOT blocking,
unless it proves a PLANNED change is itself wrong. Hold the line against: activating Subsystem 2 or the
hop trail; changing reconciler confirm logic / settle engines / nonce; re-tuning `lib/pricing.ts` or
`lib/payouts/**`; touching the meter credit path / `deductCreditsRedis` / balance authority / dedup / B4
`account_id` / `hashApiKey` / adapters / `packages/mcp` / `packages/sdk-python*`; re-litigating settled
designs without a NEW trace; PyPI/npm publishing. Re-opening a settled decision requires a concrete new trace.

## 7. Machine gates (end-state) + rollout

- `apps/web`: `npx tsc --noEmit` **0** ✓ · `npx vitest run` **= 4301 / 184 files, 0 fail** ✓ · `npx next build`
  **0** · `npx eslint <changed files>` **0** ✓. (All recorded in `.audit/h-build/gate-*.log`.)
- `packages/mcp`: `npx vitest run` **1898 pass / 1 skip** (byte-stable — untouched proof).
- Python (`packages/sdk-python*`): `git diff --numstat` **empty**.
- **Confinement proof** — `git status --porcelain` is PRIMARY (it lists the net-new files as `??`; `git diff
  --numstat` alone skips untracked — Phase-3 fold #5; run `git add -N` on the 3 net-new files first for a
  unified numstat). The diff must be confined to: `lib/rate-limit.ts`, `lib/settlement/rails.ts` (new),
  `lib/settlement/reconcile.ts`, `lib/settlement/sessions.ts`, the **4 non-inserting session `route.ts`**
  (`[id]`, `[id]/hop`, `[id]/finalize`, `[id]/complete` — NOT `sessions/route.ts` or `[id]/delegate`),
  `lib/settlement/__tests__/hop-rail-guard.test.ts` (new), `app/api/sessions/[id]/hop/__tests__/route.test.ts`
  (new), `lib/settlement/__tests__/reconcile.test.ts`, `lib/__tests__/rate-limit.test.ts`,
  `app/api/__tests__/sessions.test.ts`, + docs/.audit. **No migration.**
- **Rollout:** fresh local commit atop deployed `839455fb`; **founder-gated** push/deploy. F1 changes only
  in-process limiter config (no infra/env change); (H) is ledger-neutral (no prod write-path change). No
  migration to apply. Reversible by revert.

## 8. Open items (+ one founder flag)
1. **N = 5000** (non-inserting in-session routes) — audit-confirmed non-blocking (financial abuse
   impossible at any N); founder may tune. `create`/`delegate` stay at 1000.
2. **`rails.ts` leaf module** — adopted (recommended over `export const` from `reconcile.ts`).
3. **Safety-only (H)** — FOUNDER FLAG at close: if the multi-hop ledger **trail** is wanted *active* (not
   just guarded), that is a larger separately-audited chunk (auth'd `accountId` + zod wiring).
4. **RESOLVED (Phase-3 fold #3):** split adopted — `sessionLimiter` 5000 on the 4 non-inserting in-session
   routes; row-inserting `create`/`delegate` stay byte-stable at 1000 (parity with `outcomes-create`).
