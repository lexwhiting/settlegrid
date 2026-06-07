-- Bootstrap drizzle.__drizzle_migrations for migrations 0000-0013 that
-- have already been applied to prod manually via the Supabase SQL Editor.
--
-- WHY this exists:
--   drizzle-kit migrate works by reading apps/web/drizzle/meta/_journal.json
--   and, for each entry, checking whether MAX(created_at) in
--   drizzle.__drizzle_migrations is greater than the migration's folderMillis.
--   The table is currently empty in prod (drizzle-kit migrate was never run),
--   so any future invocation would try to re-apply 0000/0001/0008 (the three
--   migrations currently in the journal) and fail with "relation already exists".
--
-- WHAT this does:
--   Creates the drizzle schema + __drizzle_migrations table (no-op if present)
--   and inserts one row per applied migration. Idempotent — re-running is safe
--   because each insert is guarded by WHERE NOT EXISTS on its hash.
--
-- HASH derivation:
--   sha256(<file content>) hex-encoded — same algorithm drizzle-orm migrator
--   uses internally (crypto.createHash('sha256').update(fs.readFileSync(path))).
--   Verifiable with: shasum -a 256 apps/web/drizzle/<file>.sql
--
-- created_at:
--   For migrations present in _journal.json (0000, 0001, 0008) the `when`
--   value from the journal is used — this matches what drizzle-orm would have
--   inserted if drizzle-kit migrate had originally been run.
--   For migrations not in the journal (0002-0007, 0009-0013, hand-written and
--   applied via the SQL Editor), the file mtime in epoch ms is used.
--   Note: only MAX(created_at) is consulted by drizzle-kit migrate's skip
--   logic; per-row ordering of older entries is not consulted.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- 0000_polite_moonstone  (journal idx 0)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'ec93d07a56443c20c180f97050b61bf5549e3dae09be250b630b89050e9cc3d9', 1773459112883
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'ec93d07a56443c20c180f97050b61bf5549e3dae09be250b630b89050e9cc3d9');

-- 0001_listed_in_marketplace  (journal idx 1)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '861e077e4b2256bf43f0d155331a22fc97159e69000d024cbac79007db142938', 1776513600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '861e077e4b2256bf43f0d155331a22fc97159e69000d024cbac79007db142938');

-- 0002_mcp_shadow_index  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '5e214517884175d57e137d02f9ea71bc93d7169285c6e16a5936a2e5833dcf26', 1776342716598
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '5e214517884175d57e137d02f9ea71bc93d7169285c6e16a5936a2e5833dcf26');

-- 0003_ledger_tax_columns  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '1eea762672cdcd36cf7df1b97fea3d22056c85a553bf7c3a9c20f0229237dff3', 1777578750041
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '1eea762672cdcd36cf7df1b97fea3d22056c85a553bf7c3a9c20f0229237dff3');

-- 0004_processed_webhook_events  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '976decb10c83d684cdb7c43f962213a802fd9d5ac934c0ce8187fc28cf0d2b20', 1777578750041
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '976decb10c83d684cdb7c43f962213a802fd9d5ac934c0ce8187fc28cf0d2b20');

-- 0005_unified_ledger  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'e8b8215aefb72accf92d2e47b48891fd858c679b40d8a7b06b7383593f65031a', 1777578750042
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'e8b8215aefb72accf92d2e47b48891fd858c679b40d8a7b06b7383593f65031a');

-- 0006_ledger_authorization_fields  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '79ddd91916d3863f9ef2f84c0a36ec24b8d97e8b26e2ce166d02acaf3293c804', 1777578750042
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '79ddd91916d3863f9ef2f84c0a36ec24b8d97e8b26e2ce166d02acaf3293c804');

-- 0007_chargeback_alerts  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '837a8567bd537cfb0dc053a0d1b9770880e4eb85d5b584727da4aa164c29cbe1', 1777578750042
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '837a8567bd537cfb0dc053a0d1b9770880e4eb85d5b584727da4aa164c29cbe1');

-- 0008_premium_template_columns  (journal idx 8)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'ddf78075d9c2f8787b82f717363601fc63d3315be3b76c48d2e5c6447146bebf', 1777737600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'ddf78075d9c2f8787b82f717363601fc63d3315be3b76c48d2e5c6447146bebf');

-- 0009_payouts_one_processing_per_dev  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'fe08e345f42d5905a37255dfe248154f987534664de052d299c6d34775b138ff', 1778079736413
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'fe08e345f42d5905a37255dfe248154f987534664de052d299c6d34775b138ff');

-- 0010_payouts_index_includes_unknown  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'a706596205d7ce8998e82f2db97ae5026fcd0d5285b180b87be99a16cc9cc859', 1778093909338
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'a706596205d7ce8998e82f2db97ae5026fcd0d5285b180b87be99a16cc9cc859');

-- 0011_payout_minimum_default_25  (hand-written, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '92b38cd551c52be880bf151be0458bd99f1f949ef2a36dc7eff7439b1c03114f', 1778160908973
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '92b38cd551c52be880bf151be0458bd99f1f949ef2a36dc7eff7439b1c03114f');

-- 0012_kernel_telemetry  (journal idx 12 missing — added manually 2026-05-15, not in journal)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '3252f1e36f114cf26ea8417657d90a3257ea10afd56ddff6b556a39a4d1543c2', 1778432670441
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '3252f1e36f114cf26ea8417657d90a3257ea10afd56ddff6b556a39a4d1543c2');

-- 0013_developer_api_keys  (hand-written, not in journal; ships 2026-05-28 — apply the .sql via SQL Editor alongside seeding this row)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'dabd3540ed03fff9bc3f90ef12747b5b7e25597ef831d7f96b17654996b7732a', 1779993698000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'dabd3540ed03fff9bc3f90ef12747b5b7e25597ef831d7f96b17654996b7732a');

-- 0014_drop_revenue_share_pct  (hand-written, not in journal; ships with (C) 2026-06-07 — apply the .sql via SQL Editor alongside seeding this row, AFTER the (C) bundle deploys)
INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT 'e720ecaacc420f2c5d4af891d096d23788a6ad68f279f331e87c2a9d29bf43df', 1780790400000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'e720ecaacc420f2c5d4af891d096d23788a6ad68f279f331e87c2a9d29bf43df');

COMMIT;

-- POST-RUN VERIFICATION (run separately after the bootstrap):
--   SELECT id, substr(hash, 1, 12) AS hash_prefix, created_at
--   FROM "drizzle"."__drizzle_migrations"
--   ORDER BY created_at;
--
-- Expected: 15 rows. MAX(created_at) = 1780790400000 (0014_drop_revenue_share_pct).
-- All three journal folderMillis (1773459112883, 1776513600000, 1777737600000)
-- are < MAX, so drizzle-kit migrate will correctly skip them.
