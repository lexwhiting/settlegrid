# (T) credited_at — founder runbook (migration 0016 + the uncredited-row sweep)

> Founder-facing. Two parts: (1) the one-time 0016 APPLY-THEN-DEPLOY procedure;
> (2) the standing operator contract for `reconcile.uncredited_settled`.

## 1. Migration 0016 — APPLY-THEN-DEPLOY (after 0015, BEFORE the (T) deploy)

**Order is load-bearing.** Deploying the (T) bundle BEFORE applying 0016 is a
**total settlement-admission outage**, strictly worse than 0015's broken cron:
drizzle emits the full schema column list on every INSERT, so every
`ledger_entries` INSERT throws `column "credited_at" does not exist` —
`ensurePendingRow` fails PRE-broadcast on both on-chain rails (no settlements
admitted; fail-closed, no funds move), the ap2/sessions ledger writes fail, the
marker UPDATE rolls back every credit transaction for already-pending rows
(`settlement.credit_failed` / `billing_update_error` storms), and the sweep
dies every run (`reconcile.uncredited_check_failed`). Applying FIRST is
zero-impact (deployed code never references the column — verified at HEAD
`231b8693`).

Steps:
1. Supabase SQL Editor → paste `apps/web/drizzle/0016_credited_at.sql` → run.
   (Idempotent: IF NOT EXISTS on DDL; the backfill carries a literal
   `settled_at < '2026-06-10T20:00:00Z'` bound, so a re-paste at ANY time —
   even after deploy — cannot touch (T)-era rows or erase sweep evidence.)
2. Seed the 0016 hash row: run the bootstrap script
   (`apps/web/scripts/bootstrap__drizzle_migrations.sql`) or just its 0016
   INSERT block (hash `e47be3c8…43dfe4`, epoch `1781136000000`).
3. Verify BOTH bookkeeping AND schema reality (a paste that silently failed, or
   landed on the wrong Supabase project, passes the bookkeeping check alone):
   - bootstrap POST-RUN query returns **17 rows**, `MAX(created_at) = 1781136000000`;
   - `SELECT column_name FROM information_schema.columns WHERE table_name='ledger_entries' AND column_name='credited_at';` returns one row;
   - `SELECT indexname FROM pg_indexes WHERE indexname='ledger_entries_uncredited_settled_idx';` returns one row.
4. Only then deploy the (T) bundle.
   (The apply-first zero-impact claim was code-verified on the local sealed
   tree; it holds for deployed prod a fortiori — prod `23663006` is an ANCESTOR
   of the verified tree and the column is new, so no deployed code can
   reference it. Note: the paste briefly write-locks `ledger_entries`
   (non-CONCURRENT index + backfill UPDATE) — at current volume this is
   seconds; prefer a low-traffic moment.)

## 2. The sweep — operator contract

