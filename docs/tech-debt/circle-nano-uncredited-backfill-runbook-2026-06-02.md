# circle-nano uncredited-`/settle` backfill runbook (founder-run, post-deploy)

> Founder-gated operational follow-up #2 from the funds-safety chunk
> (`circle-nano-funds-safety-seal-2026-06-02.md`). **This is a PROD-DB write — founder runs it,
> after reviewing. The agent does NOT run anything against prod (`.env.local DATABASE_URL` is PROD).**

## Why
Before the Phase-2 chunk shipped, the kernel `/api/circle-nano/settle` path collected USDC on-chain
but NEVER credited the developer (`developers.balance_cents`, the payout source of truth). Those are
now terminal `settled` rows in `ledger_entries`. The Phase-2 reconciler-widen credits only rows it
flips from `pending` — it does NOT backfill rows already `settled`. So the ~1–2 day A2 live window of
collected-but-uncredited revenue must be credited once, by hand.

Scope is precise: circle-nano `settled` `ledger_entries` rows are written ONLY by the kernel settle
orchestrator (`lib/settlement/circle-nano/settle.ts` → `recordSettlementEntry`); the proxy never wrote
one, and the pre-chunk reconciler credited only x402 — so EVERY circle-nano `settled` row created
before the Phase-2 deploy is uncredited.

## Sequencing
Run AFTER: (1) prod env confirmed, (2) Phase-2 deployed. Use the **deploy timestamp (UTC)** as the
cutoff so post-deploy settles (which now credit in-request) are excluded — no double-credit.

## Step 1 — inspect a sample (confirm row shape)
```sql
SELECT id, account_id, amount_cents, operation_id, settlement_status, created_at, metadata
FROM ledger_entries
WHERE rail = 'circle-nano' AND settlement_status = 'settled'
ORDER BY created_at
LIMIT 10;
```

## Step 2 — read-only diagnostic (size the backfill, per developer)
```sql
SELECT
  account_id              AS developer_id,
  COUNT(*)                AS settled_rows,
  SUM(amount_cents)       AS uncredited_cents,
  MIN(created_at)         AS earliest,
  MAX(created_at)         AS latest
FROM ledger_entries
WHERE rail = 'circle-nano'
  AND settlement_status = 'settled'
  AND amount_cents > 0
  AND created_at < '<PHASE2_DEPLOY_TS_UTC>'   -- e.g. '2026-06-02 21:00:00+00'
GROUP BY account_id
ORDER BY uncredited_cents DESC;
```
Note the total `SUM(uncredited_cents)` and the developer (row) count — used to verify Step 3.

## Step 3 — backfill (RUN ONCE, in a transaction)
Credits each developer's balance for their uncredited circle-nano settlements. Per-tool revenue
(`tools.total_revenue_cents`) is NOT backfilled: pre-chunk rows carry no `metadata.toolId` (that field
is added by this chunk), so the per-tool stat is unrecoverable — the dev balance (the payout source of
truth) is what matters; the stat is cosmetic. This is the same posture as the live
`settlement.credit_missing_toolid` path.
```sql
BEGIN;
UPDATE developers d
SET balance_cents = d.balance_cents + agg.uncredited_cents,
    updated_at    = now()
FROM (
  SELECT account_id, SUM(amount_cents) AS uncredited_cents
  FROM ledger_entries
  WHERE rail = 'circle-nano'
    AND settlement_status = 'settled'
    AND amount_cents > 0
    AND created_at < '<PHASE2_DEPLOY_TS_UTC>'   -- SAME cutoff as Step 2
  GROUP BY account_id
) agg
WHERE d.id = agg.account_id;
-- VERIFY: the UPDATE row count == the developer count from Step 2. If it matches, COMMIT; else ROLLBACK.
COMMIT;
```

## Safety
- **Run ONCE.** Re-running double-credits (it re-sums the same rows). The verify-then-COMMIT guard +
  the immutable `created_at < cutoff` set make a single clean run safe.
- Optional audit trail: before COMMIT, snapshot the diagnostic output (Step 2) so the credit is
  reconcilable against the source rows later.
- If a developer id in `ledger_entries.account_id` has no matching `developers.id` (e.g. an
  `accountId = developerId` stand-in edge), the UPDATE simply skips it — re-run Step 2 with a
  `LEFT JOIN developers` to spot any unmatched account before deciding.
