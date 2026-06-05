# B4 settlement-row account attribution — BUILD PLAN (2026-06-04)

> Pre-build-audit-gated build plan. Read order: the handoff
> (`b4-settlement-account-attribution-handoff-2026-06-04.md`) → the A1 debt register
> (`a1-facilitator-ledger-writes-2026-05-30.md`) → THIS plan.
> Status: **DRAFT → pre-build audit pending.** No implementation code until the
> audit returns PLAN_READY (0 blocking) with all fixes applied.

---

## 1. Step-0 record (founder decisions, 2026-06-04) + verified ground truth

**Founder picked (B): formalize the stand-in** — "settlement-row `account_id` IS the
owning developer's id" becomes the PERMANENT, documented, guard-tested semantic. The
A1 "backfill when provisioning lands" instruction is RETIRED (it is the trap). The
founder ALSO approved one adjacent hardening: **make `creditSettlement`'s silent
zero-row developer UPDATE observable** (logging-only; converts permanent alarm-free
credit loss into the documented `settlement.credit_failed` operator signal).

**Ground truth (all 5 handoff §3 claims re-verified at HEAD `f378558c`; every line
number checked live — the audit must re-verify each):**

1. **`accounts` is dormant architecture** (`apps/web/src/lib/db/schema.ts:823-843`):
   full double-entry table; ZERO provisioning anywhere (`rg "insert\(accounts\)"` → no
   code hits; residual `\baccounts\b` hits are `viem/accounts` imports). No UNIQUE
   index on `(type, entityId)` either — provisioning would need a migration.
2. **`ledger_entries.account_id`** (`schema.ts:849`): `uuid NOT NULL`, **no FK by
   documented design** (`schema.ts:816-819` — lock contention; app-code integrity).
   The dormant double-entry machinery (`postLedgerEntry` ledger.ts:63,
   `postLedgerEntryAsync` :208, `computeBalanceFromLedger` :223, `reconcileAccount`
   :240) is exported (`settlement/index.ts:4`) with **zero prod callers**.
3. **Payout source of truth** = `developers.balanceCents`, credited by
   `creditSettlement` (`reconcile.ts:195`; developers UPDATE :214-218;
   `tools.totalRevenueCents` :219-224). SETTLED — untouched here.
4. **THE TRAP (verified + sharpened):** `reconcile.ts:128-133` feeds
   `developerId: row.accountId` into `creditSettlement`. On a non-developer id the
   developers UPDATE matches **zero rows without erroring**, the transaction
   **commits**, and `logger.info('settlement.credited')` (:231) fires — a **false
   success log**; `settlement.credit_failed` never fires. The flip
   (`markSettlementSettled`, :113) precedes the credit (:128), so the row is already
   `'settled'` and never re-selected → permanent, alarm-free loss of
   genuinely-collected USDC credit. **This zero-row path is reachable TODAY without
   any backfill**: a deleted developer cascade-deletes its tools (schema FK), and a
   still-pending settlement row's `account_id` then dangles.
5. **Writers are consistent**: all 4 prod writers pass `toolRow.developerId` — proxy
   x402 (`api/proxy/[slug]/route.ts:1889`), proxy circle-nano (:2025), kernel
   circle-nano (`api/circle-nano/settle/route.ts:178`), ap2
   (`api/ap2/settle/route.ts:190`). `sessions.ts:480` (recordHop) is prod-unreachable
   (ACP-chunk B2-moot finding). The x402 orchestrator interface codifies the old
   framing: `orchestrate.ts:51` "(A1 stand-in for accountId)".

**Complete load-bearing surface of stored `account_id` (traced):** exactly ONE money
path reads it — `reconcilePendingSettlements` SELECT (`reconcile.ts:279`) →
`reconcileOneRow` → `creditSettlement(developerId: row.accountId)` (:129). The kernel
in-request credit (`circle-nano/settle/route.ts:206`) uses the live
`toolRow.developerId`, NOT the row; the proxy bills via `forwardAndBill` (live
toolRow). The dormant `computeBalanceFromLedger` (:230) has zero callers.