**Marker semantics:** `ledger_entries.credited_at` = "the developer-balance
credit COMMITTED, in the same DB transaction as this marker." Written ONLY by
the credit writers (the reconciler tail + kernel `/settle` via
`creditSettlement`; the proxy's on-chain credit transaction). A **settled**
row on rail `circle-nano`/`x402` with `credited_at IS NULL` older than the
60-min grace window is an **OPEN credit-resolution incident**.

**The alert:** `reconcile.uncredited_settled` — one structured `logger.error`
line per reconcile-cron run (every 15 min) **while any open incident persists**
(no de-dup BY DESIGN — incidents page until closed). Payload:
`uncreditedCount`, `graceMs`, `oldestSettledAt`, `operationIds` (≤ 25, oldest
first; operation_ids are rail-prefixed `circle-nano:…` / `x402:…`).
`uncredited: null` in the cron summary means the sweep ITSELF failed
(`reconcile.uncredited_check_failed`) — investigate the error, not the rows.

**Triage (per operationId — search the logs):**
| Log line found | Meaning | Action |
|---|---|---|
| `settlement.credited` | credit landed but the marker didn't (anomaly — see `settlement.credit_marker_unmatched`) | verify `developers.balance_cents`, then CLOSE |
| `settlement.credit_failed` | credit transaction rolled back | credit manually (amount = row `amount_cents`, developer = row `account_id`), then CLOSE |
| `proxy.onchain_credit_lost_after_settle` | proxy credit txn failed after delivery | credit manually, then CLOSE |
| `proxy.onchain_settled_upstream_failed` | USDC collected, tool never delivered — NO credit owed to the dev | run the off-band buyer-refund runbook (keyed by txHash + payer), then CLOSE |
| `reconcile.credit_blocked_testnet` | a TESTNET row reached the prod credit gate (should be impossible post-(G)) | investigate admission path; do NOT credit; CLOSE after investigation |
| `settlement.credit_zero_row_unmarked` | credit matched no developer row (dangling id) | fix attribution, credit the DEVELOPER manually, then CLOSE. ⚠ On the PROXY path the tool stats (`total_invocations`/`total_revenue_cents`) already committed in the same txn — do NOT re-add tool revenue (the reconciler/kernel path rolled back everything — there, credit both) |
| `settlement.credit_skipped_no_data` | settled row missing `account_id` or a positive `amount_cents` (pre-F4 shape) — nothing creditable as recorded | reconstruct developer + amount from the tool and the row metadata (payer/txHash), credit manually if owed, then CLOSE |
| **nothing** | **a silent process kill — either the reconciler/kernel flip→credit window, OR the proxy mid-upstream-fetch (settle committed, delivery unknown)** | FIRST check the invocation records for a delivered request with this operationId/txHash; delivered (or a buyer retry delivered the F1 replay) → credit manually, then CLOSE; NOT delivered and never retried → the buyer paid for nothing: use the off-band refund posture (`onchain_settled_upstream_failed` runbook) instead of crediting, then CLOSE |

**Closing an incident** (after the manual credit / refund / investigation):
```sql
UPDATE ledger_entries SET credited_at = now()
WHERE operation_id = $1 AND rail = $2
  AND settlement_status = 'settled' AND credited_at IS NULL;
```

**One-time gap window:** rows settled between the backfill bound
(`2026-06-10T20:00:00Z`) and the (T) deploy were settled by OLD code (no
marker) and will page from the first post-deploy run. Triage each via the
table above (most will show `settlement.credited` → close), or after
verifying the window, bulk-close it ONCE:
```sql
-- ONLY after log-verifying the gap window's credits.
-- ⚠ The timestamp MUST be the verified (T) deploy moment from the Vercel
-- dashboard — NEVER later (a later bound silently erases genuine (T)-era
-- incidents). PREVIEW first and check every returned row was log-verified:
SELECT operation_id, rail, settled_at FROM ledger_entries
WHERE settlement_status = 'settled' AND rail IN ('circle-nano','x402')
  AND credited_at IS NULL AND settled_at < '<the (T) deploy timestamp>';
-- then, if and only if every previewed row is accounted for:
UPDATE ledger_entries SET credited_at = settled_at
WHERE settlement_status = 'settled' AND rail IN ('circle-nano','x402')
  AND credited_at IS NULL AND settled_at < '<the (T) deploy timestamp>';
-- If the preview count is small, prefer triaging each row individually instead.
```

**`reconcile.failed_flip_stale_ref`** (warn-level, NO action needed): the CAS
working as designed — a reconciler failed-flip was rejected because the row's
tx was re-pointed mid-run; the row stays pending and re-resolves on the next
rotation with fresh evidence. Frequent occurrences without resolution would
indicate a hot resubmit loop — only then investigate.

## 3. The standalone funds-critical alert (NOT sweep-delivered)

**`settlement.settled_evidence_on_terminal_failed_row`** (② seal fix) — emitted
by the LIVE settle path itself, not the sweep: it holds a SUCCESS receipt for a
tx that moved USDC, but the ledger row is terminally **`failed`** (a
reconciler/sibling legitimately flipped it on the prior tx's revert evidence
during the resubmit gap). The sweep can NEVER enumerate this class (it scans
settled rows only), so treat every occurrence as an open incident immediately.

**ORDER IS LOAD-BEARING (③ deep-audit fix): CREDIT FIRST, MARK LAST.** Setting
`credited_at` before the money moves permanently silences the only detector if
you are interrupted — the marker must be the FINAL statement of ANY manual
repair (this applies to every closure in §2 as well). And do ALL manual
balance work OUTSIDE a payout run — first confirm
`SELECT id FROM payouts WHERE developer_id = '<dev>' AND status = 'processing';`
returns nothing (the payout cron debits `balance_cents` concurrently; a manual
credit racing it can be swept into a payout mid-repair).
1. Verify the `winningTxHash` on-chain (the USDC transfer to the platform landed).
2. Credit the money:
   `UPDATE developers SET balance_cents = balance_cents + <row amount_cents>, updated_at = now() WHERE id = '<row account_id>';`
   `UPDATE tools SET total_revenue_cents = total_revenue_cents + <row amount_cents>, updated_at = now() WHERE id = '<row metadata.toolId>';`
3. LAST — repair the row + set the marker in ONE statement:
   `UPDATE ledger_entries SET settlement_status='settled',
   settled_at = now(), external_ref = '<winningTxHash>', credited_at = now()
   WHERE operation_id = $1 AND rail = $2 AND settlement_status = 'failed';`
   (Re-run-safe: the WHERE no-matches once repaired. If interrupted, resume by
   re-checking step 2's balances, then re-running step 3.)
(The buyer was served — the response was `settled`/forwarded — so the credit is
owed. Prevention — closing the flip-vs-resubmit window itself — is registered
follow-up work (P5-adjacent write-ahead lifecycle, register P8), not part of
(T). P8 also carries: when prevention lands, return the WINNING hash instead of
the row's reverted ref in the mirror branch's response/tx-hash header — until
then the alert's `winningTxHash` is the authoritative hash, NOT the response
header.)

**`settlement.broadcast_evidence_on_terminal_failed_row`** — the BROADCAST-time
sibling: a resubmit broadcast landed while the row was already terminally
`failed` (the write-ahead no-opped), and the process may never observe the
receipt (kill / RPC timeout). The candidate hash is on the record here so the
loss can't be silent. Triage: check `broadcastTxHash` on-chain — if it settled
(USDC moved), follow the repair+credit steps above with that hash; if it
reverted/never mined, no funds moved — close with a note (no credit, no
repair). If the receipt-time alert (above) also fired for the same operationId,
this one is its precursor — handle once. Irreducible residual (registered with
the prevention follow-up): a hard kill between the on-chain send and this
write — no process can log it; only on-chain reconciliation vs the gas wallet's
sent-tx history would surface it.

**Do not** widen the marker to non-reconcilable rails (ap2 rows never get one
— they are outside the marker universe), and never set `credited_at` on a row
you haven't resolved: the sweep's honesty is the point.
