import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  shouldIncludeInMarketplace,
  shouldShowClaimedBadge,
  listedInMarketplacePatchSchema,
} from '../marketplace-visibility'
import { tools } from '../db/schema'

describe('shouldIncludeInMarketplace — P2.INTL2 marketplace inclusion rule', () => {
  describe('unclaimed tools', () => {
    it('always included regardless of listedInMarketplace flag', () => {
      expect(shouldIncludeInMarketplace('unclaimed', true)).toBe(true)
      expect(shouldIncludeInMarketplace('unclaimed', false)).toBe(true)
    })
  })

  describe('active tools', () => {
    it('always included regardless of listedInMarketplace flag', () => {
      expect(shouldIncludeInMarketplace('active', true)).toBe(true)
      expect(shouldIncludeInMarketplace('active', false)).toBe(true)
    })
  })

  describe('draft tools', () => {
    it('included only when listedInMarketplace=true (developer opted in)', () => {
      expect(shouldIncludeInMarketplace('draft', true)).toBe(true)
    })

    it('excluded when listedInMarketplace=false (developer opted out OR pre-migration backfill)', () => {
      // Two cases land here in practice:
      //   1. Developer who claimed pre-P2.INTL2 — backfill set this to false
      //      to avoid retroactively exposing their work-in-progress
      //   2. Developer who explicitly hid their draft via the dashboard toggle
      // The rule is identical for both cases.
      expect(shouldIncludeInMarketplace('draft', false)).toBe(false)
    })
  })

  describe('other / unsupported statuses', () => {
    it('excluded for deleted, hidden, and unknown statuses regardless of flag', () => {
      const otherStatuses = ['deleted', 'hidden', 'archived', 'unknown', '']
      for (const status of otherStatuses) {
        expect(
          shouldIncludeInMarketplace(status, true),
          `status='${status}' with listedInMarketplace=true should be excluded`,
        ).toBe(false)
        expect(
          shouldIncludeInMarketplace(status, false),
          `status='${status}' with listedInMarketplace=false should be excluded`,
        ).toBe(false)
      }
    })
  })

  describe('regression: claim transition preserves visibility', () => {
    // The claim flow transitions status='unclaimed' -> 'draft' AND sets
    // listedInMarketplace=true (apps/web/src/app/api/tools/claim/route.ts).
    // Both states should be marketplace-visible — that's the whole point
    // of the P2.INTL2 work.
    it('pre-claim (status=unclaimed, listed=true): visible', () => {
      expect(shouldIncludeInMarketplace('unclaimed', true)).toBe(true)
    })

    it('post-claim (status=draft, listed=true): still visible — no visibility gap', () => {
      expect(shouldIncludeInMarketplace('draft', true)).toBe(true)
    })

    it('post-claim if developer later hides via dashboard (status=draft, listed=false): hidden', () => {
      expect(shouldIncludeInMarketplace('draft', false)).toBe(false)
    })
  })
})

describe('shouldShowClaimedBadge — P2.INTL2 marketplace card badge', () => {
  it('shows the badge for status=draft (claimed but not yet monetized)', () => {
    expect(shouldShowClaimedBadge('draft')).toBe(true)
  })

  it('does NOT show the badge for status=unclaimed (no owner)', () => {
    expect(shouldShowClaimedBadge('unclaimed')).toBe(false)
  })

  it('does NOT show the badge for status=active (already monetized)', () => {
    expect(shouldShowClaimedBadge('active')).toBe(false)
  })

  it('does NOT show the badge for unknown statuses', () => {
    expect(shouldShowClaimedBadge('deleted')).toBe(false)
    expect(shouldShowClaimedBadge('hidden')).toBe(false)
    expect(shouldShowClaimedBadge('')).toBe(false)
  })
})

