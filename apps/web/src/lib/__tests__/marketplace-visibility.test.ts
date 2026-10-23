import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  shouldIncludeInMarketplace,
  shouldShowClaimedBadge,
  shouldShowUnclaimedBadge,
  isClaimedDraft,
  canPurchaseCredits,
  listedInMarketplacePatchSchema,
  marketplaceInclusionSql,
  excludeInternalTestToolsSql,
  MARKETPLACE_ALWAYS_VISIBLE_STATUSES,
  MARKETPLACE_CONDITIONALLY_VISIBLE_STATUSES,
} from '../marketplace-visibility'
import { tools } from '../db/schema'
import { PgDialect } from 'drizzle-orm/pg-core'
import { INTERNAL_TEST_DEVELOPER_SLUGS, isInternalTestDeveloperSlug } from '../internal-accounts'

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

describe('shouldShowUnclaimedBadge — marketplace "Unclaimed" badge', () => {
  it('renders the badge for status=unclaimed (shadow-directory entries)', () => {
    expect(shouldShowUnclaimedBadge('unclaimed')).toBe(true)
  })

  it('does NOT render for status=draft (that is the "Claimed" badge)', () => {
    expect(shouldShowUnclaimedBadge('draft')).toBe(false)
  })

  it('does NOT render for status=active (published tools get no badge)', () => {
    expect(shouldShowUnclaimedBadge('active')).toBe(false)
  })

  it('does NOT render for unknown statuses', () => {
    for (const status of ['', 'deleted', 'hidden', 'archived']) {
      expect(shouldShowUnclaimedBadge(status)).toBe(false)
    }
  })

  it('is disjoint with shouldShowClaimedBadge — a tool card never shows both', () => {
    // Invariant: every status either shows Unclaimed XOR Claimed XOR no badge.
    for (const status of ['unclaimed', 'active', 'draft', 'deleted', '']) {
      const both = shouldShowUnclaimedBadge(status) && shouldShowClaimedBadge(status)
      expect(both, `status='${status}' fires both badges — UX double-up`).toBe(false)
    }
  })
})

describe('canPurchaseCredits — Buy Credits purchase gate', () => {
  // The canonical rule used by:
  //   - apps/web/src/app/api/billing/checkout/route.ts (server gate)
  //   - apps/web/src/app/tools/[slug]/page.tsx (render gate)
  // Drift between those two is the exact bug the producer-side audit
  // flagged — this suite exists to catch it.

  it('allows purchases on active tools', () => {
    expect(canPurchaseCredits('active')).toBe(true)
  })

  it('blocks purchases on draft tools (no Stripe Connect in developer region yet)', () => {
    expect(canPurchaseCredits('draft')).toBe(false)
  })

  it('blocks purchases on unclaimed tools (no owner → no payout recipient)', () => {
    expect(canPurchaseCredits('unclaimed')).toBe(false)
  })

  it('blocks purchases on deleted/hidden/unknown statuses', () => {
    for (const status of ['deleted', 'hidden', 'archived', '', 'active ']) {
      expect(
        canPurchaseCredits(status),
        `status='${status}' should block purchases (fail-closed)`,
      ).toBe(false)
    }
  })

  it('is strictly narrower than shouldIncludeInMarketplace', () => {
    // A tool can be marketplace-visible but not purchasable (draft, unclaimed);
    // the reverse should never be true — a purchasable tool is always visible.
    // This invariant guards against future drift where canPurchase widens to
    // statuses that shouldIncludeInMarketplace excludes.
    for (const status of ['unclaimed', 'active', 'draft']) {
      if (canPurchaseCredits(status)) {
        expect(
          shouldIncludeInMarketplace(status, true),
          `purchasable status='${status}' must also be marketplace-visible`,
        ).toBe(true)
      }
    }
  })
})

describe('isClaimedDraft — claimed listing vs developer-created draft', () => {
  it('is true for a draft that came from a directory listing', () => {
    expect(isClaimedDraft('draft', 'mcp-registry')).toBe(true)
  })

  it('is false for a draft created by the developer (no source ecosystem)', () => {
    expect(isClaimedDraft('draft', null)).toBe(false)
    expect(isClaimedDraft('draft', undefined)).toBe(false)
  })

  it('is false for non-draft statuses', () => {
    expect(isClaimedDraft('active', 'mcp-registry')).toBe(false)
    expect(isClaimedDraft('unclaimed', 'mcp-registry')).toBe(false)
  })
})