**Why (B) is right (the Step-0 reasoning, recorded):** the system as built is
internally consistent — every writer stores a developer id; the one money-reader
treats it as a developer id. There is no bug; there is an undocumented invariant
whose register framing ("backfill later") invites the exact migration that would trip
the trap. (B) kills that hazard at the root with zero money-path change, and loses
nothing: an additive `provider_account_id` column ((A)(i)) remains fully available
later if audit-grade double-entry books become a real requirement.

## 2. Scope — what ships (IN)

- **A. Semantic formalization (comments/docstrings only, 3 files):** schema column
  comment + `RailSettlementRow.accountId` docstring + retire the one in-code
  "A1 stand-in" framing (`orchestrate.ts:51`).
- **B. `creditSettlement` zero-row observability** (founder-approved edit to a
  §8-listed function; logging/rollback only — no money-movement change, contract
  preserved).
- **C. Guard tests** ("B4 SEMANTIC GUARD"-tagged): pin the reconciler's
  `row.accountId → developers.id` credit linkage, the zero-row alert, and the two
  unpinned proxy writer sourcings.
- **D. Docs/registers** (post-SEAL): capstone doc; A1-register resolution (debt
  closed-by-design, backfill instruction retired); P5 master-doc note; memory pointer.

Net: **2 source files with substantive edits (1 of them comment-only outside
`creditSettlement`), 1 comment-only source file, 3 test files, docs.** NO migration.
NO schema SQL change (schema.ts edit is comment-only — TS comments emit no SQL; the
diff must show zero non-comment schema changes). NO packages/mcp change.

## 3. ⚠️ SCOPE GUARD (§6a — reject audit findings that grow scope)

**Byte-stable — do NOT modify:**
- `recordSettlementEntry` internals + `settlementEntryId` + `onConflictDoNothing`
  (FIRST-WRITE-WINS), `markSettlementSettled`/`Failed`/`Broadcast`,
  `findSettlementRow` (`ledger.ts`). (The `RailSettlementRow.accountId` DOCSTRING
  changes; zero executable lines in `ledger.ts` change.)
