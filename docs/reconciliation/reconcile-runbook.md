# Stripe Reconciliation Runbook

Owner: founder (until first hire). Reachable on the SettleGrid Slack
`#reconcile` channel; an open GitHub issue automatically tags the
runbook owner.

This runbook covers the **P3.RAIL2** nightly Stripe reconciliation
job. The job compares the SettleGrid unified ledger
(`ledger_entries`, rail = `stripe-connect`) against:

- Stripe **Balance Transactions** for the *charges* leg (SaaS
  subscription charges + usage-based platform fees), keyed on
  `externalRef ↔ source charge id`.
- Stripe **Connect Transfers** for the *transfers* leg (developer
  payouts), keyed on `externalRef ↔ destination acct_*` with
  multiple transfers to the same destination summed (partial-retry
  handling).

The job runs daily at **08:00 UTC** via
`.github/workflows/stripe-reconciliation.yml`. Reports land in
`data/reconciliation/stripe/{YYYY-MM-DD}.json` (committed, so the
audit trail is in git).

---

## Where things live

| Artifact | Path |
|---|---|
| Pure helpers (rails package) | `packages/rails/src/stripe-reconcile.ts` |
| Pure-helper tests | `packages/rails/src/__tests__/stripe-reconcile.test.ts` |
| Orchestration script | `scripts/reconcile-stripe.ts` |
| Orchestration tests | `scripts/__tests__/reconcile-stripe.test.ts` |
| GitHub Actions workflow | `.github/workflows/stripe-reconcile.yml` |
| Reports | `data/reconciliation/stripe/{YYYY-MM-DD}.json` |
| State file (last GH issue) | `data/reconciliation/.reconcile-state.json` |
| Example report | `docs/reconciliation/example-report.json` |

---

## `external_ref` convention (load-bearing contract)

The reconciler reads `ledger_entries.external_ref` to join SettleGrid
ledger rows against Stripe rows. The convention is leg-specific:

| Leg | Accepted `external_ref` shapes | Notes |
|---|---|---|
| charges | `ch_*` (Stripe charge id) or `py_*` (PaymentIntent id) | 1:1 join. Multiple Balance Transactions sharing the same source charge (refund pairs, fee debits) sum on the Stripe side. |
| transfers | `acct_*` (destination connected-account) **preferred**, or `tr_*` (transfer.id) | Both sides aggregate by `destination` per spec. The `tr_*` form is resolved to its destination via the day's transfer list — an unrecognized `tr_*` (failed transfer with no successful retry) surfaces as missing-in-Stripe. |

Future webhook handlers that flip a row to `settlement_status='settled'`
**must write one of these shapes** as `external_ref`. A row whose
`external_ref` is null at reconciliation time is reported as
missing-in-Stripe — not a silent drop.

## What the job does (per run)

1. Reads `ledger_entries` rows where `rail = 'stripe-connect'` and
   `settled_at` falls in the chosen UTC day.
2. Pages through **all** Stripe Balance Transactions and **all**
   Stripe Connect Transfers with `created` in the same UTC window.
3. Partitions the ledger rows by `externalRef` shape:
   - `acct_*` → transfers leg
   - `ch_*` / `py_*` / `null` → charges leg
4. Calls `reconcileLeg()` on each leg → produces a frozen
   `DriftReport` with `driftCents`, `driftBps`, missing-in-Stripe,
   missing-in-SettleGrid, amount-mismatch arrays.
5. Writes `data/reconciliation/stripe/{date}.json` (refuses to
   overwrite without `--force`).
