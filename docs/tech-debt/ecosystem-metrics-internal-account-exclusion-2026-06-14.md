# Internal/seed account exclusion from growth metrics — STOPGAP shipped + `isInternal` flag DRAFT (2026-06-14)

> Why: a 2026-06-14 prod audit found SettleGrid's "traction" metrics were ~90% seed/internal (29/31 active
> tools + ~7/16 developers; 124,929 invocations + $16.2K tool-revenue were seed from
> `apps/web/scripts/seed-dashboard-data.ts`; ledger = $0). The seed invocations/counters were cleaned
> (is_test flag + counter reset, applied to prod 2026-06-14). This doc covers the METRIC-side exclusion so
> internal/founder/system accounts stop inflating dev + active-tool counts. Best-practice basis: persistent
> internal-user flag + analysis-level filtering (PostHog "internal users" cohort, GA4 internal-traffic flags).

## Phase 1 — STOPGAP (DONE, local/uncommitted 2026-06-14)
- **`apps/web/src/lib/internal-accounts.ts`** — single source of truth: `INTERNAL_EMAIL_DOMAINS`
  (`settlegrid.ai`, `settlegrid.com`, `alerterra.com`), `INTERNAL_DEVELOPER_EMAILS` (the 3 founder/seed
  gmails), and `isInternalEmail(email)`.
- **`apps/web/src/app/api/cron/ecosystem-metrics/route.ts`** — `countTools`/`countDevelopers` now filter via
  `isInternalEmail` and the email reports **external (headline) + total (parenthetical)**:
  `Active Tools (external): N (T total incl. internal/seed)` and the same for developers; the npm/GitHub lines
  are already relabeled as MCP-ecosystem. Typecheck-clean.
- **Limitation (why Phase 2 exists):** a denylist FAILS OPEN — a new internal account not in the list (and not
  on an internal domain) silently re-inflates. It's also a JS filter (fetch-all-then-filter), fine at tens of
  rows but not the durable answer, and it doesn't carry to other dashboards.

## Phase 2 — persistent `developers.isInternal` flag (DO THIS NEXT DEPLOY, after V-N1 lands)
Sequence AFTER the V-N1 chunk to avoid colliding with that build's working tree/gate. Steps:

### 1. Schema (`apps/web/src/lib/db/schema.ts`, `developers` table)
Add alongside the other developer flags:
```ts
// Internal/seed/system account — excluded from growth/traction metrics.
// Backfilled + set-on-signup from lib/internal-accounts.ts (the source of truth).
isInternal: boolean('is_internal').notNull().default(false),
```
(Optionally add `index('developers_is_internal_idx').on(table.isInternal)` — low cardinality, skip unless a
metric filters hot.)

### 2. Migration
Generate with drizzle-kit (DO NOT hand-number — it auto-sequences after `0016_credited_at`):
```
cd apps/web && npx drizzle-kit generate
```
Then APPEND the one-time backfill to the generated file (or a sibling data-migration), matching
`isInternalEmail` EXACTLY:
```sql
UPDATE developers SET is_internal = true
WHERE lower(email) IN ('lexwhiting@gmail.com','lexwhiting365@gmail.com','lutherwhitingcollins@gmail.com')
   OR lower(email) LIKE '%@settlegrid.ai'
   OR lower(email) LIKE '%@settlegrid.com'
   OR lower(email) LIKE '%@alerterra.com';
```
This flags the 7 known internal accounts (3 gmails + 4 org-domain incl. `system@settlegrid.com`). **Migration
must apply BEFORE the reading code deploys** (same discipline as `0015_reconcile_watermark`).

### 3. Signup hook — set the flag on creation (fail-closed going forward)
- **Human signups — `apps/web/src/app/auth/callback/route.ts:163`** (`db.insert(developers).values({...})`): add
  `isInternal: isInternalEmail(<email>)` so future `@settlegrid.*`/`@alerterra.com` signups self-flag.
- **System/crawl account creators — set `isInternal: true`** at the three system inserts:
  `app/api/webhooks/github/scan-impl.ts:135`, `app/api/cron/crawl-registry/route.ts:87`,
  `app/api/cron/crawl-services/route.ts:86` (these mint `system@settlegrid.com`-class catalog owners).

### 4. Graduate the metric (replace the Phase-1 JS filter)
In `ecosystem-metrics/route.ts`, swap the fetch-all-then-`isInternalEmail` filter for SQL:
- developers external = `count(*) WHERE NOT is_internal`.
- active tools external = active tools joined to owner `WHERE NOT developers.is_internal`.
Keep `lib/internal-accounts.ts` as the backfill + signup source of truth (the flag is DERIVED from it). Reuse
the flag in any other dashboard/investor metric so the exclusion is consistent platform-wide.

### 5. Verify
Post-deploy: the next weekly email's external counts equal `count(*) WHERE NOT is_internal`; spot-check
`SELECT email,is_internal FROM developers ORDER BY created_at` matches `isInternalEmail` for every row.

## Open decisions (founder)
- `support@settlegrid.ai` owns `connect-test` (a real internal test tool) — flagged internal by the domain
  rule (correct; it's not external traction). Confirm OK.
- Decide whether "Unclaimed Tools (crawled catalog)" stays in this email at all, or moves to a separate
  catalog-health report (it's `system@settlegrid.com`-owned crawl output, not traction).
