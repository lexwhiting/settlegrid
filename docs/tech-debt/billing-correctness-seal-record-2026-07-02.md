# billing-correctness — ② seal-gating review record — 2026-07-02

> **Chunk:** `billing-correctness` · **Closes launch-gate blocker:** **G3-5** (consumer-credit webhook permanent-skip) · **Tier:** **HIGH-STAKES** (money boundary; frozen Stripe webhook money rail; DC-06 inverse trap live) · **NOT escalated.**
> **Build commit under review:** `340c35d9` (route.ts production logic + `webhook-checkout-retry.test.ts` + `billing.test.ts` mock parity + handoff). **Base:** `origin/main` HEAD `30b423db` (proxy-idempotency-keys ③).
> **Verdict:** ✅ **SEAL** (operator-accepted the AT-F1 residual; `/seal-go`-gated). Gate GREEN on folded bytes; zero HIGH-severity findings open after two folds.

---

## 1. Mechanical gate (authoritative, re-run FROM CLEAN by the integrator, cwd=`apps/web` matching `web-ci`)

- **On the sealed build bytes (`340c35d9`):** `npx tsc -p tsconfig.json --noEmit` → **exit 0**; `npm run lint` → **0 errors** (2 pre-existing warnings: `logo.tsx` no-img-element, `academy-lessons.test.ts` unused eslint-disable); `npx vitest run` → **223 files / 5109 passed / 0 skipped / 0 failed**. Matches the build's §12 digest exactly (build's green independently confirmed, not taken on trust).
- **On the folded seal bytes (this review's ② folds applied):** `tsc 0` / `lint 0 errors` / **vitest 223 files / 5112 passed / 0 skipped / 0 failed**.
- **Count reconciliation:** 5109 (build) → **+1** credit-purchase insert-branch exactly-once test (test-teeth fold) → 5110 → **+2** `logger.test.ts` money_loss `it.each` cases for the two new keys (observability fold) → **5112**.
- **NO migration / NO schema change** — `schema.ts` + `apps/web/drizzle/` untouched (Redis/PG stores unchanged). Env traps unset (`CLAUDE_CODE_FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL`).

## 2. Review orchestration

- **Path-1 named-subagent pool ABSENT** (`.claude/agents/` does not exist) → a mixed-effort fan-out cannot be realized as named subagents, and a single workflow runs every agent at one session effort. Reviewers Read/Grep only (zero prompt surface → a workflow's loud-pause safety is moot); the integrator gate ran foreground in the main session (allowlist GREEN: `git`/`tsc`/`vitest`/`lint` in `settings.local.json`).
- **Operator-selected: Agent-tool spawns @ xhigh fan-out, then a sequential operator `/effort max` core-invariant pass** (Path-2 realization of the mixed-effort requirement).
- **5 lens-distinct fresh-context reviewers**, all `claude-opus-4-8`:
  - **4× xhigh** (session-inherited): atomicity/concurrency · spec-conformance · SEAM · literal-execution/test-teeth.
  - **1× max** (operator switched session to `/effort max`; the money-core lens inherited it — **report-back confirmed `model=claude-opus-4-8[1m], effort=max`**): money-correctness / DC-06 exactly-once core invariant.
- Integrator (main session) reproduced every sustained HIGH/MED finding live (fail-against-built-code → pass-after-fix) before landing it.

## 3. Findings + dispositions

### FOLDED before seal (each reproduced fail-then-pass live)

- **② F1 — HIGH test-teeth (literal-execution lens; DC-24 + DC-05 recurrence).** The regression harness's `mockDb` had **no `.catch`**, but the route's failure catch calls `db.delete(...).where(...).catch(...)`. So on the failure path `.catch` was `undefined` → a **`TypeError`** produced the 500, **not** the intended `throw handlerErr`. Consequences proven by probe + live reproduction: (a) `expect(res.status).toBe(500)` was **vacuous**; (b) a **variant-B regression** — keep the delete, drop `throw handlerErr` — **stayed GREEN** under the mock, yet in production falls through to `return successResponse` → **HTTP 200 → Stripe never retries → G3-5 silently reintroduced**; (c) the `dedup_delete_failed` handler had zero coverage.
  - **Live reproduction:** with the committed mock, dropping the rethrow kept the credit-purchase failure test GREEN (false-green). Added a real resolved-thenable `.catch` to the mock → the same mutant now **RED** (`expected 200 to be 500`). Full suite GREEN after.
  - **Fold (test-only, no production change):** `webhook-checkout-retry.test.ts` — `catch: vi.fn().mockResolvedValue(undefined)` on the hoisted mock (+ beforeEach reset); added `expect(mockDb.where).toHaveBeenCalledWith({ field: 'event_id', value: … })` to both failure tests (closes spec-conformance D2 — a wrong-marker delete e.g. `session.id` would now be caught); added a **new-balance INSERT branch** exactly-once test (`creditInsertCount()`, since the insert path credits via `.values()` not `.set()` and was invisible to `creditWriteCount`).

- **② F2 — MED→FOLD-NOW (SEAM + atomicity + max, 3-lens convergent; DC-06-adjacent observability).** The marker delete is best-effort (`.catch` swallows a failed delete, then rethrows). A DB fault that fails the credit tx is correlated with the delete also failing → marker persists → Stripe retry deduped → **paid credit permanently skipped** (the G3-5 class, relocated to the delete-failure edge). And `stripe.webhook.dedup_delete_failed` was **absent from `MONEY_LOSS_KEYS`** (`logger.ts`) → the Sentry mirror stamped `logKey` but **not** `money_loss:'true'` → the funds-loss page never fired → **silent**.
  - **Fold:** added `'stripe.webhook.dedup_delete_failed'` + `'stripe.connect_webhook.dedup_delete_failed'` to `MONEY_LOSS_KEYS` (behavior-neutral — adds a Sentry tag). Within the set's own documented policy ("add a new key here when a new funds-loss signal is introduced"); precedented (G3-3 added `proxy.idempotency_gate_unavailable`); also covers the **pre-existing transfer.* / Connect** blind spots. This is the multiplier that turns residuals #1/#3/#4 from silent into **detectable + manually-reconcilable**.
  - **Live reproduction:** with both keys added, the 2 new `logger.test.ts` `it.each` cases pass; reverting `logger.ts` to committed (keys removed) turned exactly those 2 cases RED (`{logKey}` ≠ `{logKey, money_loss}`). Teeth real.

### Documented RESIDUALS (operator-accepted; not fixed here — bounded/rare/inherent; now page-able via ② F2)

- **RES-1 — ambiguous-commit DOUBLE-CREDIT (max lens, VERIFIED at driver source) — REFUTES the plan's "no double-credit" contract.** `drizzle-orm/postgres-js` `db.transaction` = postgres-js `begin()` = `Promise.race([scope, connection.onclose→reject])`. A connection close in the window **after** the server durably applies `COMMIT` but **before** the client reads the ack **rejects the tx promise even though the credit committed** (textbook in-doubt commit). Then the failure catch **deletes the marker** → 500 → Stripe retry → marker re-inserted → the **non-idempotent blind increment re-applies** → **double-credit**. Exposed on the two blind-increment consumer paths: credit-pack `consumers.globalBalanceCents += …` (`route.ts:246-250`) and credit-purchase `consumerToolBalances.balanceCents += …` (`:339-353`). The subscription path is idempotent (`SET tier=`), so it is NOT exposed. **This regresses the ambiguous-commit corner from accidental-single-credit (pre-fix: marker never deleted → retry deduped) to double-credit.**
  - **Why accepted (not blocking):** rare (needs a conn-drop in a sub-ms post-COMMIT/pre-ack window **and** the subsequent marker-delete to succeed) + the **revenue-leak** direction, versus the **live, common-case, trust-fatal G3-5 permanent-skip** the fix closes (tripped by *any* transient credit-write throw). The fix is a **net reduction in both frequency and severity** of money defects. The `transfer.*` precedent is immune only because its writes are idempotent state-machine transitions re-read `FOR UPDATE`; the checkout credits copied the *structure* but not the *idempotency*.
  - **The plan's "no double-credit" certification (handoff §5 LBD-1 / §5.5) is CORRECTED here — it does not hold for the ambiguous commit.** Do not re-assert it.
- **RES-2 — crash/timeout permanent-skip.** `maxDuration=60`; a serverless timeout/OOM/SIGKILL between the marker commit (`:114`) and the credit-tx commit bypasses the JS catch → marker persists → permanent skip. Inherent to the marker-first design, **shared with the sealed `transfer.*` precedent**; the fix **narrows** the window (any-throw → hard-crash-in-the-gap), it does not open it. The build/commit "closed forever / exactly once" wording **overstates** coverage → corrected: the fix closes the common-case JS-throw skip, not the crash path.
- **RES-3 — concurrent delete-after-ACK (low likelihood).** Slow delivery D1 + concurrent retry D2 sees the marker → 200 → Stripe stops → D1 then fails → deletes the marker → ledger shows the event unseen + credit lost. Same root cause as RES-1/2 (marker not co-committed with the effect); depends on overlapping deliveries + Stripe not re-arming after a late 500.

### Cleared / refuted by the fan-out

- Subscription-path double-apply — REFUTED (idempotent `SET`).
- New-balance INSERT under concurrency — REFUTED (`ctb_consumer_tool_idx` UNIQUE on (consumer_id, tool_id) → the loser's tx rolls back, deletes its own marker, retries into the increment branch → converges to the correct sum; SQL `bal = bal + amt` is lock-safe).
- Sign / precision / overflow — REFUTED (integer cents; `parseInt`; guarded `>0`/truthy).
- Spec-conformance — all 3 paths wrapped; `break`/early-`return` ACK guards OUTSIDE the tx arrow; each `logger.info` INSIDE the tx (closes the DC-06 log-meta-throw trap); delete `.catch` mirrors `transfer.*`; fire-and-forget email OUTSIDE the tx; `payment_intent.succeeded` / `transfer.*` / Connect / `quality-gates.ts` / schema all UNTOUCHED.
- SEAM — 6/6 load-bearing claims verified (drizzle postgres-js throw→rollback→reject; `tx` method-surface parity; marker committed before the switch; re-throw → outer catch → retryable 500; PK delete can't over-delete; F5 neutralized-not-relied-upon).
- `billing.test.ts` mock parity (in `340c35d9`) — purely additive (`delete` + pass-through `transaction`), no assertion loosened; the missing-`.catch` defect is dormant there (no test reaches the delete path).

## 4. Defect-class ledger updates (local `.audit/defect-ledger/`)

- **DC-06 (idempotent-writer-semantics trap) — RECURRENCE recorded:** *delete-marker-on-failure over a **non-idempotent blind increment** re-opens a double-credit on the **ambiguous commit** (throw ≠ nothing-committed).* Detection cue: a retry-safety delete-marker is only exactly-once if the retried effect is idempotent (status-guarded / co-committed marker) OR the marker is co-committed inside the effect tx. Structure-copying an idempotent precedent (`transfer.*` `FOR UPDATE` state-machine) onto a blind increment silently drops the protection.
- **DC-24 (false-green / toothless control) — RECURRENCE recorded:** *a status assertion (`toBe(500)`) made vacuous by a mock that throws a `TypeError` on the same path* — the 500 came from `mockDb.catch is not a function`, not the code under test; a real regression (dropped rethrow) stayed green. Cue: assert the *reason* for a status, and give any `.then/.catch`-chained mock a real thenable terminal.
- **DC-05 (test-double surface divergence) — RECURRENCE recorded:** the mock query-builder lacked `.catch`/`.then` that real drizzle `QueryPromise` exposes.

## 5. Roadmap / follow-ups spun OUT (NOT fixed here)

1. **Idempotent-credit redesign (the true RES-1/2/3 fix):** co-commit the `processedWebhookEvents` marker **inside** each credit tx (instead of before the switch) so an ambiguous-commit retry hits the marker conflict → dedups → single credit, while a genuine failure commits nothing → retry re-credits. Closes RES-1/2/3 at once. Interim narrower step for credit-purchase only: gate on `purchases.status` `FOR UPDATE` (mirror `transfer.*`) — needs an auto_refill-shared-purchase-row guard + tests → its own chunk. Credit-pack has **no** per-event key without schema work.
2. **`payment_intent.succeeded` (auto_refill) — same G3-5 class STILL LIVE (flagged OUT, untouched):** (i) permanent-skip if the credit throws (credit-not-last → a naive delete-marker would DOUBLE-credit; correct fix = reorder-then-tx); (ii) `if (existingBalance)` at `~:414` has no `else`-insert → auto-refill for a consumer with no existing balance row is silently never credited. New roadmap G-row.
3. **credit-pack unknown-`packId` validation bypass (pre-existing, surfaced by the max lens; NOT in this diff):** the pack guards are `if (expectedPack && …)` (`route.ts:217/:229`) — an unknown/absent `packId` makes `expectedPack` null → **both** the amount-match and credit-match checks are skipped → `:239` credits attacker-supplied `creditAmountCents` with no amount validation. Cross-check against consumer-abuse-hardening (`c83d837a`, "unauth $500 academic mint"). Flag for roadmap.
4. **G3-4 stays ➖ (DROPPED, unsafe naive fold):** needs its own `toolType`/pricing-conditional chunk (require the endpoint only for proxied/paid tools; publish create-path handling; `buildQualityChecklist`/dashboard-copy consistency; existing-test updates).
5. **Checkout Redis balance-cache staleness (minor, pre-existing):** checkout credit paths don't invalidate the Redis balance cache (a paid balance may read stale until TTL). Note alongside the auto_refill row.

## 6. §S / §P integration items (NOT unit-observable)

- **S1 — real transactional rollback + no-double-credit-on-retry** against a live/stateful DB (the unit `mockDb.transaction` is pass-through — the GREEN gate validates the throw→delete→500 / success→no-delete→credit-once WIRING, orthogonal to RES-1..3).
- **S2 — DC-01 NARROWED (beneficial, signed off):** the credit-purchase `purchases`-status + balance writes are now atomic (a partial-commit-on-crash window closed). A permanent skip on this path now leaves `status != 'completed'` — a reconcilable signal (credit-pack has no such record → least-recoverable).
- **§P — confirm the `money_loss` Sentry rule pages on `stripe.webhook.dedup_delete_failed`** (live smoke), and that a same-event Stripe retry after a failed credit re-credits exactly once.

## 7. Seal bookkeeping

- **G3-5** ticked `☐→☑` in the roadmap (gitignored → local; PostToolUse recount 12→11, gate still RED — 11 promotion-blockers open).
- **Committed (explicit pathspec, post-`/seal-go`):** `webhook-checkout-retry.test.ts` · `logger.ts` · `logger.test.ts` · this seal record · the handoff (② addendum). (route.ts + `billing.test.ts` already in build `340c35d9`.)
- **Excluded (pre-existing, untouched):** `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-*`, `.claude/`, `launch-gate-queue.md`, `LAUNCH-GATE-roadmap-*` (gitignored), `v-n3-mfa-*`, `mfa-delete-smoke.sh`, other chunks' deep-audit docs.
- **③ post-seal deep audit IS warranted** (HIGH-STAKES): the money core-invariant at max already ran here, but ③'s integrated-whole scope should adjudicate the idempotent-credit redesign (RES-1) and the cross-chunk credit-pack validation-bypass interaction.
