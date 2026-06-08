# (H) multi-hop hop-route ledger rail-enum guard + (F1) NAT-fairness sessionLimiter split — CAPSTONE (2026-06-08)

> **CLOSED + SEALED + DEEP-AUDIT-STANDS.** Local commit landed atop deployed `origin/main` = `839455fb`.
> NOT pushed / NOT deployed / no migration / nothing published — all founder-gated.
> Source-of-truth chain: trace `h-f1-trace-2026-06-08.md` → plan `h-f1-build-plan-2026-06-08.md` →
> post-seal handoff `h-f1-post-seal-handoff-2026-06-08.md` → this capstone.

## 1. What shipped (two surgical, separable workstreams)

**(H) — funds/reconciler surface (safety-only).** `recordHop` (`lib/settlement/sessions.ts`) now **skips**
the unified-ledger settlement write (and logs `session.hop_settlement_skipped_onchain_rail`) when
`isReconcilableRail(input.rail)` — i.e. `rail ∈ {circle-nano, x402}` — and writes exactly as before for
off-chain rails. The hop is **still recorded for budget** (the synchronous `hops` JSONB-append + `spentCents`
update is unchanged, above the guard). A new leaf module `lib/settlement/rails.ts` is the single source of
`RECONCILABLE_RAILS` + `isReconcilableRail`, imported by **both** `reconcile.ts` (the reconciler's SELECT
`inArray`) and `sessions.ts` (the guard) — so the guard's exclusion set and the reconciler's selection set
**cannot drift** (provable by construction). **No migration. The hop ledger TRAIL is NOT activated.**
Durability stays lib fire-and-forget.

**Why it matters:** a hop ledger row written for an on-chain rail (`x402`/`circle-nano`) with an
`external_ref` satisfied all four of the reconciler's WHERE conjuncts, but its `operation_id` is a bare
random UUID (the `hopId`) that never parses as a settlement op-id → `skipped-unparseable` → re-SELECTed
**every run forever**, starving the reconciler's bounded 25-row batch. Mis-credit was **already impossible**
(`skipped-unparseable` precedes any credit), so (H) fixes a **reconciler liveness / starvation hazard**, not
a money hole. Funds-neutral: the guard writes nothing new in prod (the public hop route's zod still strips
rail fields — the trail is latent), and excludes the duplicative on-chain row by construction.

**(F1) — rate-limit posture (bounded NAT-fairness loosening).** New
`sessionLimiter = lazyLimiter(5000,'1 m')` applied to the **4 non-inserting** in-session routes
(`session-hop` / `session-get` / `session-finalize` / `session-complete`), so a single NAT/cloud egress
fronting many legitimate agents is no longer collectively throttled at the shared 1000/min (dominated by
`hop`). The **row-inserting** routes (`session-create`, `session-delegate` → `createSession`'s insert) stay
**byte-stable on `sdkLimiter` (1000)** — keeping parity with `outcomes-create` and avoiding any 5×
amplification of unbounded `workflow_sessions` growth (no purge cron exists). Every money path
(proxy / sdk-meter / billing-webhook / mcp / …) stays at 1000.

## 2. The two load-bearing decisions (judged strictly; both held)

- **LB-1 — which subsystem + does the guard truly exclude hop rows?** (H) = **Subsystem 1** (the unified
  ledger), **safety-only**. Subsystem 2 (`processSettlementBatch` / `finalizeSession` deferred branch — the
  (C) deferred path) and hop-trail activation (auth'd `accountId` + zod wiring) were held **OUT**. The guard
  lives in `recordHop` (the sole `recordSettlementEntryAsync` caller), **not** in the shared writer
  `recordSettlementEntry` (whose 3 legit on-chain callers — `ap2/settle`, `circle-nano/settle`,
  `x402/orchestrate` — must keep writing reconcilable rows). Proven by construction via the shared constant.
- **LB-2 — is the loosening bounded + the mock-sweep exact?** Raising the shared `sdkLimiter` was rejected
  (would loosen the money proxy / metering / billing). The handoff's **"~84-of-87 file mock sweep" was a
  large over-estimate** → **0 forced mock breaks** (only `sessions.test.ts` imports the session routes, and
  it mocks `checkRateLimit`, so the limiter swap is invisible). The audit's row-insert refinement produced
  the create/delegate-stay-at-1000 split.

## 3. Gate arc — three independent gates, each 0-blocking / full-coverage

| Gate | Mechanism | Result | runId |
|---|---|---|---|
| Pre-build audit | 7 lenses + adversarial verify (mechanical-first) | **PLAN_READY** · 0 blocking · 0 dead/0 null | `wf_770141d2-15b` |
| Executable gate | clean full suite | tsc 0 · vitest **4301/184** (4283 + 18) · next build 0 · eslint 0 · mcp **1898/1** | — |
| Seal-gating review (②) | 6 fresh-context lenses, refute-by-default, on the diff | **CERTIFIED** · 0 blocking · 0 dead/0 null | `wf_a4afe8ce-ca6` |
| Post-seal deep audit (③) | 4 integrated-whole lenses + completeness critic | **STANDS** · 0 blocking · 0 dead/0 null | `wf_4004a763-2fe` |

Fail-pre-fix proven empirically (5 behavior tests red pre-fix → green post-fix; `.audit/h-build/`).
Certified bytes snapshotted at `.audit/h-certify/SNAPSHOT.sha256` (matched at commit time — no drift).

## 4. Change set (committed — path-scoped, atomic, local-only)
`lib/settlement/rails.ts` (new) · `lib/rate-limit.ts` (sessionLimiter export) · `lib/settlement/reconcile.ts`
(const→import swap; confirm logic byte-stable) · `lib/settlement/sessions.ts` (the guard) · the 4 non-inserting
session `route.ts` · `lib/settlement/__tests__/hop-rail-guard.test.ts` (new) ·
`app/api/sessions/[id]/hop/__tests__/route.test.ts` (new) · `lib/settlement/__tests__/reconcile.test.ts` ·
`lib/__tests__/rate-limit.test.ts` · `app/api/__tests__/sessions.test.ts` · the h-f1 docs + this capstone.
**Byte-stable spine** (verified empty diff): the shared writer + its 3 on-chain callers, the reconciler
confirm/credit logic, `create`/`delegate` routes, pricing/payouts/crypto/meter-credit/`packages/mcp`/
`packages/sdk-python*`, all other `sdkLimiter` routes.

## 5. Residuals (honest) + what's next
- **(H) is safety-only.** Activating the hop ledger **trail** (an auth'd internal caller supplying a trusted
  `accountId` + wiring it through the hop-route zod) is a **separate, larger, separately-audited chunk** — a
  caller-supplied `accountId` on the unauthenticated hop route would be a money-attribution vulnerability,
  which is why it's OUT here. **This also remains the path that would activate (C)'s now-correct deferred
  settlement** — re-verify end-to-end if/when taken.
- **(F1) N=5000** is audit-confirmed non-blocking (financial abuse impossible at any N; the 4 raised routes
  are budget-capped + non-row-inserting). Founder-tunable.
- **Subsystem 2** (batch settlement) remains UNWIRED and OUT.
- **Next chunk:** founder's pick from the gated menu (see the register + the post-(H/F1) handoff). No
  non-gated engineering work is outstanding from this chunk.