describe('marketplaceInclusionSql — canonical Drizzle predicate', () => {
  // The Drizzle predicate must mirror shouldIncludeInMarketplace exactly.
  // The hostile-review bug that prompted this helper: the public detail
  // route hand-rolled `or(eq(status,'active'), and(...draft...))` and
  // missed 'unclaimed', so unclaimed tools 404'd even though they passed
  // the marketplace grid predicate.

  it('produces a non-null SQL expression', () => {
    const expr = marketplaceInclusionSql()
    expect(expr).toBeDefined()
  })

  it('covers every always-visible status listed in MARKETPLACE_ALWAYS_VISIBLE_STATUSES', () => {
    // The TS rule says these are always visible; the SQL must agree.
    // Run both through shouldIncludeInMarketplace with listedInMarketplace=false
    // to assert the TS side independently — the SQL is asserted to
    // serialize those same literals below.
    for (const status of MARKETPLACE_ALWAYS_VISIBLE_STATUSES) {
      expect(
        shouldIncludeInMarketplace(status, false),
        `status='${status}' should be always-visible regardless of listedInMarketplace`,
      ).toBe(true)
    }
  })

  it('covers the conditionally-visible status with listed=true only', () => {
    for (const status of MARKETPLACE_CONDITIONALLY_VISIBLE_STATUSES) {
      expect(shouldIncludeInMarketplace(status, true)).toBe(true)
      expect(shouldIncludeInMarketplace(status, false)).toBe(false)
    }
  })

  it('SQL covers the 3 expected status literals (drift guard)', () => {
    // Drizzle SQL objects have circular references (table <-> column), so
    // we assert against the helper's source text instead — enough to catch
    // the specific "forgot 'unclaimed'" regression class that prompted
    // this builder without depending on Drizzle internals.
    const helperSrc = readFileSync(
      resolve(__dirname, '..', 'marketplace-visibility.ts'),
      'utf8',
    )
    const builderMatch = helperSrc.match(
      /export\s+function\s+marketplaceInclusionSql[\s\S]*?\n\}/,
    )
    expect(builderMatch, 'marketplaceInclusionSql function body not found').not.toBeNull()
    const body = builderMatch![0]
    expect(body).toContain("'unclaimed'")
    expect(body).toContain("'active'")
    expect(body).toContain("'draft'")
    expect(body).toMatch(/listedInMarketplace/)
  })

  it('always-visible + conditionally-visible sets are disjoint', () => {
    const always = new Set<string>(MARKETPLACE_ALWAYS_VISIBLE_STATUSES)
    for (const cond of MARKETPLACE_CONDITIONALLY_VISIBLE_STATUSES) {
      expect(
        always.has(cond),
        `status='${cond}' is both always-visible AND conditionally-visible — predicate semantics break`,
      ).toBe(false)
    }
  })
})