- The 4 writer call sites' executable code — `accountId: toolRow.developerId` stays
  byte-identical at all 4 sites (only `orchestrate.ts:51`'s comment line changes).
- `reconcile.ts` outside `creditSettlement`: `parseSettlementOperationId`,
  `reconcileOneRow`'s flip/credit-iff-flipped flow, `reconcilePendingSettlements`'
  SELECT/filtering — untouched. Inside `creditSettlement`: ONLY the developers
  UPDATE gains `.returning({id})` + a zero-row throw; the tools UPDATE, the
  guard-clause (:202-211), all log events and the swallow-errors contract are
  unchanged.
- The orchestrators (`x402/orchestrate.ts`, `circle-nano/settle.ts` executable code),
  payout pipeline (`payouts/process.ts`), progressive take (`lib/pricing.ts`),
  on-chain engines/verifiers, dedup on `(from,nonce)`.
- The take model (`take_bps=0` CORRECT), `developers.balanceCents` as the only
  authoritative balance, all SEAL commits, the CERTIFIED ACP copy.

**Explicitly OUT of scope (deferred, documented):** `accounts` provisioning /
`provider_account_id` column / any backfill (RETIRED by (B), not deferred);
hop-route schema extension; ap2 no-`transactionId` dedup (inherent); per-rail
settlement-time take; `revenueSharePct` cleanup; repo-wide rate-limit hardening;
the `processDataDeletion` flaky pre-existing fail; tools-UPDATE zero-row detection
(stat-only surface, NOT the payout SoT — the founder approved the developers check
specifically). **Any audit finding that adds these is REJECT-with-rationale, not
auto-apply.** Zero findings is a valid outcome.

## 4. Change A — semantic formalization (3 files, comments/docstrings only)

**A1. `apps/web/src/lib/db/schema.ts:849`** — comment block above the column (inside
the `ledgerEntries` table literal; TS comment only, emits no SQL):

```ts
    // Dual semantic, PERMANENT (B4, 2026-06-04):
    //   - double-entry rows (rail IS NULL): a real accounts.id
    //     (postLedgerEntry validates existence — see note above).
    //   - SETTLEMENT rows (rail NOT NULL): the OWNING DEVELOPER's id,
    //     NOT an accounts.id. The reconciler credits real money from
    //     this value (reconcile.ts creditSettlement matches
    //     developers.id = account_id), so a "backfill" to accounts.id
    //     would make that UPDATE match zero rows and silently un-credit
    //     genuinely-collected USDC. NEVER backfill settlement rows.
    //     See docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md.
    accountId: uuid('account_id').notNull(),
```

**A2. `apps/web/src/lib/settlement/ledger.ts:357-362`** — replace the misleading
docstring ("usually the developer's provider account"):

```ts
  /**
   * For settlement rows this is the OWNING DEVELOPER's id — the
   * PERMANENT semantic (B4, 2026-06-04), NOT an accounts.id (the
   * double-entry accounts table is dormant/unprovisioned). The
   * reconciler credits real money from this column
   * (reconcile.ts creditSettlement: developers.id = account_id),
   * so it MUST stay a developer id. Populates the legacy
   * `account_id` NOT NULL column.
   */
  accountId: string
```

**A3. `apps/web/src/lib/settlement/x402/orchestrate.ts:51`** — retire the stand-in
framing (comment-only):

```ts
  /** Owning developer id — the PERMANENT settlement-row account_id semantic (B4; see RailSettlementRow.accountId). Parity with circle-nano. */
  accountId: string
```

(Repo-wide `rg -i "stand-in"` on the settlement surface confirms :51 is the ONLY
in-code stand-in framing for account attribution; `drain.ts`/`ap2/credentials.ts`
hits are unrelated crypto stand-ins — untouched.)

## 5. Change B — `creditSettlement` zero-row observability (the founder-approved hardening)

**Edit:** `apps/web/src/lib/settlement/reconcile.ts` inside `creditSettlement`'s
transaction (opened :214; the developers UPDATE is :215-218). Follow the repo's
established affected-row idiom — `markSettlementSettled` (`ledger.ts:539-560`;
`.returning({id})` :558, `length > 0` :559), the SAME pattern on the SAME funds path:

```ts
    await db.transaction(async (tx) => {
      const credited = await tx
        .update(developers)
        .set({ balanceCents: sql`${developers.balanceCents} + ${amountCents}`, updatedAt: new Date() })
        .where(eq(developers.id, developerId))
        .returning({ id: developers.id })
      if (credited.length === 0) {
        // B4: zero rows matched ⇒ the credit DID NOT HAPPEN (dangling
        // developer id — deleted developer, or a mis-attributed
        // account_id). Without this check the txn commits empty and the
        // 'settlement.credited' log below LIES. Throw → rollback (the
        // tools update never runs) → the catch below logs
        // settlement.credit_failed, the documented operator signal to
        // credit manually by operationId.
        throw new Error(`settlement credit matched no developer row (developerId=${developerId})`)
      }
      if (toolId) {
        await tx
          .update(tools)
          .set({ totalRevenueCents: sql`${tools.totalRevenueCents} + ${amountCents}`, updatedAt: new Date() })
          .where(eq(tools.id, toolId))
      }
    })
```

Plus one docstring paragraph on `creditSettlement` documenting the zero-row behavior
(replaces nothing; appends to the "Residual" note).

**Design rationale (alternatives considered):**
- *Throw-inside-tx vs capture-and-branch:* the throw aborts the transaction (the
  zero-row UPDATE was a no-op; the tools update is correctly skipped — cascade
  guarantees the tool is gone if the dev is), propagates to the EXISTING
  `catch` (:232) → `logger.error('settlement.credit_failed', { operationId,
  developerId, amountCents }, err)` — REUSING the documented operator signal with
  full context and adding ZERO new log events. Capture-and-branch would commit the
  empty txn and need new branching/logging. ~6-line diff vs ~12.
- *`.returning().length` vs postgres-js `RowList.count`:* `.returning` is the
  in-repo, funds-path-proven idiom (`markSettlementSettled/Failed/Broadcast`),
  driver-agnostic and fully typed. `count` is driver metadata.
- *Why this preserves every contract:* `creditSettlement` still NEVER throws to its
  callers (the catch swallows — kernel route :205 + reconciler :128 see void
  resolve); credit-iff-you-flipped untouched (no flip-logic edit); on a REAL credit
  (rows matched) behavior is byte-equivalent (the `.returning` adds a standard
  RETURNING clause); the only behavior delta is: empty-match → `credit_failed`
  (true) instead of `credited` (false).

**Both `creditSettlement` callers re-traced for the delta:**
- Reconciler (:128): a zero-row credit now logs `credit_failed` instead of
  `credited`; `reconcileOneRow` still returns `'settled'` (the on-chain flip DID
  happen — correct).
- Kernel circle-nano route (:205): passes live `toolRow.developerId` (dev exists —
  just loaded the tool). A delete race now logs `credit_failed` (true) instead of
  `credited` (false). Response unchanged (`settled` — the USDC did settle).

## 6. Change C — guard tests (tagged `B4 SEMANTIC GUARD` for rg-discoverability)

**Existing pins verified (NO edit needed):** kernel circle-nano route →
`executeCircleNanoSettlement` receives `accountId:'dev-uuid-1'`
(`api/circle-nano/__tests__/route.test.ts:229-240`); ap2 → `recordSettlementEntry`
receives `accountId:'dev-uuid-1'` (`api/ap2/__tests__/route.test.ts:245`); x402
orchestrator → pending row carries `accountId:'dev-1'`
(`x402/__tests__/orchestrate.test.ts:176`); circle-nano orchestrator → same
(`circle-nano/__tests__/settle.test.ts:121`).

**T1. `apps/web/src/lib/settlement/__tests__/reconcile.test.ts`** (the ONLY test
file that drives the REAL `creditSettlement` through the mocked db — verified: the
kernel route test mocks `@/lib/settlement/reconcile` wholesale (:68-69), the cron
test mocks `reconcilePendingSettlements` (:18), `settlement-moat.test.ts` has zero
references, proxy tests mock the orchestrators):

- **Forced mock surgery** (the `.returning` chain): in `vi.hoisted` add
  `mockReturning: vi.fn()`; in `beforeEach` replace
  `mockTx.where.mockResolvedValue(undefined)` (:95) with
  ```ts
  mockReturning.mockResolvedValue([{ id: 'dev-7' }])
  mockTx.where.mockImplementation(() =>
    Object.assign(Promise.resolve(undefined), { returning: mockReturning }),
  )
  ```
  — awaiting the chain still resolves (tools update path), while the developers
  update path calls `.returning()` → the array. Every existing credit test keeps
  passing with rows matched.
- **NEW test (zero-row alert):** settled + flipped + `mockReturning
  .mockResolvedValueOnce([])` → assert: outcome `'settled'`;
  `vi.mocked(logger.error)` called with `'settlement.credit_failed'` +
  `expect.objectContaining({ operationId: X402_OPID, developerId: 'dev-7',
  amountCents: 50 })` + an Error arg; `logger.info` NOT called with
  `'settlement.credited'`; `mockTx.update` called exactly once (tools update never
  reached). Import `{ logger }` from `'@/lib/logger'` (already mocked at :61) for
  the assertions.
- **NEW test (the semantic pin):** `B4 SEMANTIC GUARD: the developer credited IS
  the row's account_id value` — run the settled+flipped x402 flow and assert
  `vi.mocked(eq)` was called with `(mockDevelopers.id, 'dev-7')` — pinning the
  `row.accountId → developers.id` credit linkage so a future re-point breaks CI,
  not prod. Add `import { eq } from 'drizzle-orm'` (mocked at :52-60) alongside the
  `{ logger }` import — `vi.mocked(eq)` needs the binding (R1-audit nit). Comment
  block states the (B) decision + doc pointer.

**T2. `api/proxy/[slug]/__tests__/x402-proxy-settlement.test.ts`** — in the
settled-path test add (fixture `TOOL_ROW` :87-96, `developerId:'dev-1'`,
`id:'tool-1'`):
```ts
// B4 SEMANTIC GUARD: the proxy attributes settlement rows to the OWNING
// DEVELOPER (toolRow.developerId) — permanent; see RailSettlementRow.accountId.
expect(H.executeX402Settlement).toHaveBeenCalledWith(
  expect.objectContaining({ accountId: 'dev-1', toolId: 'tool-1' }),
)
```

**T3. `api/proxy/[slug]/__tests__/circle-nano-proxy-settlement.test.ts`** — same
pin on `H.execute` (fixture `toolRow()` :82-93, `developerId:'dev-1'`).

## 7. Deliverable D — docs/registers (post-SEAL)

- Capstone `docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md`:
  Step-0 record (this §1), what shipped, audit verdicts, SEAL verdict.
- `a1-facilitator-ledger-writes-2026-05-30.md` — UPDATE section: Decision-1 debt
  **RESOLVED-BY-DESIGN (B)**; the "backfill when provisioning lands" instruction
  **RETIRED** (it is the trap); pointer to the capstone. (UPDATE section appended —
  the historical record is not rewritten.)
- P5 master doc (gitignored local note) — B4 line updated.
- Memory pointer (MEMORY.md index one-liner).
- This build plan is committed alongside (prior-chunk precedent).

## 8. Forced test edits — completeness statement

A literal follow of §6 yields GREEN suites in BOTH packages:
- `reconcile.test.ts` is the ONLY suite whose mocks see the `.returning` chain
  (enumeration in §6-T1 — re-verify with `rg "creditSettlement" apps/web/src` +
  checking every `db.transaction` mock that creditSettlement can reach).
- T2/T3 add assertions to EXISTING tests (no fixture/mock changes — the orchestrator
  mocks already capture their call args).
- No other suite pins `creditSettlement`'s log events or the tx chain.
- packages/mcp: untouched (RailSettlementRow lives in apps/web; the canonical
  `recordLedgerEntry` is not edited) — suite run anyway per handoff §1.
- Baselines: apps/web ≥4220 pass + 2 new / 1 known pre-existing fail
  (`processDataDeletion`); packages/mcp 1896 pass / 1 skip.

## 9. Funds-safety invariants preserved (correctness lens)

- **Exactly-once credit:** untouched — the flip machinery and credit-iff-you-flipped
  gating are not edited; the zero-row throw fires only AFTER the flip winner has
  already been determined and only when the credit would have been a silent no-op.
- **No new money movement:** the edit can only (a) roll back an EMPTY transaction
  and (b) change which log line fires. A matched credit is byte-equivalent.
- **No second authoritative balance surface:** nothing touches `accounts`;
  `developers.balanceCents` remains the only payout SoT.
- **Take model untouched:** `take_bps=0` stays; no pricing/payout edits.
- **Settled rows carry settledAt:** writer machinery untouched.
- **Schema emits identical SQL:** schema.ts edit is comment-only (verify in the
  diff: zero executable schema changes; no migration generated or needed).
- **The trap is now dead twice over:** (1) the backfill instruction is retired and
  the semantic is pinned in CI (a code-side re-point breaks guard tests); (2) even a
  data-side dangling id now fires the documented `credit_failed` operator alert
  instead of a false `credited`.

## 10. Verification gates (§9 of the handoff)

`cd apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (≥4220 pass + new; 1 known
fail) · `npx eslint <changed files>` (0) · `npx next build` (0; NOT concurrent with
tsc). PLUS `cd packages/mcp && npx vitest run` (1896/1 skip). DB-affecting behavior
proven against the REAL `creditSettlement` (function real, db mocked — the
established F4-suite pattern; §9's target). No migration to generate or lint.

## 11. Post-build gate

Mandatory funds-safety SEAL panel (handoff §7; adapt
`.audit/money-mechanics-postbuild/seal-panel.mjs`): adversarial lenses attempt —
reconciler mis-credit/zero-credit under the new shape, exactly-once break, a second
balance surface, byte-stable-core drift (git-diff verified), take-model touch,
non-additive schema change, demo-sandbox reach. SEAL (0 blocking) before the
founder-gated, path-scoped LOCAL commit (no push, no prod env, no migration).