6. Posts a one-line summary to `SLACK_RECONCILE_WEBHOOK` and/or
   `DISCORD_RECONCILE_WEBHOOK` (best-effort — failures don't abort).
7. Calls `shouldOpenIssue(reports, lastIssueAtIso)`:
   - opens a candidate when `driftBps > thresholdBps` (default 100)
     OR any missing/mismatch row exists
   - rate-limits the open against `lastIssueAtIso` from
     `.reconcile-state.json` with a 24h window — a 24h Stripe outage
     opens **at most one** issue
   - on open: invokes `gh issue create` with labels
     `reconciliation,P0` and updates the state file.
8. Commits `data/reconciliation/` (report + state file) back to the
   default branch, so the next run sees the updated state.

---

## Triage flow when a drift issue opens

1. **Check the report.** Open
   `data/reconciliation/stripe/{date}.json` from the issue body's
   path.
2. **Locate the worst offenders** — sort `amountMismatch[]` by
   `|deltaCents|` descending. The top entries usually point to a
   single bug class (a fee not booked, a refund not flipped, etc.).
3. **Reconcile by hand for the top 3 rows**:
   - For a charges row: open the Stripe charge in the Dashboard →
     compare the charge's `amount` and `application_fee_amount` to
     the ledger row's `amountCents` and `takeCents`.
   - For a transfers row: pull all Stripe Connect Transfer events
     with the same `destination` for the day → sum amounts → compare
     to the ledger row.
4. **Common root causes:**
   - **Drift = ledger > Stripe**: Stripe webhook for a charge or
     refund failed to deliver and the rail flip never happened. Look
     for a `ledger_entries` row with `settlement_status = 'pending'`
     that should be `'settled'`.
   - **Drift = Stripe > ledger**: a Stripe charge / transfer was
     issued out-of-band (e.g., manual refund in the Dashboard) and
     SettleGrid never wrote a ledger entry for it.
   - **Amount mismatch with delta = Stripe Tax**: confirm
     `tax_cents` was booked correctly. The reconciler compares
     gross cents; tax-collected entries should appear as separate
     ledger rows, not as part of the charge row.
   - **Transfers leg matches but charges does not**: a payout
     happened on time but the originating charges weren't all
     captured / refunded — usually a timing edge case (charge
     captured 23:59:59 UTC).
5. **If the report itself looks wrong** (e.g., fewer Stripe rows
   than you can see in the Dashboard), check the workflow logs for
   pagination errors. The script throws on cursor-stall + on >1000
   pages, so a real Stripe outage during the run will fail loud.

---

## End-to-end manual smoke test (per P3.RAIL2 implementation step 5)

The orchestration script's unit tests mock the DB + Stripe at the
boundaries; before declaring the cron production-ready, run this
once against Stripe **test mode** to prove the full pipeline:

1. **Seed the ledger.** Insert 5 fake `ledger_entries` rows with
   `rail = 'stripe-connect'` and `settled_at` falling on yesterday
   UTC. For three rows set `external_ref` to a freshly-created
   Stripe test-mode charge id (`ch_*`); for two rows set it to a
   destination connected-account id (`acct_*`) you control.
   ```sql
   INSERT INTO ledger_entries
     (id, account_id, entry_type, amount_cents, currency_code,
      category, description, rail, settlement_status, settled_at,
      external_ref)
   VALUES
     (gen_random_uuid(), '...', 'credit',  4900, 'USD', 'purchase',
      'smoke 1', 'stripe-connect', 'settled', '2026-04-23T10:00Z',
      'ch_<from-test-charge>'),
     -- repeat for 4 more rows
     ;
   ```
2. **Create matching Stripe test-mode charges**, one per `ch_*`
   externalRef. (Stripe Dashboard → Test mode → Payments → Create
   payment; pre-fill the amount in cents.) Capture the `ch_*` ids.
3. **Create test-mode Connect transfers** for the two `acct_*`
   destinations, with the same gross amount as the ledger row.
4. **Run the script** locally:
   ```bash
   STRIPE_RECONCILE_KEY=rk_test_... \
   DATABASE_URL=postgres://... \
     npx tsx scripts/reconcile-stripe.ts --date 2026-04-23
   ```
5. **Verify** `data/reconciliation/stripe/2026-04-23.json`:
   - Both legs report `matchedCount > 0` and `driftBps = 0`.
   - `missingInStripe`, `missingInSettlegrid`, and `amountMismatch`
     are empty.
6. **Tear down** by deleting the 5 ledger rows you inserted (Stripe
   test-mode data can stay; it's isolated).
7. **Re-run with intentional drift** by editing one ledger amount
   so it differs from the corresponding Stripe charge, then run
   `npx tsx scripts/reconcile-stripe.ts --date 2026-04-23 --force`.
   Confirm the report records the mismatch and (if drift > 1%) the
   GitHub-issue-decision line says `OPEN`.

The script's `--dry-run` flag short-circuits the DB / Stripe / disk /
webhook / GH paths; it's only useful for arg-parsing smoke checks,
not for the end-to-end flow above.

## How to run a backfill / ad-hoc reconciliation

**Locally** (recommended for triage):

```bash
# Yesterday UTC, full run:
npx tsx scripts/reconcile-stripe.ts

# Specific UTC day:
npx tsx scripts/reconcile-stripe.ts --date 2026-04-22

# Same day twice — refuses unless forced:
npx tsx scripts/reconcile-stripe.ts --date 2026-04-22 --force

# Plan only — no DB / Stripe / disk / webhook / GH calls:
npx tsx scripts/reconcile-stripe.ts --date 2026-04-22 --dry-run

# Tighter drift threshold (e.g., 50 bps = 0.5%):
npx tsx scripts/reconcile-stripe.ts --date 2026-04-22 --threshold-bps 50
```

**Via the workflow** (good for re-runs from CI's network):
- GitHub UI → Actions → "Stripe reconciliation (daily)" → Run
  workflow → enter `date=2026-04-22` and / or `dry_run=true`.

---

## Required environment

The orchestration script needs these env vars when not in `--dry-run`:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Read-only Postgres URL (script never writes the DB). |
| `STRIPE_RECONCILE_KEY` | Stripe restricted key with `rak_balance_transaction_read` + `rak_transfer_read` (preferred). |
| `STRIPE_SECRET_KEY` | Fallback for local dev only. |
| `SLACK_RECONCILE_WEBHOOK` | Optional. https-only. SSRF-checked. |
| `DISCORD_RECONCILE_WEBHOOK` | Optional. https-only. SSRF-checked. |
| `GH_TOKEN` / `GITHUB_TOKEN` | Used by `gh issue create` when drift trips the gate. |
| `RECONCILE_REPO_SLUG` | `owner/repo` for the issue. Default: `settlegrid/settlegrid`. |

In the GitHub workflow these come from the repo's secrets (the
workflow YAML wires them up — see the `env:` block on the
`reconcile` job).

---

## Hostile-lens contracts (why the job is shaped the way it is)

- **(a) Cents arithmetic only.** `reconcileLeg` and
  `computeDriftBps` operate strictly on integer cents.
  `driftBps = Math.round((driftCents * 10000) / denominatorCents)`.
  Any non-integer amount throws `TypeError`.
- **(b) UTC calendar-day alignment.** `utcDayBounds(YYYY-MM-DD)`
  returns inclusive-start / exclusive-end Unix-second bounds; the
  00:00:00 UTC moment belongs to day N (not day N-1). Both legs
  query against the same window so the report can't reconcile a
  Stripe row from one day against a ledger row from another.
- **(c) Bounded pagination.** Stripe lists are walked through
  `paginate()` with `MAX_PAGES = 1000` × `PAGE_SIZE = 100` =
  100,000 rows max per leg. A misbehaving Stripe API returning
  `has_more: true` with `data: []` throws after the first
  cursor-stall.
- **(d) Two legs separately.** `reconcileLeg(rows, stripeRows,
  leg)` accepts either Balance Transactions or Transfers but never
  both — the input types are distinct enough that mixing them would
  fail at TypeScript compile time. The orchestrator partitions
  ledger rows by `externalRef` shape before invoking the helper, so
  a misclassified row surfaces as missing-in-Stripe rather than
  silently matching the wrong leg.

---

## When to escalate

- Two consecutive days of drift > 1% on the same leg → escalate,
  open a P0 retro.
- A drift report with `missingInSettlegrid.length > 0` → escalate,
  this means a Stripe-side action (e.g., a manual refund) bypassed
  SettleGrid's recording path.
- The workflow itself fails (not the reconciliation) → check
  Actions log; the script's own throws (cursor-stall, malformed
  Stripe response, > 1000 pages) are surfaced with stack traces.
