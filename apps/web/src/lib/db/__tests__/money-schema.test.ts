/**
 * G4-4 tests — money-column drift tripwire (DC-14 / DC-24 teeth).
 *
 * Two independent teeth:
 *  (A) manifest ↔ schema.ts — the manifest's hand-written expected shape is
 *      asserted against schema.ts's ACTUAL drizzle runtime metadata (name,
 *      getSQLType(), notNull, normalized default). Fails RED if EITHER side drifts
 *      without the other — so the manifest can't silently diverge from the source
 *      of truth (§6 FOLD 7 normalization on the drizzle side).
 *  (B) verifyMoneySchema — against a MOCKED introspection result: a clean live
 *      schema → zero drift; each drift class (incl. THE DC-14 miss-1 dropped
 *      money-default, and the FOLD-10 mutex predicate losing 'unknown') → detected.
 */

import { describe, it, expect, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  MONEY_COLUMNS,
  MONEY_CHECKS,
  MONEY_INDEXES,
  type MoneyColumnSpec,
} from '@/lib/db/money-schema-manifest'
import {
  verifyMoneySchema,
  type IntrospectableDb,
  type SchemaDrift,
} from '@/lib/db/money-schema-check'

// ── (A) manifest ↔ schema.ts (drizzle runtime metadata) ────────────────────────

describe('money-schema manifest ↔ schema.ts (DC-24 teeth)', () => {
  it('manifest covers exactly the 13 load-bearing money columns (FOLD 8)', () => {
    // A guard so a column silently dropped from the manifest (un-guarding a money
    // column) is loud. Update this count deliberately when the money set changes.
    expect(MONEY_COLUMNS.length).toBe(13)
  })

  it.each(MONEY_COLUMNS.map((c) => [`${c.table}.${c.column}`, c] as const))(
    '%s matches its schema.ts drizzle column metadata',
    (_label, spec: MoneyColumnSpec) => {
      // SQL column name — catches a snake_case rename in schema.ts.
      expect(spec.col.name).toBe(spec.column)
      // SQL type — getSQLType() is drizzle's representation ('integer'), NOT
      // col.dataType ('number') — §6 FOLD 7.
      expect(spec.col.getSQLType()).toBe(spec.sqlType)
      // NOT NULL.
      expect(spec.col.notNull).toBe(spec.notNull)
      // Default, normalized: hasDefault ? the literal : null. §6 FOLD 7 — a dropped
      // or added money-default drifts this vs the manifest and goes RED.
      const drizzleDefault = spec.col.hasDefault ? (spec.col.default as number) : null
      expect(drizzleDefault).toBe(spec.default)
    },
  )
})

// ── (B) verifyMoneySchema vs mocked introspection ──────────────────────────────

interface ColumnRow {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

/** A fresh CLEAN information_schema.columns result derived from the manifest. */
function cleanColumnRows(): ColumnRow[] {
  return MONEY_COLUMNS.map((c) => ({
    table_name: c.table,
    column_name: c.column,
    data_type: c.sqlType,
    is_nullable: c.notNull ? 'NO' : 'YES',
    column_default: c.default === null ? null : String(c.default),
  }))
}

const cleanCheckRows = () => [
  { conname: 'ledger_entries_amount_positive', def: 'CHECK ((amount_cents > 0))' },
  { conname: 'ledger_entries_take_cents_nonneg', def: 'CHECK (((take_cents IS NULL) OR (take_cents >= 0)))' },
]

const cleanIndexRows = () => [
  {
    indexname: 'payouts_one_processing_per_dev',
    indexdef:
      "CREATE UNIQUE INDEX payouts_one_processing_per_dev ON public.payouts USING btree (developer_id) " +
      "WHERE ((status = ANY (ARRAY['processing'::text, 'unknown'::text])))",
  },
]

/**
 * A fake drizzle db: verifyMoneySchema calls execute() exactly 3 times in order
 * (columns, checks, indexes), so we return the queued result sets by call order.
 */
function makeDb(columns: unknown[], checks: unknown[], indexes: unknown[]): IntrospectableDb {
  const responses = [columns, checks, indexes]
  let i = 0
  return { execute: vi.fn(async () => responses[i++] ?? []) }
}

const keyOf = (d: SchemaDrift) => `${d.kind}:${d.target}`

describe('verifyMoneySchema (DC-14 live-drift detection)', () => {
  it('returns ZERO drift when the live schema matches the manifest', async () => {
    const db = makeDb(cleanColumnRows(), cleanCheckRows(), cleanIndexRows())
    const drifts = await verifyMoneySchema(db)
    expect(drifts).toEqual([])
  })

  it('detects a DROPPED money-default (the DC-14 miss-1 recurrence)', async () => {
    // developers.balance_cents loses its DEFAULT 0 on a bad push.
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'developers' && c.column_name === 'balance_cents')!
    target.column_default = null
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('default_mismatch:developers.balance_cents')
  })

  it('detects a SPURIOUS default added to a no-default column', async () => {
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'purchases' && c.column_name === 'amount_cents')!
    target.column_default = '0'
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('default_mismatch:purchases.amount_cents')
  })

