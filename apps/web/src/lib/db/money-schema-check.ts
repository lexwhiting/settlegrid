/**
 * G4-4 — money-column drift checker (DC-14 tripwire).
 *
 * `verifyMoneySchema(db)` introspects the LIVE database (information_schema.columns
 * + pg_constraint + pg_indexes) and returns every divergence from the manifest
 * (./money-schema-manifest.ts). Wired into instrumentation.ts's register() as a
 * nodejs+prod, fire-and-forget, once-per-warm-instance startup check — on drift it
 * pages via logger.error('schema.money_column_drift'); it NEVER throws (a rejecting
 * introspection query is caught by the caller and routed to a non-money-loss warn
 * key, so a transient boot DB blip can't false-page the money-loss alert class).
 *
 * The db is passed in (not imported) so this module stays free of the postgres
 * connection — the caller dynamically imports @/lib/db inside the nodejs guard
 * (§6 FOLD 3: a top-level postgres import breaks the edge build).
 *
 * NORMALIZATION (§6 FOLD 7): the manifest holds the canonical expected shape; this
 * checker normalizes the information_schema representation to it — is_nullable
 * 'YES'/'NO' → boolean, and column_default text ('0' / null) → numeric-or-null via
 * a leading-integer parse. The sibling schema.ts teeth test normalizes the drizzle
 * representation to the same manifest. A botched normalization silently misses a
 * default drift = the exact DC-14 miss-1 this check exists to catch.
 */

import { sql, type SQL } from 'drizzle-orm'
import { MONEY_COLUMNS, MONEY_CHECKS, MONEY_INDEXES } from './money-schema-manifest'

export type SchemaDriftKind =
  | 'missing_column'
  | 'type_mismatch'
  | 'nullability_mismatch'
  | 'default_mismatch'
  | 'missing_check'
  | 'check_definition_mismatch'
  | 'missing_index'
  | 'index_predicate_mismatch'

export interface SchemaDrift {
  kind: SchemaDriftKind
  /** e.g. 'developers.balance_cents', 'check:ledger_entries_amount_positive'. */
  target: string
  expected: string
  actual: string
}

/**
 * Minimal structural shape of the drizzle db this checker needs. Typed loosely on
 * the return so the real postgres-js `db` (whose generic `execute` yields a RowList)
 * and a test mock both satisfy it; the awaited rows are cast to the concrete SELECT
 * shape below (we control every column list).
 */
export interface IntrospectableDb {
  execute: (query: SQL) => Promise<unknown>
}

interface ColumnRow {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface CheckRow {
  conname: string
  def: string
}

interface IndexRow {
  indexname: string
  indexdef: string
}

/** information_schema column_default text ('0' | null) → normalized numeric-or-null. */
function normalizeLiveDefault(raw: string | null): number | null {
  if (raw === null) return null
  const m = /-?\d+/.exec(raw)
  // A non-numeric default on an integer money column is itself a drift — return
  // NaN so it can never `===` a manifest expectation (null or a number).
  return m ? Number(m[0]) : Number.NaN
}

function fmtDefault(v: number | null): string {
  return v === null ? 'null' : String(v)
}

export async function verifyMoneySchema(db: IntrospectableDb): Promise<SchemaDrift[]> {
  const drifts: SchemaDrift[] = []

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columnTables = [...new Set(MONEY_COLUMNS.map((c) => c.table))]
  const colRows = (await db.execute(sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${columnTables}::text[])
  `)) as ColumnRow[]

  const colByKey = new Map<string, ColumnRow>()
  for (const r of colRows) colByKey.set(`${r.table_name}.${r.column_name}`, r)

  for (const spec of MONEY_COLUMNS) {
    const key = `${spec.table}.${spec.column}`
    const row = colByKey.get(key)
    if (!row) {
      drifts.push({
        kind: 'missing_column',
        target: key,
        expected: `${spec.sqlType} notNull=${spec.notNull} default=${fmtDefault(spec.default)}`,
        actual: 'absent',
      })
      continue
    }
    if (row.data_type !== spec.sqlType) {
      drifts.push({ kind: 'type_mismatch', target: key, expected: spec.sqlType, actual: row.data_type })
    }
    const liveNotNull = row.is_nullable === 'NO'
    if (liveNotNull !== spec.notNull) {
      drifts.push({
        kind: 'nullability_mismatch',
        target: key,
        expected: `notNull=${spec.notNull}`,
        actual: `notNull=${liveNotNull}`,
      })
    }
    const liveDefault = normalizeLiveDefault(row.column_default)
    if (liveDefault !== spec.default) {
      drifts.push({
        kind: 'default_mismatch',
        target: key,
        expected: `default=${fmtDefault(spec.default)}`,
        actual: `default=${fmtDefault(liveDefault)}`,
      })
    }
  }

  // ── CHECK constraints ────────────────────────────────────────────────────────
  const checkNames = MONEY_CHECKS.map((c) => c.name)
  if (checkNames.length > 0) {
    const checkRows = (await db.execute(sql`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conname = ANY(${checkNames}::text[])
    `)) as CheckRow[]
    const defByName = new Map(checkRows.map((r) => [r.conname, r.def]))
    for (const spec of MONEY_CHECKS) {
      const def = defByName.get(spec.name)
      if (def === undefined) {
        drifts.push({
          kind: 'missing_check',
          target: `check:${spec.name}`,
          expected: `contains ${spec.definitionContains.join(', ')}`,
          actual: 'absent',
        })
        continue
      }
      if (spec.definitionContains.some((s) => !def.includes(s))) {
        drifts.push({
          kind: 'check_definition_mismatch',
          target: `check:${spec.name}`,
          expected: `contains ${spec.definitionContains.join(', ')}`,
          actual: def,
        })
      }
    }
  }

  // ── Partial-unique money mutex indexes (§6 FOLD 10 — assert the PREDICATE) ─────
  const indexNames = MONEY_INDEXES.map((i) => i.name)
  if (indexNames.length > 0) {
    const indexRows = (await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY(${indexNames}::text[])
    `)) as IndexRow[]
    const defByName = new Map(indexRows.map((r) => [r.indexname, r.indexdef]))
    for (const spec of MONEY_INDEXES) {
      const def = defByName.get(spec.name)
      if (def === undefined) {
        drifts.push({
          kind: 'missing_index',
          target: `index:${spec.name}`,
          expected: `predicate contains ${spec.predicateContains.join(', ')}`,
          actual: 'absent',
        })
        continue
      }
      // Assert against the WHERE-predicate portion ONLY. pg_indexes.indexdef embeds
      // the index NAME (the payout mutex name literally contains 'processing'), so
      // matching the whole def would let the name vacuously satisfy a predicate
      // literal — a drift dropping 'processing' from the WHERE clause would go
      // undetected and reopen the double-pay hole (② seal fold). No WHERE at all
      // (a mutex that lost its partial predicate) → empty predicate → both literals
      // missing → drift, which is correct.
      const whereAt = def.search(/\bWHERE\b/i)
      const predicate = whereAt >= 0 ? def.slice(whereAt) : ''
      if (spec.predicateContains.some((s) => !predicate.includes(s))) {
        drifts.push({
          kind: 'index_predicate_mismatch',
          target: `index:${spec.name}`,
          expected: `predicate contains ${spec.predicateContains.join(', ')}`,
          actual: whereAt >= 0 ? predicate : def,
        })
      }
    }
  }

  return drifts
}
