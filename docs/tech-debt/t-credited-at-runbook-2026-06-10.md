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
60-min grace window is an **OPEN credit-resolution incident**. (③-(U) wording
fix: detection latency for a kill-window loss is **~60-75 min** — the 60-min
grace PLUS up to one 15-min cron interval — not "the next run".)

**The alert:** `reconcile.uncredited_settled` — one structured `logger.error`
line per reconcile-cron run (every 15 min) **while any open incident persists**
(no de-dup BY DESIGN — incidents page until closed). Payload:
`uncreditedCount`, `graceMs`, `oldestSettledAt`, `operationIds` (≤ 25, oldest
first; operation_ids are rail-prefixed `circle-nano:…` / `x402:…`).
`uncredited: null` in the cron summary means the sweep ITSELF failed
(`reconcile.uncredited_check_failed`) — investigate the error, not the rows.

**(V-N3 — the alerts now carry the de-identified PK row `id`, NOT the raw
payer-bearing `operation_id`.)** The `operationIds` array and every per-row
`settlement.*` line below log `settlementEntryId(operation_id)` = the row's
primary key `id` (the raw EVM payer + nonce no longer reach the logs / Sentry).
So triage keys on `id`: FIRST resolve the row —
```sql
SELECT operation_id, rail, account_id, amount_cents, external_ref, metadata
FROM ledger_entries WHERE id = $1;  -- $1 = the alert's id
```
These uncredited rows are the anonymizer's carve-out, so their `operation_id`
(and on-chain `external_ref` = txHash) are intact in the row. Then search the
per-row logs (they key on the SAME `id`) and triage:

**Triage (per row `id` — resolve the row, then search the logs):**
| Log line found | Meaning | Action |
|---|---|---|
| `settlement.credited` | credit landed but the marker didn't (anomaly — see `settlement.credit_marker_unmatched`) | verify `developers.balance_cents`, then CLOSE |
| `settlement.credit_failed` | credit transaction rolled back | credit manually (developer = row `account_id`; **amount = the `amountCents` field from THIS log line's payload** — the value the credit *attempted*, i.e. the actually-collected settled value). ⚠ (V-N2b) do NOT use the row's `amount_cents` *column*: on a recovery-confirm it is the QUOTED price and differs from the collected value — crediting it re-introduces the over/under-credit V-N2b closes. Then CLOSE |
| `proxy.onchain_credit_lost_after_settle` | proxy credit txn failed after delivery | credit manually (developer = row `account_id`; **amount = `floor((metadata->>'settledValueBaseUnits')::numeric / 10000)`** — the actually-collected settled value). ⚠ (V-N2b) the log payload's `costCents` is only the QUOTED price and on a recovery-confirm differs from the collected value — do NOT credit it; if `settledValueBaseUnits` is absent, reconstruct the value from the on-chain tx at `external_ref`. Then CLOSE |
| `proxy.onchain_settled_upstream_failed` | USDC collected, tool never delivered — NO credit owed to the dev | run the off-band buyer-refund runbook (keyed by txHash + payer; **(V-N3)** the `payer` is no longer in the log — recover it from the resolved row's `operation_id` `{rail}:{net}:{payer}:{nonce}` or the on-chain tx at `external_ref`), then CLOSE |
| `reconcile.credit_blocked_testnet` | a TESTNET row reached the prod credit gate (should be impossible post-(G)) | investigate admission path; do NOT credit; CLOSE after investigation |
| `settlement.credit_zero_row_unmarked` | credit matched no developer row (dangling id) | fix attribution, credit the DEVELOPER manually, then CLOSE. ⚠ On the PROXY path the tool stats (`total_invocations`/`total_revenue_cents`) already committed in the same txn — do NOT re-add tool revenue (the reconciler/kernel path rolled back everything — there, credit both) |
| `settlement.credit_skipped_no_data` | settled row missing `account_id` or a positive `amount_cents` (pre-F4 shape) — nothing creditable as recorded | reconstruct developer + amount from the tool and the row metadata (payer/txHash), credit manually if owed, then CLOSE |
| `settlement.settled_value_legacy_fallback` (warn) | **(V-N2b)** the IN-REQUEST credit DEFERRED because the row's recorded settled value was ABSENT (a bounded swallowed-onBroadcast / legacy row). Credit was intentionally skipped, NOT failed — funds-safe, never a wrong credit | credit manually (developer = row `account_id`; amount = reconstruct the collected value from the on-chain tx at `external_ref`; consistent with the reconciler's own absent-value fallback, the row's `amount_cents` is acceptable here ONLY because no recorded value exists), then CLOSE |
| `settlement.settled_value_unconvertible` (error) | **(V-N2b)** the IN-REQUEST credit DEFERRED because the row's recorded `settledValueBaseUnits` was corrupt / overflowing / sub-cent (raw value in the payload). Credit was intentionally skipped, NOT failed | credit manually (developer = row `account_id`; amount = reconstruct the collected value from the on-chain tx at `external_ref`). ⚠ do NOT credit the row's `amount_cents` — on a recovery it is the quoted price and re-introduces the over/under-credit V-N2b closes. Then CLOSE |
| **nothing** | **a silent process kill — either the reconciler/kernel flip→credit window, OR the proxy mid-upstream-fetch (settle committed, delivery unknown)** | FIRST check the invocation records for a delivered request with this operationId/txHash; delivered (or a buyer retry delivered the F1 replay) → credit manually, then CLOSE; NOT delivered and never retried → the buyer paid for nothing: use the off-band refund posture (`onchain_settled_upstream_failed` runbook) instead of crediting, then CLOSE |

**Closing an incident** (after the manual credit / refund / investigation).
**(V-N3) Key on the PK `id`** from the alert — it is the primary key, so it
uniquely identifies the row and the `rail` predicate is no longer needed:
```sql
UPDATE ledger_entries SET credited_at = now()
WHERE id = $1
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
-- incidents). PREVIEW first and check every returned row was log-verified.
-- (V-N3) `id` is projected so each previewed row can be matched against the
-- PK-id-keyed `settlement.*` log lines; `operation_id` carries the raw payer.
SELECT id, operation_id, rail, settled_at FROM ledger_entries
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

**`reconcile.overdue_examined`** ((U), ERROR level — Sentry-visible): the
post-loop classification carrier for `reconcile.pending_overdue`. Since (U)
moved the overdue aggregate BEFORE the examination loop (detectors-first), the
`pending_overdue` payload no longer carries `examinedThisRun` — this carrier
holds the breakdown ({nonceConsumed, unconfirmed, unparseable, unsupported,
errored}) and fires only when a nonzero examined-overdue class exists. Note
the pre-run semantics: the overdue COUNT is taken at run START, so a row can
be both counted overdue and resolved later in the SAME run — correlate the
count with this carrier's breakdown (and the run's `done` summary) before
treating the number as standing inventory. It is a classification feed, not a
new page (the armed rules' message filters don't match it) — see the close
checklist §3 before arming any rule on it.

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
3. LAST — repair the row + set the marker in ONE statement.
   **(V-N3)** the `settlement.settled_evidence_on_terminal_failed_row` /
   `settlement.broadcast_evidence_on_terminal_failed_row` alert now carries the
   de-identified PK `id` (not the raw `operation_id`), so key on `id`:
   `UPDATE ledger_entries SET settlement_status='settled',
   settled_at = now(), external_ref = '<winningTxHash>', credited_at = now()
   WHERE id = $1 AND settlement_status = 'failed';`
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
