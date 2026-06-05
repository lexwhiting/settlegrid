# B4 — settlement-row account attribution RESOLVED-BY-DESIGN (2026-06-04)

> Capstone for the B4 chunk. Builds on the handoff
> (`b4-settlement-account-attribution-handoff-2026-06-04.md`) + the build plan
> (`b4-account-attribution-build-plan-2026-06-04.md`, pre-build audit PLAN_READY R1).
> The reconciler credit path is LIVE money (x402 + circle-nano settle real USDC on
> Base). Commit is LOCAL-ONLY (push founder-gated).

## The Step-0 decision (founder, 2026-06-04)

**Option (B): formalize the stand-in.** "Settlement-row `account_id` IS the owning
developer's id" is now the **PERMANENT, documented, guard-tested semantic** — NOT a
stand-in awaiting backfill. The A1 register's "backfill `account_id` → real
`accounts.id` when provisioning lands" instruction is **RETIRED**: it was the trap,
not the fix. A backfill would make the reconciler's credit UPDATE
(`creditSettlement`: `developers.id = account_id`) match zero rows, commit empty, log
a FALSE `settlement.credited`, and — because the flip precedes the credit — the row
would never be re-selected: permanent, alarm-free loss of genuinely-collected USDC
credit. Founder ALSO approved one adjacent hardening (below).

Why (B): the system as built was internally consistent (every writer stores a
developer id; the one money-reader treats it as one). The hazard was the
undocumented invariant + the register language inviting the backfill. (A)(i)'s
additive `provider_account_id` column remains fully available later if audit-grade
double-entry books become a requirement; nothing shipped forecloses it.

## What shipped (1 executable change + semantic formalization + guards)

- **`creditSettlement` zero-row observability** (`reconcile.ts`): the developers
  UPDATE now chains `.returning({ id })` (the repo's established affected-row idiom —
  `markSettlementSettled` precedent) and **throws inside the transaction** on
  `credited.length === 0` → rollback (tools update skipped) → the EXISTING catch logs
  **`settlement.credit_failed`** (the documented operator signal, with operationId /
  developerId / amountCents) instead of the empty txn committing and
  `settlement.credited` firing a false success. Reachable today via a dangling
  developer id (deleted dev → tools cascade-deleted → a still-pending row's
  `account_id` dangles) — no backfill needed to hit it. `creditSettlement` still
  never throws to callers; a valid credit is byte-equivalent to before.
- **Semantic formalization (comments/docstrings only, zero executable changes):**
  `schema.ts` `ledgerEntries.accountId` dual-semantic comment (double-entry rows =
  `accounts.id`; settlement rows = developer id, permanent; NEVER backfill);
  `ledger.ts` `RailSettlementRow.accountId` docstring (replaced the misleading
  "usually the developer's provider account"); `orchestrate.ts:51` — the last
  in-code "A1 stand-in" framing retired.
- **Guard tests (tagged `B4 SEMANTIC GUARD`, rg-discoverable):**
  `reconcile.test.ts` — zero-row-alert test (credit_failed fired + credited NOT
  fired + tools update never reached) and the semantic pin
  (`eq(developers.id, 'dev-7')` — the `row.accountId → developers.id` credit
  linkage breaks CI if re-pointed); the two proxy settlement tests pin
  `accountId: 'dev-1'` (= `toolRow.developerId`) into the orchestrators. Writer pins
  already existed for kernel circle-nano (route.test.ts), ap2 (route.test.ts), and
  both orchestrators (orchestrate.test.ts / settle.test.ts) — verified, untouched.

**NOT shipped (by design):** no `accounts` provisioning, no new column, no
migration (drizzle last = `0013`), no backfill runbook, no new log event names, no
writer/payout/pricing/engine changes, no packages/mcp changes.

## Verified ground truth (Step-0 research, re-derived by 2 independent panels)

1. `accounts` (schema.ts:823-843) is dormant: zero provisioning anywhere; no UNIQUE
   on (type, entityId). Double-entry machinery (postLedgerEntry et al.) has zero
   prod callers.
2. The ONLY money-bearing reader of STORED `account_id` is the reconciler tail
   (`reconcile.ts` SELECT → `creditSettlement(developerId: row.accountId)`). The
   kernel in-request credit passes the live `toolRow.developerId`; the proxy bills
   via `forwardAndBill` — neither reads the row.
3. All 4 prod writers pass `toolRow.developerId` (proxy x402 + circle-nano, kernel
   circle-nano, ap2); `sessions.ts` recordHop remains prod-unreachable (hop route
   zod strips rail/protocol/accountId — re-confirmed by the pre-build panel).
4. The pre-fix zero-row behavior (commit + false `settlement.credited`, no
   `credit_failed`) was confirmed real — it is exactly what the hardening closes.

## Gates (ground truth at commit)

apps/web: `tsc --noEmit` **0** · `vitest` **4222 pass / 1 known pre-existing fail**
(`processDataDeletion`; baseline 4220 — exactly +2 for the new tests) · `eslint`
(7 changed files) **0** · `next build` **0**. packages/mcp: **1896 pass / 1 skip**
(untouched). Diff hygiene: schema.ts / ledger.ts / orchestrate.ts verified
**zero non-comment changes**; no migration generated.

## Pre-build audit (HARD gate) → PLAN_READY round 1

`wf_9fa4246a-acc` (11 agents): **PLAN_READY — 0 blocking / 2 real nits (applied) /
4 refuted**. All 12 factual claims re-derived TRUE; the riskiest mechanics
EMPIRICALLY proven on temp copies (Change B typechecks inside `db.transaction`
under the installed drizzle; the dual-use `.returning` mock runs 21/21 green;
`reconcile.test.ts` confirmed the SOLE suite driving the real `creditSettlement`).
Refuted: drain.ts stand-in citations ×2, a clean-tree precondition, recordHop
reachability. Verdict: `.audit/b4-prebuild/round1-verdict.txt` (local, untracked).

## Post-build funds-safety SEAL panel → ✅ SEAL (0 blocking)

`wf_cb0ad2b9-cc0` (16 agents across 2 invocations — one rate-limit resume, cached):
**SEAL — 0 blocking**. Exactly-once preserved (throw fires only on a would-be silent
no-op, never after a real write); valid credit byte-equivalent; no leaked throw (the
kernel's awaited paid-path call cannot 500; the reconciler batch survives);
byte-stability diff-verified; `developers.balanceCents` sole authoritative balance;
guard tests pin the real contract. 2 cosmetic doc findings (a dangling pointer to
THIS capstone — resolved by writing it; a stale "silently" adverb — precision-fixed,
comment-only) applied post-verdict before commit, with tsc + the reconcile suite +
the non-comment-diff check re-run green. Verdict:
`.audit/b4-postbuild/seal-verdict.txt` (local, untracked).

## Founder-gated follow-ups (NOT code)

1. **PUSH is gated** — local commit only; prod runs `origin/main` (93767508).
2. **No migration / no backfill exists for this chunk** — nothing to apply.
3. **Operational note:** `settlement.credit_failed` now also fires for a
   zero-row developer match (previously a false `settlement.credited`). Operator
   action is unchanged: credit manually by `operationId` after investigating.
4. **Deferred (unchanged):** (A)(i) additive provisioning if double-entry books are
   ever wanted; hop-route schema extension; ap2 no-transactionId dedup (inherent);
   per-rail settlement-time take; `revenueSharePct` cleanup.
