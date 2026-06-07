# Next-chunk handoff — POST-(C) (2026-06-07)

> Written at the close of **(C) `revenueSharePct` take-model reconciliation** (capstone:
> `c-revenuesharepct-reconciliation-resolution-2026-06-07.md`). Read that + the register
> (`publisher-api-keys-audit-2026-05-28.md`) first.

## TL;DR — the non-gated engineering queue is now EMPTY

(C) was the last viable non-gated engineering chunk (the post-(R) menu named it the next lead). With it
closed, **every remaining menu item is gated** — there is no autonomous engineering chunk to start
without a founder/BD/demand trigger. The highest-value next action is the founder's **deploy + migration
+ (deferred) publish** of the accumulated local stack.

## Ground state
- Repo `/Users/lex/settlegrid`, branch `main`. The local stack is **NOT pushed**; `origin/main =
  9d22fd2e` (prod runs origin/main). Unpushed local commits, oldest→newest:
  `…→ aa580355 (N) → 2b479a3e (F2) → fa7b7dbb (F4) → fe8dbdd5 → ab243884 (R) → <new (C) commit>`.
- (C) is a **LOCAL** commit. Migration `apps/web/drizzle/0014_drop_revenue_share_pct.sql` is
  **generated, NOT applied**.
- Baselines at the (C) commit: apps/web tsc 0 / vitest **4283** / build 0 / eslint 0; packages/mcp
  **1898/1**; Python family byte-stable.

## The founder's ship list (gated — needs the founder's word)
1. **Push** the local stack (N/F2/F4/R/C) to `origin/main`.
2. **Deploy** that bundle. (C)'s code stops reading `developers.revenue_share_pct`.
3. **Apply migration `0014`** via the Supabase SQL Editor **AFTER** the deploy is live (expand/contract:
   code-first, then DROP), and **seed the matching bootstrap hash row**
   (`scripts/bootstrap__drizzle_migrations.sql`, sha256 `e720ecaa…`). Founder-gated; do NOT auto-apply.
4. **Publish** (deferred): the Python SDK family `/meter` 401 residual (F4-era) — npm/PyPI publishing is
   founder-gated; no chunk has published.

## The remaining menu — ALL gated (unchanged from post-(R))
- **(K) HMAC-pepper for the API keyspace** (register DEBT #3) — **DE-recommended** by the prior decision
  (negligible 256-bit collision risk; needs dual-read/migration). Only if the founder wants
  defense-in-depth on a DB-disclosure threat model.
- **(A) ACP "dark" adapter** — **BD-gated** (needs a partner/commercial trigger).
- **(H) multi-hop extension + F1 NAT-raise** — **demand-gated** (no live multi-hop traffic; this is also
  what would activate (C)'s now-correct deferred settlement path — see below).
- Register **#1** (rate-limit fail-static + XFF) — largely addressed by H1/M/N; any residual is a
  cross-cutting hardening pass, not a chunk.
- Register **#5** (`processDataDeletion` idempotency) — LOW, pre-existing; fix opportunistically.

## Note for whoever eventually does (H)
(C) fixed the **funds math** of `finalizeSession`'s deferred/atomic branch (full credit, single take at
payout). It did **not** wire `processSettlementBatch` (still no caller) or make `createSession` produce
non-`immediate` sessions. When (H) activates deferred/atomic sessions, the settlement path is now
take-correct — but re-verify end-to-end (wire `processSettlementBatch` via a cron/route; confirm the
balanceCents credit → payout single-take holds with real multi-hop data).

## Guardrails carried forward
Single-writer core; fan-out only for audit gates. Money spine = funds-SEAL discipline. Do NOT push,
change prod env, **apply** migrations, or publish without the founder's word. DB access read-only.