describe('listedInMarketplacePatchSchema — PATCH endpoint wire shape', () => {
  it('accepts { listedInMarketplace: true }', () => {
    const result = listedInMarketplacePatchSchema.safeParse({
      listedInMarketplace: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts { listedInMarketplace: false }', () => {
    const result = listedInMarketplacePatchSchema.safeParse({
      listedInMarketplace: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-boolean values', () => {
    // Truthy/falsy strings, numbers, null — none should coerce silently.
    // The PATCH handler must receive an explicit boolean from the dashboard
    // toggle, not a string like "true" that could be misinterpreted.
    for (const bad of ['true', 'false', 1, 0, null, undefined]) {
      const result = listedInMarketplacePatchSchema.safeParse({
        listedInMarketplace: bad,
      })
      expect(result.success, `expected ${JSON.stringify(bad)} to fail validation`).toBe(false)
    }
  })

  it('rejects empty body', () => {
    const result = listedInMarketplacePatchSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects extra unknown fields by default (Zod object behavior)', () => {
    // Zod's default object parser strips unknown keys, so a request with
    // listedInMarketplace + extra noise still parses successfully but the
    // noise is dropped. This documents that behavior — if the requirement
    // ever tightens to "reject unknown keys," we'd need .strict() and this
    // test would catch the change.
    const result = listedInMarketplacePatchSchema.safeParse({
      listedInMarketplace: true,
      somethingElse: 'noise',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ listedInMarketplace: true })
      expect((result.data as Record<string, unknown>).somethingElse).toBeUndefined()
    }
  })
})

describe('tools.listedInMarketplace — schema column metadata', () => {
  // The pure-function rule plus the SQL predicates depend on the column
  // existing with the right type and default. If someone removes or renames
  // the column without updating the schema, these tests fail at type-load
  // time AND at runtime so the regression is loud.

  it('column is defined on the tools table', () => {
    expect(tools.listedInMarketplace).toBeDefined()
  })

  it('column is non-nullable (the rule depends on every row having a value)', () => {
    expect(tools.listedInMarketplace.notNull).toBe(true)
  })

  it('column default is true (preserves visibility on new claim transitions)', () => {
    // The default is what makes claim-route visibility-preserving:
    // even if the route handler forgot to set listedInMarketplace=true,
    // the database default would still produce the right behavior.
    expect(tools.listedInMarketplace.default).toBe(true)
  })

  it('column maps to listed_in_marketplace in SQL', () => {
    // The migration SQL adds "listed_in_marketplace" specifically; if the
    // schema's column name drifted from snake_case, the migration would
    // succeed but Drizzle queries would fail at runtime.
    expect(tools.listedInMarketplace.name).toBe('listed_in_marketplace')
  })
})

describe('migration 0001_listed_in_marketplace.sql — backfill correctness', () => {
  // Read the migration file as text and assert it contains the right
  // structural clauses. This is a thin guard, not a substitute for a real
  // DB migration test — but it catches obvious regressions like:
  //   - Someone removes the UPDATE backfill clause (would silently expose
  //     existing developers' draft tools)
  //   - Someone changes the default to false (would hide all existing
  //     unclaimed tools)
  //   - Someone changes the column type or NOT NULL constraint
  const migrationPath = resolve(__dirname, '../../../drizzle/0001_listed_in_marketplace.sql')
  const sql = readFileSync(migrationPath, 'utf8')

  it('adds the column with default true and NOT NULL', () => {
    expect(sql).toMatch(/ADD COLUMN\s+"listed_in_marketplace"\s+boolean\s+DEFAULT\s+true\s+NOT NULL/i)
  })

  it('backfills existing draft rows to false (does not expose work-in-progress)', () => {
    expect(sql).toMatch(/UPDATE\s+"tools"\s+SET\s+"listed_in_marketplace"\s*=\s*false\s+WHERE\s+"status"\s*=\s*'draft'/i)
  })

  it('does NOT touch existing unclaimed or active rows in the backfill', () => {
    // The default already handles them (true). A separate UPDATE for those
    // statuses would be redundant at best and could regress the default at
    // worst. This test catches a future change that adds such a redundant
    // (or worse, conflicting) clause.
    expect(sql).not.toMatch(/UPDATE\s+"tools"[^;]*WHERE\s+"status"\s*=\s*'unclaimed'/i)
    expect(sql).not.toMatch(/UPDATE\s+"tools"[^;]*WHERE\s+"status"\s*=\s*'active'/i)
  })

  it('uses the statement-breakpoint marker between ALTER and UPDATE (Drizzle migrator convention)', () => {
    // The migrator uses --> statement-breakpoint to split the file into
    // separate statements. Without it, the ALTER + UPDATE could fail to
    // execute on some databases (e.g., column doesn't exist when UPDATE
    // runs because the ALTER hadn't committed yet).
    expect(sql).toContain('--> statement-breakpoint')
  })
})
