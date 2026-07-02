/**
 * G4-4 — money-column drift tripwire: the AUTHORITATIVE manifest.
 *
 * WHY THIS EXISTS (DC-14). The prod schema is materialized by `drizzle-kit push`
 * from `schema.ts` with NO down-migrations and no replayable migration history
 * (see compliance-deletion-cascade.integration.test.ts §SCHEMA MECHANISM). A
 * `push` that silently drops a NOT-NULL/DEFAULT or renames a column has no
 * rollback and no alarm — DC-14 "miss-1" already shipped a silent money-DEFAULT
 * drift (`revenueSharePct` DB-default 85 while the ORM said 100). This manifest is
 * the expected shape of the LOAD-BEARING money columns; `verifyMoneySchema` (see
 * ./money-schema-check.ts) introspects the LIVE DB against it at startup and pages
 * on any divergence, and a unit test asserts the manifest itself matches
 * `schema.ts` (so the manifest can't silently drift from the source of truth).
 *
 * This is a stored-owed-balance guard, not a "money moved" event — a proactive
 * integrity tripwire (cf. logger.ts MONEY_LOSS_KEYS).
 *
 * ── Column selection (§6 FOLD 8, DC-14) ────────────────────────────────────────
 * INCLUDED — every column whose stored value IS an owed balance / collected-money
 * amount that reconciliation SUMs or credits from:
 *   • developers.balance_cents, consumers.global_balance_cents,
 *     consumer_tool_balances.balance_cents, accounts.balance_cents — settled
 *     owed balances.
 *   • accounts.pending_debit_cents / pending_credit_cents — available-balance =
 *     balance − pendingDebit; excluding these would leave 2 of 3 accounts money
 *     columns unguarded.
 *   • ledger_entries.amount_cents (+ the amount>0 CHECK), tax_cents (non-tax rows
 *     MUST write 0 so reconciliation SUMs without coalescing — a 0→null default
 *     drift corrupts tax remittance), take_cents (platform revenue in
 *     reconciliation SUMs; nullable + a nonneg CHECK).
 *   • purchases.amount_cents, payouts.amount_cents / platform_fee_cents,
 *     invocations.cost_cents — money-movement amounts.
 *
 * EXCLUDED — recorded rationale (the drift of these corrupts a limit/cache/dormant
 * rail, NOT a stored owed balance):
 *   • DORMANT crypto-dark settlement columns —
 *     settlement_batches.total_amount_cents / platform_fee_cents,
 *     workflow_sessions.spent_cents / reserved_cents. Revisit at un-darking.
 *   • CONFIG / LIMIT / PRICE columns — developers.payout_minimum_cents,
 *     consumer_tool_balances.spending_limit_cents / auto_refill_amount_cents /
 *     auto_refill_threshold_cents, consumers.auto_refill_trigger_cents,
 *     tool prices, and denormalized rollups. A drift here corrupts a limit or a
 *     cached figure, not a stored balance owed to a party.
 *
 * ── Representation normalization (§6 FOLD 7, DC-14) ─────────────────────────────
 * `default` here is the CANONICAL expected value (numeric literal, or null when the
 * column has no DEFAULT). The two comparators each normalize their source to it:
 *   • schema.ts teeth test → drizzle `col.getSQLType()` ('integer'), `col.notNull`
 *     (boolean), and `col.hasDefault ? col.default : null` (number | null).
 *   • live checker → information_schema `data_type` ('integer'), `is_nullable`
 *     ('YES'/'NO'), and `column_default` (text '0' / null → leading-integer parse).
 * A botched normalization silently MISSES a default drift = the exact DC-14 miss-1.
 */

import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  developers,
  consumers,
  consumerToolBalances,
  purchases,
  payouts,
  ledgerEntries,
  invocations,
  accounts,
} from './schema'

export interface MoneyColumnSpec {
  /** SQL table name (as introspected from information_schema.columns). */
  table: string
  /** SQL column name (snake_case). */
  column: string
  /** The drizzle column object — the schema.ts side of the DC-24 teeth test. */
  col: AnyPgColumn
  /** Expected SQL type — drizzle getSQLType() and information_schema data_type. */
  sqlType: 'integer'
  /** Expected NOT NULL. */
  notNull: boolean
  /**
   * Expected NORMALIZED default: the numeric literal (0) for the default-0 balance
   * columns; null for the NOT-NULL-no-default amount columns and the nullable
   * take_cents. See the FOLD-7 note above for how each comparator normalizes to it.
   */
  default: number | null
}

