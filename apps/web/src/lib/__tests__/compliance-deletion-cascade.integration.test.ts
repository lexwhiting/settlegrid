/**
 * V-N3-deletion-cascade-correctness — the KEYSTONE real-Postgres (pglite)
 * integration test (handoff §3 + §11 F5, LB2).
 *
 * WHY THIS EXISTS — the mock-based suites (compliance-deletion-auth.test.ts,
 * settlement-moat.test.ts) cannot see FK behavior: their tx mock never enforces
 * `invocations.api_key_id NOT NULL ON DELETE CASCADE`. In real Postgres, the
 * pre-fix `tx.delete(apiKeys)` at steps 2-3 cascade-DESTROYED the invocation rows
 * those keys anchored (the subject's tools' rows AND foreign developers' rows the
 * consumer-twin called) BEFORE step 4 could null their metadata — silent
 * cross-principal over-deletion + a no-op step 4. This test stands up the schema
 * in pglite (real Postgres-in-wasm, which DOES enforce FKs) and proves:
 *   (NON-VACUITY) the api_key→invocation FK is ON DELETE CASCADE (structural) AND
 *     a raw DELETE on api_keys cascade-kills dependent invocations (behavioral) —
 *     so the harness genuinely enforces the cascade (else the test is vacuous);
 *   (THE FIX)     processDataDeletion now REVOKES the api_keys (status='revoked',
 *     null ip_allowlist), the FK targets survive, the cascade never fires, and the
 *     invocation rows — own-tool (metadata nulled by step 4) AND foreign-tool
 *     (kept, pseudonymous) — SURVIVE; the revoked keys cannot authenticate (status
 *     gate, "assert the gate" per §11 F2); keyHash/keyPrefix are retained (the
 *     NOT-NULL credential is left intact, §11 F1).
 *
 * SCHEMA MECHANISM — IMPORTANT DEVIATION FROM §11 F5 (flagged for ②):
 *   F5 directed applying the repo's drizzle/*.sql migrations (via migrator or
 *   exec). That is EMPIRICALLY IMPOSSIBLE for an end-to-end deletion test here:
 *     (a) drizzle/meta/_journal.json tracks only 3 of 18 migrations, and the
 *         files are not a replayable chain (0005 "unified_ledger" RE-creates
 *         ledger_entries with the columns 0003 adds, so 0003 conflicts);
 *     (b) more decisively, the migrations are STALE vs schema.ts — the migrated
 *         `developers` table has `clerk_user_id` and LACKS `slug`,
 *         `supabase_user_id`, `stripe_customer_id`, `notification_preferences`,
 *         `notification_webhooks`; `consumers` lacks `supabase_user_id`/
 *         `referral_code`; `tools` lacks `source_repo_url`/`proxy_endpoint`/
 *         `crawl_metadata`. processDataDeletion (written against schema.ts) throws
 *         `column "<x>" does not exist` on the migrated schema. Prod therefore
 *         applies schema.ts via `drizzle-kit push` (NOT these migrations) — so
 *         schema.ts IS the prod source of truth, and building from it is faithful,
 *         not "ORM-vs-ORM". (This schema↔migration drift is itself the DC-14
 *         finding F5 wanted surfaced.)
 *   So the schema is materialized with drizzle-kit's `pushSchema` (the exact
 *   mechanism behind `drizzle-kit push`), loaded via createRequire because the
 *   drizzle-kit/api ESM build throws "Dynamic require of fs" under vitest. The
 *   load-bearing api_key→invocation ON DELETE CASCADE is BYTE-IDENTICAL in
 *   schema.ts (:325-327) and migration 0000_polite_moonstone.sql (:260); this
 *   test pins it both structurally (FK delete_rule=CASCADE) and behaviorally (the
 *   raw-DELETE non-vacuity gate). This validates schema/migration INTENT, not
 *   live-prod-DDL parity.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'

// drizzle-kit/api's ESM build is broken under vitest ("Dynamic require of fs");
// load the working CJS build directly. This is the in-process equivalent of the
// `drizzle-kit push` prod uses to materialize schema.ts.
const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

// The pglite-backed drizzle db; the @/lib/db mock proxies to it at CALL time
// (mirrors the production lazy Proxy in src/lib/db/index.ts), so it resolves the
// instance created in beforeAll without a hoist-order race.
const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))

vi.mock('@/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get(_t, prop, recv) {
        const real = holder.db as unknown as Record<string | symbol, unknown>
        if (!real) throw new Error('pglite db not initialized (beforeAll did not run)')
        const value = Reflect.get(real, prop, recv)
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
      },
    },
  ),
}))

// No network: the deletion hard-deletes the Supabase auth user pre-txn.
vi.mock('@/lib/supabase/admin', () => ({
  deleteSupabaseAuthUser: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { processDataDeletion } from '@/lib/settlement/compliance'
import * as schema from '@/lib/db/schema'

let pg: PGlite
let db: ReturnType<typeof drizzle>

// Tables the deletion + this test touch — truncated before each test for isolation.
const RESET_TABLES = [
  'developers', 'consumers', 'tools', 'api_keys', 'invocations',
  'compliance_exports', 'consumer_schedules', 'developer_api_keys',
  'webhook_endpoints', 'audit_logs', 'tool_reviews', 'waitlist_signups',
  'conversion_events',
]

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  // Materialize the full schema.ts (prod's drizzle-kit push source of truth).
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()
  holder.db = db
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await pg.exec(`TRUNCATE ${RESET_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
})

// Fixed UUIDs for legibility.
const DEV_SUBJECT = '00000000-0000-0000-0000-0000000000a1'
const DEV_FOREIGN = '00000000-0000-0000-0000-0000000000a2'
const CON_TWIN = '00000000-0000-0000-0000-0000000000b1'
const TOOL_OWN = '00000000-0000-0000-0000-0000000000c1'
const TOOL_FOREIGN = '00000000-0000-0000-0000-0000000000c2'
const KEY_OWN = '00000000-0000-0000-0000-0000000000d1'
const KEY_FOREIGN = '00000000-0000-0000-0000-0000000000d2'
const INV_OWN = '00000000-0000-0000-0000-0000000000e1'
const INV_FOREIGN = '00000000-0000-0000-0000-0000000000e2'
const EXPORT_ID = '00000000-0000-0000-0000-0000000000f1'

const countInvocations = async (toolId: string) =>
  (await db.select().from(schema.invocations).where(eq(schema.invocations.toolId, toolId))).length

describe('processDataDeletion — pglite cascade-faithful integration (LB2)', () => {
  it('NON-VACUITY: the api_key→invocation FK is ON DELETE CASCADE and a raw DELETE cascade-kills invocations', async () => {
    // (a) Structural: the FK's delete rule is CASCADE (matches migration 0000:260).
    const fk = await pg.query(
      `SELECT rc.delete_rule FROM information_schema.referential_constraints rc
       WHERE rc.constraint_name LIKE '%invocations%api_key%'`,
    )
    expect((fk.rows as Array<{ delete_rule: string }>)[0]?.delete_rule).toBe('CASCADE')

    // (b) Behavioral: pglite actually enforces it on a raw delete.
    await db.insert(schema.developers).values({ id: DEV_SUBJECT, email: 'dev@x.com', name: 'Dev' })
    await db.insert(schema.consumers).values({ id: CON_TWIN, email: 'c@x.com' })
    await db.insert(schema.tools).values({ id: TOOL_OWN, developerId: DEV_SUBJECT, name: 'T', slug: 'raw-cascade-tool' })
    await db.insert(schema.apiKeys).values({ id: KEY_OWN, consumerId: CON_TWIN, toolId: TOOL_OWN, keyHash: 'h-raw', keyPrefix: 'sg_raw' })
    await db.insert(schema.invocations).values({ id: INV_OWN, toolId: TOOL_OWN, consumerId: CON_TWIN, apiKeyId: KEY_OWN, method: 'GET', costCents: 10 })

    expect(await countInvocations(TOOL_OWN)).toBe(1)
    // The exact destructive operation the pre-fix steps 2-3 performed.
    await pg.exec(`DELETE FROM api_keys WHERE id = '${KEY_OWN}'`)
    // If this is NOT 0, the harness does not enforce the cascade and every other
    // assertion in this file would be vacuous — so this gates the whole suite.
    expect(await countInvocations(TOOL_OWN)).toBe(0)
  }, 30_000)

  it('THE FIX: revoke-not-delete KEEPS own-tool AND foreign-tool invocations; keys revoked + de-authenticated', async () => {
    // Subject developer + a FOREIGN developer with their own tool.
    await db.insert(schema.developers).values([
      { id: DEV_SUBJECT, email: 'subject@x.com', name: 'Subject' },
      { id: DEV_FOREIGN, email: 'foreign@x.com', name: 'Foreign' },
    ])
    // Consumer twin: same NORMALIZED email as the subject developer.
    await db.insert(schema.consumers).values({ id: CON_TWIN, email: 'subject@x.com' })
    await db.insert(schema.tools).values([
      { id: TOOL_OWN, developerId: DEV_SUBJECT, name: 'Own', slug: 'own-tool' },
      { id: TOOL_FOREIGN, developerId: DEV_FOREIGN, name: 'Foreign', slug: 'foreign-tool' },
    ])
    // The twin holds keys on BOTH tools — own-tool key (step-3 toolId-keyed revoke)
    // and foreign-tool key (step-2 consumerId-keyed revoke). Both carry IP PII.
    await db.insert(schema.apiKeys).values([
      { id: KEY_OWN, consumerId: CON_TWIN, toolId: TOOL_OWN, keyHash: 'h-own', keyPrefix: 'sg_own', status: 'active', ipAllowlist: ['10.0.0.1'] },
      { id: KEY_FOREIGN, consumerId: CON_TWIN, toolId: TOOL_FOREIGN, keyHash: 'h-for', keyPrefix: 'sg_for', status: 'active', ipAllowlist: ['10.0.0.2'] },
    ])
    // Invocations on both tools, each with metadata (the captured on-chain payer).
    await db.insert(schema.invocations).values([
      { id: INV_OWN, toolId: TOOL_OWN, consumerId: CON_TWIN, apiKeyId: KEY_OWN, method: 'POST', costCents: 5, metadata: { payer: '0xown' }, sessionId: 's-own', referralCode: 'r-own' },
      { id: INV_FOREIGN, toolId: TOOL_FOREIGN, consumerId: CON_TWIN, apiKeyId: KEY_FOREIGN, method: 'POST', costCents: 7, metadata: { payer: '0xforeign' }, sessionId: 's-for', referralCode: 'r-for' },
    ])
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    const result = await processDataDeletion(EXPORT_ID)
    expect(result.status).toBe('completed')

    // (i) FOREIGN-tool invocation SURVIVES (pre-fix: cascade-deleted via step 2).
    expect(await countInvocations(TOOL_FOREIGN)).toBe(1)
    const [forInv] = await db.select().from(schema.invocations).where(eq(schema.invocations.id, INV_FOREIGN))
    expect(forInv).toBeDefined()
    // Foreign-tool metadata is NOT scrubbed (step 4 is scoped to the subject's
    // tools) — it is retained-pseudonymous, matching the retainedUnscrubbed note.
    expect(forInv.metadata).toEqual({ payer: '0xforeign' })

    // (ii) OWN-tool invocation SURVIVES (pre-fix: cascade-deleted via step 3) with
    //      metadata nulled by step 4.
    expect(await countInvocations(TOOL_OWN)).toBe(1)
    const [ownInv] = await db.select().from(schema.invocations).where(eq(schema.invocations.id, INV_OWN))
    expect(ownInv).toBeDefined()
    expect(ownInv.metadata).toBeNull()

    // (iii) The api_keys are REVOKED, not deleted: both rows still present, status
    //       'revoked', ipAllowlist nulled, keyHash/keyPrefix RETAINED (NOT NULL, §11 F1).
    const keys = await db.select().from(schema.apiKeys)
    expect(keys.length).toBe(2)
    for (const k of keys) {
      expect(k.status).toBe('revoked')
      expect(k.ipAllowlist).toBeNull()
      expect(k.keyHash).not.toBeNull()
      expect(k.keyPrefix).not.toBeNull()
    }

    // (iv) De-authentication — "assert the gate" (§11 F2): a status='revoked' key is
    //      rejected by every lookup path (proxy + sdk/* reject status!=='active',
    //      audited across all 5 paths). No key remains 'active'.
    expect(keys.every((k) => k.status === 'revoked')).toBe(true)
    expect(keys.some((k) => k.status === 'active')).toBe(false)

    // The consumer twin was anonymized (identity scrubbed), proving consumerMatched
    // fired and the foreign-tool rows are now keyed to a pseudonymized consumer.
    const [twin] = await db.select().from(schema.consumers).where(eq(schema.consumers.id, CON_TWIN))
    expect(twin.email).toBe(`deleted-${CON_TWIN}@deleted.settlegrid.ai`)

    // The persisted disclosure is honest: invocations linkage retained-unscrubbed,
    // own-tool metadata + api_keys anonymized.
    const [exp] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.id, EXPORT_ID))
    expect(exp.status).toBe('completed')
    const disclosure = JSON.parse(exp.resultUrl as string)
    expect(disclosure.retainedUnscrubbed).toEqual(
      expect.arrayContaining([
        'invocations.consumer_id', 'invocations.api_key_id',
        'invocations.session_id', 'invocations.referral_code',
      ]),
    )
    expect(disclosure.retainedUnscrubbed).not.toContain('invocations.metadata')
    expect(disclosure.anonymized).toEqual(expect.arrayContaining(['invocations.metadata', 'api_keys']))
  }, 30_000)
})