  it('detects a missing column', async () => {
    const cols = cleanColumnRows().filter(
      (c) => !(c.table_name === 'invocations' && c.column_name === 'cost_cents'),
    )
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('missing_column:invocations.cost_cents')
  })

  it('detects a nullability drift (NOT NULL dropped)', async () => {
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'ledger_entries' && c.column_name === 'amount_cents')!
    target.is_nullable = 'YES'
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('nullability_mismatch:ledger_entries.amount_cents')
  })

  it('detects a type drift (integer → bigint)', async () => {
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'accounts' && c.column_name === 'balance_cents')!
    target.data_type = 'bigint'
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('type_mismatch:accounts.balance_cents')
  })

  it('detects a missing amount>0 CHECK', async () => {
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), [], cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('missing_check:check:ledger_entries_amount_positive')
  })

  it("detects the payout mutex predicate losing 'unknown' (FOLD 10 — reopens double-pay)", async () => {
    const badIndex = [
      {
        indexname: 'payouts_one_processing_per_dev',
        indexdef:
          "CREATE UNIQUE INDEX payouts_one_processing_per_dev ON public.payouts USING btree (developer_id) " +
          "WHERE ((status = 'processing'::text))",
      },
    ]
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), cleanCheckRows(), badIndex))
    expect(drifts.map(keyOf)).toContain('index_predicate_mismatch:index:payouts_one_processing_per_dev')
  })

  it('detects a missing payout mutex index', async () => {
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), cleanCheckRows(), []))
    expect(drifts.map(keyOf)).toContain('missing_index:index:payouts_one_processing_per_dev')
  })

  // ── ② seal folds (fail-then-pass reproduced): the predicate/CHECK substring
  //    matches must not be satisfiable by the index NAME or a superstring operator.
  it("detects the payout mutex predicate losing 'processing' — the index NAME must not satisfy the literal", async () => {
    // pg_indexes.indexdef embeds the index name `payouts_one_processing_per_dev`,
    // which itself contains 'processing'. A drift that drops 'processing' from the
    // WHERE predicate (keeping 'unknown') reopens the double-pay hole for two
    // concurrent 'processing' payouts. Matching the whole indexdef made this
    // undetectable; the checker must assert against the WHERE-predicate portion.
    const badIndex = [
      {
        indexname: 'payouts_one_processing_per_dev',
        indexdef:
          "CREATE UNIQUE INDEX payouts_one_processing_per_dev ON public.payouts USING btree (developer_id) " +
          "WHERE ((status = 'unknown'::text))",
      },
    ]
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), cleanCheckRows(), badIndex))
    expect(drifts.map(keyOf)).toContain('index_predicate_mismatch:index:payouts_one_processing_per_dev')
  })

  it('detects a CHECK weakened from > 0 to <> 0 (allows negatives) — substring must not false-pass', async () => {
    // `<> 0` renders the substring `> 0`, so a bare `.includes('> 0')` false-passes
    // a weakened constraint that permits negative amounts. Anchor to the operand.
    const badChecks = [{ conname: 'ledger_entries_amount_positive', def: 'CHECK ((amount_cents <> 0))' }]
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), badChecks, cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('check_definition_mismatch:check:ledger_entries_amount_positive')
  })

  it('detects a dropped take_cents nonneg CHECK (money-invariant CHECK on a guarded cents column)', async () => {
    const checks = cleanCheckRows().filter((c) => c.conname !== 'ledger_entries_take_cents_nonneg')
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), checks, cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('missing_check:check:ledger_entries_take_cents_nonneg')
  })

  it('detects take_cents nonneg CHECK weakened >= 0 → <> 0 (allows negatives) — anchored to the operand', async () => {
    // Symmetric with the amount_positive '<> 0' fold: a weakened `CHECK (take_cents <> 0)`
    // renders the substring `>= 0`? no — but `<> 0` permits negatives; the anchor
    // 'take_cents >= 0' must not be satisfied by a `<> 0` render (③ deep-audit teeth).
    const badChecks = cleanCheckRows().map((c) =>
      c.conname === 'ledger_entries_take_cents_nonneg'
        ? { conname: c.conname, def: 'CHECK (((take_cents IS NULL) OR (take_cents <> 0)))' }
        : c,
    )
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), badChecks, cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('check_definition_mismatch:check:ledger_entries_take_cents_nonneg')
  })

  // ── ③ deep-audit HIGH: the payout mutex is the UNIQUE-ness on (developer_id),
  //    not merely the WHERE predicate. A non-unique or re-keyed same-named index
  //    keeps name+predicate but enforces NO mutex → double-pay reopens silently.
  it('detects a NON-UNIQUE same-named payout index (mutex gone even with the right predicate)', async () => {
    const badIndex = [
      {
        indexname: 'payouts_one_processing_per_dev',
        indexdef:
          'CREATE INDEX payouts_one_processing_per_dev ON public.payouts USING btree (developer_id) ' +
          "WHERE ((status = ANY (ARRAY['processing'::text, 'unknown'::text])))",
      },
    ]
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), cleanCheckRows(), badIndex))
    expect(drifts.map(keyOf)).toContain('index_definition_mismatch:index:payouts_one_processing_per_dev')
  })

  it('detects a RE-KEYED payout index (unique on id, not developer_id — per-dev mutex gone)', async () => {
    const badIndex = [
      {
        indexname: 'payouts_one_processing_per_dev',
        indexdef:
          'CREATE UNIQUE INDEX payouts_one_processing_per_dev ON public.payouts USING btree (id) ' +
          "WHERE ((status = ANY (ARRAY['processing'::text, 'unknown'::text])))",
      },
    ]
    const drifts = await verifyMoneySchema(makeDb(cleanColumnRows(), cleanCheckRows(), badIndex))
    expect(drifts.map(keyOf)).toContain('index_definition_mismatch:index:payouts_one_processing_per_dev')
  })

  // ── ③ deep-audit MED (DC-14): normalizeLiveDefault must reject an EXPRESSION
  //    default whose leading digit-run coincides with the expected value.
  it('detects an EXPRESSION default whose first integer coincides with the expected (tax_cents 0 → (0 + 500))', async () => {
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'ledger_entries' && c.column_name === 'tax_cents')!
    // real default silently becomes 500, but the text begins with '0' — the old
    // 'first \d+ wins' parser read this as 0 and false-passed a default-0 column.
    target.column_default = '(0 + 500)'
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).toContain('default_mismatch:ledger_entries.tax_cents')
  })

  it('still accepts a healthy integer-literal default with a type cast (0::integer)', async () => {
    const cols = cleanColumnRows()
    const target = cols.find((c) => c.table_name === 'developers' && c.column_name === 'balance_cents')!
    target.column_default = '0::integer' // some pg renders the cast — must NOT drift
    const drifts = await verifyMoneySchema(makeDb(cols, cleanCheckRows(), cleanIndexRows()))
    expect(drifts.map(keyOf)).not.toContain('default_mismatch:developers.balance_cents')
  })

  it('manifest predicate literals include both processing and unknown', () => {
    const mutex = MONEY_INDEXES.find((i) => i.name === 'payouts_one_processing_per_dev')!
    expect(mutex.predicateContains).toEqual(expect.arrayContaining(['processing', 'unknown']))
    expect(MONEY_CHECKS.map((c) => c.name)).toContain('ledger_entries_amount_positive')
  })
})