/** The load-bearing money columns (§6 FOLD 8). */
export const MONEY_COLUMNS: readonly MoneyColumnSpec[] = [
  // ── Settled owed balances (default 0) ──
  { table: 'developers', column: 'balance_cents', col: developers.balanceCents, sqlType: 'integer', notNull: true, default: 0 },
  { table: 'consumers', column: 'global_balance_cents', col: consumers.globalBalanceCents, sqlType: 'integer', notNull: true, default: 0 },
  { table: 'consumer_tool_balances', column: 'balance_cents', col: consumerToolBalances.balanceCents, sqlType: 'integer', notNull: true, default: 0 },
  { table: 'accounts', column: 'balance_cents', col: accounts.balanceCents, sqlType: 'integer', notNull: true, default: 0 },
  // ── accounts pending legs (available = balance − pendingDebit) ── (FOLD 8)
  { table: 'accounts', column: 'pending_debit_cents', col: accounts.pendingDebitCents, sqlType: 'integer', notNull: true, default: 0 },
  { table: 'accounts', column: 'pending_credit_cents', col: accounts.pendingCreditCents, sqlType: 'integer', notNull: true, default: 0 },
  // ── ledger amounts ──
  { table: 'ledger_entries', column: 'amount_cents', col: ledgerEntries.amountCents, sqlType: 'integer', notNull: true, default: null },
  { table: 'ledger_entries', column: 'tax_cents', col: ledgerEntries.taxCents, sqlType: 'integer', notNull: true, default: 0 }, // FOLD 8
  { table: 'ledger_entries', column: 'take_cents', col: ledgerEntries.takeCents, sqlType: 'integer', notNull: false, default: null }, // FOLD 8 — nullable
  // ── money-movement amounts (NOT NULL, no default) ──
  { table: 'purchases', column: 'amount_cents', col: purchases.amountCents, sqlType: 'integer', notNull: true, default: null },
  { table: 'payouts', column: 'amount_cents', col: payouts.amountCents, sqlType: 'integer', notNull: true, default: null },
  { table: 'payouts', column: 'platform_fee_cents', col: payouts.platformFeeCents, sqlType: 'integer', notNull: true, default: null },
  { table: 'invocations', column: 'cost_cents', col: invocations.costCents, sqlType: 'integer', notNull: true, default: null },
]

export interface MoneyCheckSpec {
  /** Constraint name in pg_constraint.conname. */
  name: string
  table: string
  /** Substrings pg_get_constraintdef() must contain (order-independent). */
  definitionContains: readonly string[]
}

/**
 * VALUE-RANGE CHECK constraints on the guarded money-cents columns (amount_cents > 0,
 * take_cents >= 0) — the reconciliation-SUM integrity invariants. The OTHER ledger
 * CHECKs (tax↔jurisdiction pairing, take_bps range, settlement-status enum) are a
 * different invariant class (not a value-range on a guarded cents column) and are out
 * of this money-drift scope. Teeth are runtime-only (mocked in unit): drizzle does not
 * expose table `check()` config on the column runtime API the schema.ts teeth test reads.
 */
export const MONEY_CHECKS: readonly MoneyCheckSpec[] = [
  {
    name: 'ledger_entries_amount_positive',
    table: 'ledger_entries',
    // Anchor to the operand: a bare '> 0' is a substring of a weakened '<> 0' (which
    // permits negatives), so match 'amount_cents > 0' as one unit (② seal fold).
    definitionContains: ['amount_cents > 0'],
  },
  {
    // take_cents (nullable) is a guarded money column — platform revenue summed in
    // reconciliation. Its nonneg CHECK is the value-range invariant on that column,
    // same class as amount_positive; a push that drops it lets a negative take_cents
    // silently corrupt the SUM. (② seal fold — the manifest's stated take_cents
    // rationale, now actually guarded.)
    name: 'ledger_entries_take_cents_nonneg',
    table: 'ledger_entries',
    definitionContains: ['take_cents >= 0'],
  },
]

export interface MoneyIndexSpec {
  /** Index name in pg_indexes.indexname. */
  name: string
  table: string
  /**
   * Expected UNIQUE-ness. The partial-UNIQUE property IS the mutex — a NON-unique
   * same-named index with the identical predicate enforces nothing (③ deep-audit
   * HIGH): two concurrent 'processing' payout rows for one dev would both insert
   * without a unique violation → double-pay. So the checker asserts CREATE UNIQUE
   * INDEX on the un-sliced indexdef, not just the predicate.
   */
  unique: boolean
  /**
   * The single key column the mutex is enforced on. A same-named index re-keyed
   * onto a trivially-unique column (e.g. `id`) keeps the name+predicate but drops
   * the per-developer mutex — the checker asserts the key column too (③ deep-audit).
   */
  keyColumn: string
  /**
   * Literals the index PREDICATE must contain (§6 FOLD 10). pg renders the
   * `WHERE status IN ('processing','unknown')` predicate as an ANY(ARRAY[...])
   * expression, so we assert both literals are present rather than string-match
   * the whole predicate — a `drizzle-kit push` that recreated the mutex WITHOUT
   * 'unknown' would drop that literal and reopen the double-pay hole.
   */
  predicateContains: readonly string[]
}

/**
 * Partial-unique indexes enforcing a money mutex. NOTE (§6 FOLD 10): this index is
 * NOT declared in schema.ts (raw SQL migrations drizzle/0009 + 0010 only), so the
 * manifest↔schema.ts teeth test CANNOT guard it — its teeth are runtime-only
 * (mocked in unit; prod presence + predicate already operator-verified 2026-06-30,
 * roadmap §P:137). The runtime check re-asserts it cheaply on every warm instance.
 */
export const MONEY_INDEXES: readonly MoneyIndexSpec[] = [
  {
    name: 'payouts_one_processing_per_dev',
    table: 'payouts',
    unique: true,
    keyColumn: 'developer_id',
    predicateContains: ['processing', 'unknown'],
  },
]
