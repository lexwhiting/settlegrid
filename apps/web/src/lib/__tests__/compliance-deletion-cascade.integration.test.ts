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
// ③ deep-audit additions: a THIRD-PARTY (non-twin) consumer + its key/invocation on
// the subject's OWN tool — to make step 3 (toolId-keyed) independently load-bearing.
const CON_OTHER = '00000000-0000-0000-0000-0000000000b2'
const KEY_OTHER = '00000000-0000-0000-0000-0000000000d3'
const INV_OTHER = '00000000-0000-0000-0000-0000000000e3'
// V-N3-deletion-wiring (F-B1 §13.6): a SECOND developer pre-seeded with the
// deleted-<subject> sentinel email, so step 1's anonymize trips developers.email
// UNIQUE → whole-scrub-txn rollback → the FAILURE mode that makes the pre-commit's
// independent commit observable.
const DEV_COLLIDER = '00000000-0000-0000-0000-0000000000a3'

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

  it('STEP 3 IS LOAD-BEARING: a NON-TWIN consumer key on the subject\'s OWN tool is revoked ONLY by the toolId-keyed step 3', async () => {
    // ③ deep-audit (F-A1, collective-miss critic): the original "THE FIX" fixture gave
    // the consumer TWIN both keys, so step 2 (consumerId-keyed) revoked the own-tool key
    // too and step 3 was REDUNDANT — neutering step 3 left that test GREEN. The
    // production-dominant shape is a THIRD-PARTY consumer's key on the SUBJECT'S OWN
    // tool: reached ONLY by step 3 (toolId-keyed), never step 2. Here the subject has NO
    // twin (distinct email), so step 2 does not run at all and step 3 is the SOLE
    // de-authentication / cascade-protection for this key. Neuter or remove step 3 ⇒ the
    // key stays 'active' (and revert-to-delete cascade-kills its invocation) ⇒ RED.
    await db.insert(schema.developers).values({ id: DEV_SUBJECT, email: 'subject@x.com', name: 'Subject' })
    // A real third-party consumer — DISTINCT email ⇒ NOT a twin of the subject developer.
    await db.insert(schema.consumers).values({ id: CON_OTHER, email: 'third-party@x.com' })
    await db.insert(schema.tools).values({ id: TOOL_OWN, developerId: DEV_SUBJECT, name: 'Own', slug: 'own-tool-s3' })
    // The third party's live key on the SUBJECT'S tool (consumerId=CON_OTHER, NOT the subject).
    await db.insert(schema.apiKeys).values({
      id: KEY_OTHER, consumerId: CON_OTHER, toolId: TOOL_OWN,
      keyHash: 'h-s3', keyPrefix: 'sg_s3', status: 'active', ipAllowlist: ['10.0.0.9'],
    })
    await db.insert(schema.invocations).values({
      id: INV_OTHER, toolId: TOOL_OWN, consumerId: CON_OTHER, apiKeyId: KEY_OTHER,
      method: 'POST', costCents: 9, metadata: { payer: '0xthird' },
    })
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    const result = await processDataDeletion(EXPORT_ID)
    expect(result.status).toBe('completed')

    // No twin ⇒ step 2 did NOT run; this key was revoked ONLY by step 3 (toolId-keyed).
    const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, KEY_OTHER))
    expect(key.status).toBe('revoked') // ⇐ neuter/remove step 3 ⇒ stays 'active' ⇒ RED
    expect(key.ipAllowlist).toBeNull()
    expect(key.keyHash).not.toBeNull()

    // The third party's invocation on the subject's tool SURVIVES (revoke-not-delete);
    // revert step 3 → tx.delete(apiKeys) ⇒ this row is cascade-killed ⇒ RED.
    expect(await countInvocations(TOOL_OWN)).toBe(1)
    const [inv] = await db.select().from(schema.invocations).where(eq(schema.invocations.id, INV_OTHER))
    expect(inv).toBeDefined()
    expect(inv.metadata).toBeNull() // step 4 nulls own-tool metadata
  }, 30_000)

  it('NO-TWIN DISCLOSURE (F1): the persisted note OMITS the foreign-tool-retention clause when there is no consumer twin', async () => {
    // ③ deep-audit (F1): the foreign-tool-invocation clause asserts a step-2
    // pseudonymization + twin-keyed foreign-tool rows. For a subject with NO consumer
    // twin, step 2 never runs and no such rows exist, so the clause is a FALSE PARTICULAR
    // and must NOT appear in the persisted note. The unconditional org + ledger-payer
    // posture MUST remain. (Runtime counterpart to the source-text pins in
    // compliance-honesty-regression.test.ts, which cannot see this branch selection.)
    await db.insert(schema.developers).values({ id: DEV_SUBJECT, email: 'lonely@x.com', name: 'Lonely' })
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    const result = await processDataDeletion(EXPORT_ID)
    expect(result.status).toBe('completed')

    const [exp] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.id, EXPORT_ID))
    const disclosure = JSON.parse(exp.resultUrl as string)
    const note: string = disclosure.retainedUnscrubbedNote
    // The foreign-tool clause (and its false step-2 pseudonymization claim) is ABSENT.
    expect(note).not.toMatch(/Invocation rows on other developers' tools/)
    expect(note).not.toMatch(/pseudonymi[sz]e/i)
    // The unconditional org + ledger-payer posture is PRESERVED.
    expect(note).toMatch(/organizations\.billing_email/)
    expect(note).toMatch(/The fields above retain the anonymous on-chain payer's EVM address/)
    // No twin ⇒ no twin-keyed invocation linkage paths disclosed in the array either.
    expect(disclosure.retainedUnscrubbed).not.toContain('invocations.consumer_id')
  }, 30_000)

  it('F-B1 PRE-COMMIT IS LOAD-BEARING: on a FORCED scrub-txn ROLLBACK, api_keys stay REVOKED + tools stay DELETED (the deactivation committed independently)', async () => {
    // ① handoff §13.6 — the NON-VACUITY construction. On the SUCCESS path the
    // pre-commit revoke and the in-txn revoke yield an IDENTICAL end state, and the
    // single-connection pglite harness cannot observe mid-txn ordering, so "remove
    // the pre-commit → RED" stays GREEN on success. Force the scrub txn to ROLL BACK
    // so the pre-commit's INDEPENDENT commit becomes observable: pre-seed a SECOND
    // developer whose email is ALREADY the deleted-<subject> sentinel, so step 1's
    // anonymize (developers.email = deleted-<id>@…) trips the developers.email UNIQUE
    // → the whole scrub txn rolls back → processDataDeletion catches → returns
    // {status:'failed'} (no re-throw). The pre-commit ran in its OWN earlier txn, so
    // its writes SURVIVE the rollback.
    //   MUTATION (proves non-vacuity): delete the pre-commit block in compliance.ts →
    //   the key/tool are revoked/deleted ONLY inside the scrub txn → the rollback
    //   reverts them → key 'active' + tool 'active' → the two assertions below go RED.
    await db.insert(schema.developers).values([
      { id: DEV_SUBJECT, email: 'subject@x.com', name: 'Subject' },
      // The collider: its email is the exact value step 1 will try to write.
      { id: DEV_COLLIDER, email: `deleted-${DEV_SUBJECT}@deleted.settlegrid.ai`, name: 'Collider' },
    ])
    // A third-party consumer holds an ACTIVE key on the SUBJECT'S own tool — revoked
    // ONLY via the toolId gate (the subject has no twin, so step 2 never runs); this
    // exercises BOTH pre-commit writes (api_keys revoke + tools.status='deleted').
    await db.insert(schema.consumers).values({ id: CON_OTHER, email: 'third-party@x.com' })
    await db.insert(schema.tools).values({ id: TOOL_OWN, developerId: DEV_SUBJECT, name: 'Own', slug: 'own-rollback' })
    await db.insert(schema.apiKeys).values({
      id: KEY_OTHER, consumerId: CON_OTHER, toolId: TOOL_OWN,
      keyHash: 'h-rb', keyPrefix: 'sg_rb', status: 'active', ipAllowlist: ['10.0.0.7'],
    })
    await db.insert(schema.invocations).values({
      id: INV_OTHER, toolId: TOOL_OWN, consumerId: CON_OTHER, apiKeyId: KEY_OTHER,
      method: 'POST', costCents: 4, metadata: { payer: '0xrb' },
    })
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    // Step 1's UNIQUE collision rolls the scrub txn back → catch → 'failed'.
    const result = await processDataDeletion(EXPORT_ID)
    expect(result.status).toBe('failed')

    // The compliance row reflects the failure (retryable record of record).
    const [exp] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.id, EXPORT_ID))
    expect(exp.status).toBe('failed')

    // The scrub GENUINELY rolled back: the developer is NOT anonymized (step 1 reverted).
    const [dev] = await db.select().from(schema.developers).where(eq(schema.developers.id, DEV_SUBJECT))
    expect(dev.email).toBe('subject@x.com')

    // ⇐ THE LOAD-BEARING ASSERTIONS: the pre-commit committed BEFORE (and independent
    //   of) the rolled-back scrub, so the deactivation SURVIVES the failure.
    const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, KEY_OTHER))
    expect(key.status).toBe('revoked') // ← remove pre-commit ⇒ 'active' ⇒ RED
    expect(key.ipAllowlist).toBeNull()
    const [tool] = await db.select().from(schema.tools).where(eq(schema.tools.id, TOOL_OWN))
    expect(tool.status).toBe('deleted') // ← remove pre-commit ⇒ 'active' ⇒ RED

    // revoke-not-delete holds even on the failure path: the FK target survives, so
    // the invocation is NOT cascade-killed (a failed deletion leaves the account
    // DEACTIVATED, not partially destroyed).
    expect(await countInvocations(TOOL_OWN)).toBe(1)
    expect(key.keyHash).not.toBeNull()
  }, 30_000)

  it('RE-RUN ON ALREADY-ERASED DEV (③ primary, DC-13/DC-16/DC-17): a 2nd deletion row for an already-anonymized developer COPIES the authoritative disclosure — it does NOT recompute a DEGRADED resultUrl that under-discloses retained personal data', async () => {
    // ③ deep-audit PRIMARY TARGET. processDataDeletion recomputes consumerMatched/
    // deletedAuthUser from the LIVE developer row every call. A re-run that observes an
    // ALREADY-anonymized dev (the cron re-driving a leftover failed/stale row after a
    // retry's row already completed the scrub) matches ZERO consumers → consumerMatched=
    // false → the persisted resultUrl OMITS the consumerMatched-gated retainedUnscrubbed
    // foreign-tool linkage (invocations.consumer_id/api_key_id/session_id/referral_code)
    // that GENUINELY persists (revoke-not-delete keeps those rows) → an under-disclosing
    // record-of-processing. The already-erased guard must instead COPY the authoritative
    // disclosure the run that actually erased the dev wrote (earliest data-deletion sibling).
    //   MUTATION (proves non-vacuity): remove the already-erased guard in compliance.ts →
    //   run #2 recomputes degraded → BOTH load-bearing assertions below go RED.
    await db.insert(schema.developers).values([
      { id: DEV_SUBJECT, email: 'subject@x.com', name: 'Subject' },
      { id: DEV_FOREIGN, email: 'foreign@x.com', name: 'Foreign' },
    ])
    // A consumer twin (same normalized email) + a foreign-tool invocation the twin called.
    await db.insert(schema.consumers).values({ id: CON_TWIN, email: 'subject@x.com' })
    await db.insert(schema.tools).values([
      { id: TOOL_OWN, developerId: DEV_SUBJECT, name: 'Own', slug: 'rerun-own' },
      { id: TOOL_FOREIGN, developerId: DEV_FOREIGN, name: 'Foreign', slug: 'rerun-foreign' },
    ])
    await db.insert(schema.apiKeys).values({
      id: KEY_FOREIGN, consumerId: CON_TWIN, toolId: TOOL_FOREIGN,
      keyHash: 'h-rr', keyPrefix: 'sg_rr', status: 'active', ipAllowlist: ['10.0.0.5'],
    })
    await db.insert(schema.invocations).values({
      id: INV_FOREIGN, toolId: TOOL_FOREIGN, consumerId: CON_TWIN, apiKeyId: KEY_FOREIGN,
      method: 'POST', costCents: 7, metadata: { payer: '0xrr' }, sessionId: 's-rr', referralCode: 'r-rr',
    })
    // Export row #1 — the run that ACTUALLY erases the developer (dev still live).
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    const r1 = await processDataDeletion(EXPORT_ID)
    expect(r1.status).toBe('completed')
    const [exp1] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.id, EXPORT_ID))
    const d1 = JSON.parse(exp1.resultUrl as string)
    // Run #1 is authoritative: it discloses the retained foreign-tool linkage.
    expect(d1.retainedUnscrubbed).toContain('invocations.consumer_id')

    // The dev is now anonymized; the foreign-tool invocation row STILL persists (pseudonymous).
    const [devAfter] = await db.select().from(schema.developers).where(eq(schema.developers.id, DEV_SUBJECT))
    expect(devAfter.email).toBe(`deleted-${DEV_SUBJECT}@deleted.settlegrid.ai`)
    expect(await countInvocations(TOOL_FOREIGN)).toBe(1)

    // Export row #2 — a SECOND deletion row for the SAME (now anonymized) developer,
    // exactly as the cron recovery re-driver creates/re-drives after a failed sibling.
    const EXPORT_ID_2 = '00000000-0000-0000-0000-0000000000f2'
    await db.insert(schema.complianceExports).values({
      id: EXPORT_ID_2, requestType: 'data-deletion', entityType: 'provider', entityId: DEV_SUBJECT, status: 'pending',
    })

    const r2 = await processDataDeletion(EXPORT_ID_2)
    expect(r2.status).toBe('completed')
    const [exp2] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.id, EXPORT_ID_2))
    const d2 = JSON.parse(exp2.resultUrl as string)

    // ⇐ THE LOAD-BEARING ASSERTIONS: run #2 must NOT under-disclose. It copies the
    //   authoritative disclosure rather than recomputing a degraded one.
    expect(d2.retainedUnscrubbed).toContain('invocations.consumer_id') // ← no guard ⇒ omitted ⇒ RED
    expect(d2).toEqual(d1)                                             // exact authoritative copy

    // Cross-isolation sanity: a data-EXPORT row for the same dev must NEVER be the
    // copied sibling (its resultUrl is a base64 PII blob — critic JOB-B amendment 1).
    expect(typeof exp2.resultUrl).toBe('string')
    expect(exp2.resultUrl as string).not.toMatch(/^data:application\/json;base64,/)
  }, 30_000)
})