// ── (C) EXECUTABILITY teeth (③ deep-audit) — the mocked-execute tests above cannot
//    catch a query-GENERATION bug, so this drives verifyMoneySchema, captures the
//    SQL objects it hands to db.execute, and renders each via the real drizzle
//    PgDialect. Guards the HIGH "dead-on-arrival" defect: `= ANY(${jsArray}::text[])`
//    rendered as `= ANY(($1,$2,…)::text[])` — a RECORD tuple that Postgres rejects
//    at parse ("cannot cast type record to text[]"), so the check threw on every
//    real run and silently never detected drift.
describe('verifyMoneySchema emits EXECUTABLE Postgres (query-render teeth)', () => {
  function captureQueries(): { db: IntrospectableDb; rendered: () => string[] } {
    const captured: SQL[] = []
    const db: IntrospectableDb = {
      execute: vi.fn(async (q: SQL) => {
        captured.push(q)
        return []
      }),
    }
    const dialect = new PgDialect()
    return { db, rendered: () => captured.map((q) => dialect.sqlToQuery(q).sql) }
  }

  it('binds name arrays as text[] params, never a `($1,$2,…)` record tuple cast', async () => {
    const { db, rendered } = captureQueries()
    await verifyMoneySchema(db)
    const queries = rendered()
    expect(queries.length).toBe(3) // columns, checks, indexes
    for (const q of queries) {
      // The shipped bug: `= ANY(($1, $2, …)::text[])` — record cast, pg-invalid.
      expect(q).not.toMatch(/ANY\(\(\$/)
      // The fix: a genuine `ARRAY[$1, $2, …]::text[]`.
      expect(q).toMatch(/ANY\(ARRAY\[\$/)
    }
  })

  it('scopes the CHECK-constraint query to public-schema CHECK constraints (no cross-schema masking)', async () => {
    const { db, rendered } = captureQueries()
    await verifyMoneySchema(db)
    const checkQuery = rendered()[1] // columns[0], checks[1], indexes[2]
    expect(checkQuery).toMatch(/contype = 'c'/)
    expect(checkQuery).toMatch(/connamespace = 'public'::regnamespace/)
  })
})