describe('internal test accounts — not listed on public surfaces', () => {
  const dialect = new PgDialect()

  it('lists settlegrid-support as the only internal test developer slug', () => {
    expect(INTERNAL_TEST_DEVELOPER_SLUGS).toEqual(['settlegrid-support'])
    expect(isInternalTestDeveloperSlug('settlegrid-support')).toBe(true)
  })

  it('does not treat the system principal, the seed account or other owners as test accounts', () => {
    for (const slug of ['settlegrid-system', 'lexwhiting', 'some-dev', '', null, undefined]) {
      expect(isInternalTestDeveloperSlug(slug)).toBe(false)
    }
  })

  it('shouldIncludeInMarketplace excludes internal test tools whatever their status', () => {
    expect(shouldIncludeInMarketplace('active', true, 'settlegrid-support')).toBe(false)
    expect(shouldIncludeInMarketplace('unclaimed', true, 'settlegrid-support')).toBe(false)
    expect(shouldIncludeInMarketplace('draft', true, 'settlegrid-support')).toBe(false)
  })

  it('shouldIncludeInMarketplace keeps the status rule for other owners', () => {
    for (const owner of ['settlegrid-system', 'lexwhiting', 'some-dev', null, undefined]) {
      expect(shouldIncludeInMarketplace('active', false, owner)).toBe(true)
      expect(shouldIncludeInMarketplace('unclaimed', false, owner)).toBe(true)
      expect(shouldIncludeInMarketplace('draft', true, owner)).toBe(true)
      expect(shouldIncludeInMarketplace('draft', false, owner)).toBe(false)
      expect(shouldIncludeInMarketplace('deleted', true, owner)).toBe(false)
    }
  })

  it('excludeInternalTestToolsSql renders a NOT EXISTS on an aliased developers table, slugs bound as params', () => {
    const q = dialect.sqlToQuery(excludeInternalTestToolsSql())
    expect(q.sql).toBe(
      'not exists (select 1 from "developers" "internal_test_developer" where "internal_test_developer"."id" = "tools"."developer_id" and "internal_test_developer"."slug" in ($1))',
    )
    expect(q.params).toEqual(['settlegrid-support'])
  })

  it('marketplaceInclusionSql combines the status rule with the internal test exclusion', () => {
    const q = dialect.sqlToQuery(marketplaceInclusionSql())
    expect(q.sql).toMatch(/^\(\(.*"tools"\."status" = \$1.*\) and not exists \(select 1 from "developers" "internal_test_developer"/)
    expect(q.params).toEqual(['unclaimed', 'active', 'draft', true, 'settlegrid-support'])
  })
})

describe('public listing surfaces apply the internal test exclusion (drift guard)', () => {
  // Every public page or API that lists, counts or looks up tools for
  // discovery must go through one of the two helpers. Owner, proxy, SDK and
  // billing paths are deliberately not in this list.
  const PUBLIC_SURFACES = [
    'app/.well-known/mpp.json/route.ts',
    'app/api/activity/route.ts',
    'app/api/ask/route.ts',
    'app/api/developers/[id]/profile/route.ts',
    'app/api/feed/route.ts',
    'app/api/marketplace/bundles/route.ts',
    'app/api/marketplace/route.ts',
    'app/api/marketplace/stats/route.ts',
    'app/api/spotlight/route.ts',
    'app/api/tools/categories/route.ts',
    'app/api/tools/directory/route.ts',
    'app/api/tools/public/[slug]/route.ts',
    'app/api/v0.1/servers/[serverName]/versions/[version]/route.ts',
    'app/api/v0.1/servers/[serverName]/versions/route.ts',
    'app/api/v0.1/servers/route.ts',
    'app/api/v0.1/x/ai.settlegrid/pricing/[serverName]/route.ts',
    'app/api/v0.1/x/ai.settlegrid/revenue/[serverName]/route.ts',
    'app/api/v0.1/x/ai.settlegrid/reviews/[serverName]/route.ts',
    'app/api/v0.1/x/ai.settlegrid/stats/route.ts',
    'app/api/v1/discover/[slug]/route.ts',
    'app/api/v1/discover/categories/route.ts',
    'app/api/v1/discover/developers/[slug]/route.ts',
    'app/api/v1/discover/route.ts',
    'app/api/v1/discover/route/route.ts',
    'app/dev/[slug]/page.tsx',
    'app/developers/page.tsx',
    'app/explore/category/[cat]/cheapest/page.tsx',
    'app/explore/category/[cat]/page.tsx',
    'app/explore/category/[cat]/reliable/page.tsx',
    'app/explore/category/[cat]/top/page.tsx',
    'app/explore/collections/[slug]/page.tsx',
    'app/explore/for/[framework]/page.tsx',
    'app/explore/page.tsx',
    'app/marketplace/marketplace-content.tsx',
    'app/marketplace/spotlight-card.tsx',
    'app/marketplace/trending/page.tsx',
    'app/sitemap.ts',
    'app/tools/[slug]/page.tsx',
    'app/tools/[slug]/with/[framework]/page.tsx',
    'app/tools/page.tsx',
    'app/try/page.tsx',
  ]

  it.each(PUBLIC_SURFACES)('%s uses excludeInternalTestToolsSql or marketplaceInclusionSql', (file) => {
    const src = readFileSync(resolve(__dirname, '..', '..', file), 'utf8')
    expect(src).toMatch(/excludeInternalTestToolsSql\(\)|marketplaceInclusionSql\(\)/)
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
