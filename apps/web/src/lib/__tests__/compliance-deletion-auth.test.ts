/**
 * V-N3 compliance-honesty SLICE 2 — BEHAVIORAL guards for the Supabase
 * auth-user deletion wired into processDataDeletion (the LB-1 ordering +
 * idempotency + fail-closed semantics).
 *
 * (The deleteSupabaseAuthUser admin client itself is unit-tested separately in
 * supabase-admin.test.ts — that file needs the REAL admin.ts, this one MOCKS it,
 * so they cannot share a file.)
 *
 * Harness: a full mock db (a transaction(cb) that runs cb against a tx mock) +
 * a mocked @/lib/supabase/admin, asserting LB-1:
 *   - deleteSupabaseAuthUser is called with the captured supabaseUserId and the
 *     deletion reaches 'completed' (the idempotent path resolves → still completes);
 *   - it is NOT called when the developer has no linked Supabase auth user;
 *   - a thrown auth-delete (fail-closed / admin error) → status 'failed' and
 *     'completed' is NEVER written (the throw happens BEFORE the txn commits
 *     completion). This is the forbidden-state guard from handoff §2 LB-1(a).
 *
 * NON-VACUITY: reverting the pre-txn auth-delete wiring turns this RED
 * (called-with-id + fail-closed-no-completed both fail).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDb, mockAuthDelete, selectQueue, selectCalls, updateCalls, updatePreds, deleteCalls, waitlistRowsRef,
} = vi.hoisted(() => {
    const selectQueue: unknown[][] = []
    // V-N3 SLICE 5: record every db.select()'s .where()/.orderBy() predicate so a
    // test can pin the consumer-twin lookup's NORMALIZED predicate (the all-rows
    // capture is now ONE pre-txn db.select — the in-txn re-select is GONE). The
    // DC-05 pin asserts the operator/function TEXT (lower(trim(…))=…), not just the
    // bound value; the lookup carries NO ORDER BY / NO LIMIT anymore.
    const selectCalls: Array<{ where?: unknown; orderBy?: unknown }> = []
    const updateCalls: Array<Record<string, unknown>> = []
    // V-N3 SLICE 3 RECOVERY (F-1): record every tx.update().set(vals).where(pred)
    // as a {vals, pred} PAIR so a test can pin the step-5 audit-scrub PREDICATE(s)
    // (the prior rig discarded the .where() predicate — handoff F-1 point 4). vals
    // is the SAME object reference pushed to updateCalls, so the two correlate.
    const updatePreds: Array<{ vals: Record<string, unknown> | undefined; pred: unknown }> = []
    // V-N3 SLICE 3: record every tx.delete(table).where(pred) so a test can pin
    // the waitlist DELETE *target/predicate* (the prior rig discarded delete args).
    const deleteCalls: Array<{ table: unknown; pred: unknown }> = []
    // V-N3 SLICE 3: rows the waitlist DELETE's .returning() yields — configurable
    // per-seed so a test can drive deletedWaitlist true/false (the disclosure gate).
    const waitlistRowsRef: { rows: unknown[] } = { rows: [] }
    const mockAuthDelete = vi.fn()

    // A select builder whose terminal (.limit / awaited) resolves the next queued
    // result. Supports both `.limit(1)` (dev/consumer lookups) and a bare-awaited
    // chain (the toolIds query: select().from().where()).
    function makeSelectBuilder(queue: unknown[][]) {
      const result = queue.shift() ?? []
      const rec: { where?: unknown; orderBy?: unknown } = {}
      const builder: Record<string, unknown> = {
        from: () => builder,
        where: (pred: unknown) => { rec.where = pred; return builder },
        // V-N3 SLICE 5: the consumer capture no longer uses .orderBy() (the all-rows
        // set has no byte-exact-first tie-break), but the method is kept so any
        // surviving .orderBy() (e.g. a regression re-adding ORDER BY) is recorded
        // and the rewritten determinism test can assert its ABSENCE.
        orderBy: (ord: unknown) => { rec.orderBy = ord; return builder },
        limit: () => { selectCalls.push(rec); return Promise.resolve(result) },
        // toolIds query awaits select().from().where() directly (no .limit):
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          selectCalls.push(rec)
          return Promise.resolve(result).then(onF, onR)
        },
      }
      return builder
    }

    const tx = {
      // V-N3 SLICE 3 RECOVERY (F-1): update() returns a FRESH per-call chain that
      // captures this update's .set(vals) AND its .where(pred) together, so the
      // step-5/5b/5c audit scrubs can be told apart by predicate (developerId vs
      // consumerId vs the cross-principal resourceType/resourceId clause). vals is
      // still pushed to updateCalls (existing .set-only assertions keep working).
      update: () => {
        let capturedVals: Record<string, unknown> | undefined
        const chain: Record<string, unknown> = {
          set: (vals: Record<string, unknown>) => {
            capturedVals = vals
            updateCalls.push(vals)
            return chain
          },
          // terminal for update().set().where()
          where: (pred: unknown) => {
            updatePreds.push({ vals: capturedVals, pred })
            return Promise.resolve(undefined)
          },
        }
        return chain
      },
      // delete(table).where(pred) records the target; the returned object is BOTH
      // awaitable (thenable → undefined, for the step-1b/6 deletes which await
      // .where() directly) AND has .returning() (the waitlist DELETE, step 2b →
      // the configured rows). delete() returns a fresh builder (NOT tx) so this
      // .where() never shadows the update-chain's tx.where above.
      delete: (table: unknown) => ({
        where: (pred: unknown) => {
          deleteCalls.push({ table, pred })
          return {
            returning: () => Promise.resolve(waitlistRowsRef.rows),
            then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
              Promise.resolve(undefined).then(onF, onR),
          }
        },
      }),
      // V-N3 SLICE 5: the in-txn consumer re-select is GONE — the consumer `ids`
      // flow from the ONE pre-txn capture and are reused in-txn via inArray, so the
      // txn never calls tx.select(). (Removed to keep the rig honest to the source.)
    } as Record<string, unknown>

    const mockDb = {
      select: () => makeSelectBuilder(selectQueue),
      update: () => mockDb,
      set: (vals: Record<string, unknown>) => {
        updateCalls.push(vals)
        return mockDb
      },
      where: () => Promise.resolve(undefined),
      transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    } as Record<string, unknown>

    return { mockDb, mockAuthDelete, selectQueue, selectCalls, updateCalls, updatePreds, deleteCalls, waitlistRowsRef }
  })

vi.mock('@/lib/db', () => ({ db: mockDb }))

// Schema tables are opaque stubs — drizzle helpers are stubbed too, so the
// objects only need to exist for column references.
vi.mock('@/lib/db/schema', () => {
  const tbl = (cols: string[]) =>
    Object.fromEntries(cols.map((c) => [c, c])) as Record<string, string>
  return {
    complianceExports: tbl(['id', 'status', 'resultUrl', 'completedAt', 'requestType', 'entityType', 'entityId']),
    developers: tbl(['id', 'email', 'supabaseUserId', 'name', 'publicBio', 'avatarUrl', 'passwordHash', 'slug', 'stripeConnectId', 'stripeCustomerId', 'stripeSubscriptionId', 'notificationPreferences', 'publicProfile', 'updatedAt']),
    consumers: tbl(['id', 'email', 'supabaseUserId', 'passwordHash']),
    tools: tbl(['id', 'developerId', 'status', 'description', 'healthEndpoint', 'updatedAt', 'createdAt']),
    invocations: tbl(['id', 'toolId', 'metadata']),
    // V-N3-deletion-cascade: steps 2/3 now REVOKE the twin's / the tools' api_keys
    // (status='revoked', ipAllowlist=null) instead of deleting them (a DELETE would
    // cascade-kill invocations.api_key_id rows). Keep toolId/consumerId for the
    // .where() echo and add status/ipAllowlist so the revoke .set() vals are
    // capturable (§11 F6).
    apiKeys: tbl(['id', 'toolId', 'consumerId', 'status', 'ipAllowlist']),
    developerApiKeys: tbl(['id', 'developerId']),
    payouts: tbl(['id', 'developerId']),
    webhookEndpoints: tbl(['id', 'developerId']),
    referrals: tbl(['id', 'referrerId']),
    // V-N3 SLICE 3 RECOVERY (F-1): step 5b/5c key on consumerId + resourceType/
    // resourceId; the mocked eq/inArray echo the column NAME, so these must map to
    // their own names for the predicate pins to read them.
    auditLogs: tbl(['id', 'developerId', 'consumerId', 'resourceType', 'resourceId', 'details', 'ipAddress', 'userAgent']),
    // V-N3 SLICE 3 RECOVERY (F-2): step 7b nulls developerResponse/
    // developerRespondedAt keyed on toolId ∈ toolIds.
    toolReviews: tbl(['id', 'toolId', 'consumerId', 'comment', 'developerResponse', 'developerRespondedAt']),
    // V-N3 SLICE 3: the deletion now imports + deletes waitlist_signups. Without
    // this stub, waitlistSignups.email/.id dereference undefined → TypeError →
    // the run goes 'failed' → previously-GREEN tests turn RED.
    waitlistSignups: tbl(['id', 'email']),
    // V-N3 SLICE 4: step-2 also deletes the consumer twin's cron schedules and
    // nulls conversion_events.metadata (both consumerId-keyed). Stub them or the
    // column refs dereference undefined → 'failed' → tests RED.
    consumerSchedules: tbl(['id', 'consumerId']),
    conversionEvents: tbl(['id', 'consumerId', 'metadata']),
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...xs: unknown[]) => ({ and: xs }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
  desc: (x: unknown) => ({ desc: x }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
  // V-N3 SLICE 3: the waitlist DELETE keys on sql`lower(${email}) = ${normalized}`.
  // Capture the template's interpolated values so a test can pin the NORMALIZED
  // (lowercased+trimmed) dev email — distinguishing it from a raw-case match.
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: { strings: Array.from(strings), values },
    }),
    { raw: () => ({}) },
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/supabase/admin', () => ({
  deleteSupabaseAuthUser: mockAuthDelete,
}))

import { processDataDeletion } from '@/lib/settlement/compliance'
// V-N3 SLICE 4: these resolve to the SAME mocked table objects compliance.ts
// receives (vi.mock returns one module instance), so a delete assertion can key on
// table identity. V-N3-deletion-cascade: api_keys is now REVOKED (an update), not
// deleted, so `apiKeys` is used here to assert the ABSENCE of any api_keys DELETE
// (cascade safety); `consumerSchedules` still distinguishes its consumerId-keyed
// DELETE (identical eq/inArray predicate across tables in the mock) by identity.
import { apiKeys, consumerSchedules } from '@/lib/db/schema'

/**
 * Seed the db mock for one processDataDeletion run.
 *   selectQueue order: [record lookup, dev lookup, consumer(pre-txn) CAPTURE, toolIds]
 *
 * V-N3 SLICE 5: there is now ONE pre-txn consumer CAPTURE (db.select, bare-awaited)
 * returning the SET of all matching `{id, supabaseUserId}` rows — it drives BOTH
 * the auth-delete AND every in-txn consumer scrub (reused via inArray). The in-txn
 * consumer re-select is GONE (no more txSelectQueue). Seed the set via:
 *   - `consumerRows`: the explicit `{id, supabaseUserId}[]` set (multi-row tests);
 *   - legacy `consumerInTxn` / `consumerSupabaseUserId`: translated to a single
 *     `{id:'cons-1', supabaseUserId: consumerSupabaseUserId ?? null}` row.
 * When the dev email normalizes to '' the source SKIPS the consumer SELECT (F-4
 * guard) → only THREE db.select() calls fire; the queue is seeded to match so
 * toolIds does not shift into the (skipped) capture's slot.
 */
function seed(opts: {
  devSupabaseUserId: string | null
  consumerSupabaseUserId?: string | null
  consumerInTxn?: boolean
  consumerRows?: Array<{ id?: string; supabaseUserId?: string | null }>
  email?: string
  toolIds?: unknown[]
  waitlistRows?: unknown[]
}) {
  selectQueue.length = 0
  selectCalls.length = 0
  updateCalls.length = 0
  updatePreds.length = 0
  deleteCalls.length = 0
  waitlistRowsRef.rows = opts.waitlistRows ?? []

  const email = opts.email ?? 'd@x.com'
  const norm = email.toLowerCase().trim()

  const record = [{
    id: 'exp-1', status: 'pending', requestType: 'data-deletion',
    entityType: 'provider', entityId: 'dev-1', resultUrl: null,
  }]
  const dev = [{ id: 'dev-1', email, supabaseUserId: opts.devSupabaseUserId }]

  const consumerSet: Array<{ id?: string; supabaseUserId?: string | null }> =
    opts.consumerRows ??
    (opts.consumerInTxn || opts.consumerSupabaseUserId !== undefined
      ? [{ id: 'cons-1', supabaseUserId: opts.consumerSupabaseUserId ?? null }]
      : [])

  const toolIds: unknown[] = opts.toolIds ?? [] // default: no tools (minimal branches)

  // Mirror the source's control flow: norm==='' → the consumer CAPTURE is skipped.
  if (norm === '') {
    selectQueue.push(record, dev, toolIds)
  } else {
    selectQueue.push(record, dev, consumerSet, toolIds)
  }
}

const wroteCompleted = () => updateCalls.some((c) => c.status === 'completed')
const wroteFailed = () => updateCalls.some((c) => c.status === 'failed')

// Parse the persisted step-9 resultUrl from the captured `completed` update so a
// test can assert the RUNTIME-gated disclosure (the source-text pins live in
// compliance-honesty-regression.test.ts; these prove the gating actually fires).
function completedResultUrl(): Record<string, unknown> | null {
  const completed = updateCalls.find(
    (c) => c.status === 'completed' && typeof c.resultUrl === 'string',
  )
  return completed ? JSON.parse(completed.resultUrl as string) : null
}

// The waitlist DELETE is the only sql-tagged predicate; the other deletes use eq().
type SqlPred = { sql: { strings: string[]; values: unknown[] } }
const isSqlPred = (p: unknown): p is SqlPred =>
  !!p && typeof p === 'object' && 'sql' in (p as Record<string, unknown>)
const waitlistDeletePred = () => deleteCalls.find((c) => isSqlPred(c.pred))?.pred as SqlPred | undefined

// V-N3 SLICE 5: the consumer CAPTURE is now the ONLY SELECT with a sql-tagged WHERE
// (record/dev/toolIds use eq), so this returns exactly that ONE lookup — with its
// captured {where} (and orderBy, which must be undefined now: no ORDER BY).
const sqlSelectLookups = () => selectCalls.filter((c) => isSqlPred(c.where))

// ── F-1 predicate shapes (the mocked drizzle helpers) ────────────────────────
//   eq(col, val)        → { a: col, b: val }
//   inArray(col, vals)  → { inArray: [col, vals] }
//   and(...clauses)     → { and: [clause, …] }
type EqPred = { a: unknown; b: unknown }
type InArrayPred = { inArray: [unknown, unknown[]] }
type AndPred = { and: unknown[] }
const isEqPred = (p: unknown, col: string, val: unknown): boolean =>
  !!p && typeof p === 'object' && (p as EqPred).a === col && (p as EqPred).b === val
const isInArrayOn = (p: unknown, col: string): p is InArrayPred =>
  !!p && typeof p === 'object' && 'inArray' in (p as Record<string, unknown>) &&
  (p as InArrayPred).inArray[0] === col
// V-N3 SLICE 5: the consumer-scoped scrubs/deletes now key on inArray(col, ids)
// (the all-rows captured set), not eq(col, id). Match an inArray predicate on `col`
// whose id list CONTAINS `id`.
const isInArrayContaining = (p: unknown, col: string, id: unknown): boolean =>
  isInArrayOn(p, col) && (p as InArrayPred).inArray[1].includes(id)
// The step-5c cross-principal predicate: and(inArray(resourceType,[…]), eq(resourceId, subject)).
const crossPrincipalClauses = (p: unknown): unknown[] | null =>
  !!p && typeof p === 'object' && 'and' in (p as Record<string, unknown>) &&
  (p as AndPred).and.some((c) => isInArrayOn(c, 'resourceType'))
    ? (p as AndPred).and
    : null
// Find a captured tx.update() whose .set/.where pair satisfies the matcher.
function findUpdate(match: (u: { vals: Record<string, unknown> | undefined; pred: unknown }) => boolean) {
  return updatePreds.find(match)
}

describe('processDataDeletion — LB-1: auth-delete ordering + idempotency + fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the Supabase auth user with the captured id and reaches completed', async () => {
    mockAuthDelete.mockResolvedValue(undefined)
    seed({ devSupabaseUserId: 'auth-user-1' })

    const result = await processDataDeletion('exp-1')

    expect(mockAuthDelete).toHaveBeenCalledWith('auth-user-1')
    expect(result.status).toBe('completed')
    expect(wroteCompleted()).toBe(true)
  })

  it('treats the idempotent (already-deleted) path as success → still completes', async () => {
    // The 404 is absorbed INSIDE deleteSupabaseAuthUser (it resolves), so the
    // mock resolving models the idempotent-already-deleted retry.
    mockAuthDelete.mockResolvedValue(undefined)
    seed({ devSupabaseUserId: 'auth-user-1' })

    const result = await processDataDeletion('exp-1')

    expect(result.status).toBe('completed')
  })

  it('does NOT call the auth-delete when the developer has no linked Supabase auth user', async () => {
    mockAuthDelete.mockResolvedValue(undefined)
    seed({ devSupabaseUserId: null })

    const result = await processDataDeletion('exp-1')

    expect(mockAuthDelete).not.toHaveBeenCalled()
    expect(result.status).toBe('completed')
  })

  it('FAIL-CLOSED: an auth-delete error ends in failed and NEVER writes completed (LB-1a forbidden state)', async () => {
    mockAuthDelete.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY is not set'))
    seed({ devSupabaseUserId: 'auth-user-1' })

    const result = await processDataDeletion('exp-1')

    expect(result.status).toBe('failed')
    expect(wroteFailed()).toBe(true)
    // The load-bearing invariant: completed is NEVER written when the auth-delete
    // failed (otherwise the idempotent-completed no-op would re-assert the false
    // claim forever). This proves the auth-delete runs BEFORE the completion write.
    expect(wroteCompleted()).toBe(false)
  })

  it('de-duplicates dev + consumer twin ids (single deleteUser for the shared auth.users.id)', async () => {
    mockAuthDelete.mockResolvedValue(undefined)
    seed({ devSupabaseUserId: 'auth-user-1', consumerSupabaseUserId: 'auth-user-1' })

    await processDataDeletion('exp-1')

    expect(mockAuthDelete).toHaveBeenCalledTimes(1)
    expect(mockAuthDelete).toHaveBeenCalledWith('auth-user-1')
  })
})

describe('processDataDeletion — V-N3 SLICE 3: completeness scrubs (behavioral)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  // ── The four scrubs, pinned at the .set / .delete payload (revert → RED) ──

  it('step 1 also resets developers.notificationWebhooks to {} (alongside notificationPreferences)', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    // The developer .set() is the one carrying notificationPreferences.
    const devSet = updateCalls.find((c) => 'notificationPreferences' in c)
    expect(devSet, 'developer anonymize .set() must be captured').toBeDefined()
    // Non-vacuous: reverting the notificationWebhooks scrub drops this key.
    expect(devSet).toHaveProperty('notificationWebhooks')
    expect(devSet!.notificationWebhooks).toEqual({})
  })

  it('step 5 also nulls audit_logs.details (alongside ipAddress/userAgent — the raw login email)', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    const auditSet = updateCalls.find((c) => 'ipAddress' in c && 'userAgent' in c)
    expect(auditSet, 'audit-log scrub .set() must be captured').toBeDefined()
    // Non-vacuous: reverting the details scrub drops this property entirely.
    expect(auditSet).toHaveProperty('details', null)
  })

  it('step 8 nulls tools.sourceRepoUrl/proxyEndpoint/crawlMetadata but PRESERVES name/slug', async () => {
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')

    const toolsSet = updateCalls.find((c) => c.status === 'deleted')
    expect(toolsSet, 'tools .set() must be captured (toolIds>0)').toBeDefined()
    // Non-vacuous: reverting any of the three null-outs drops that property.
    expect(toolsSet).toHaveProperty('sourceRepoUrl', null)
    expect(toolsSet).toHaveProperty('proxyEndpoint', null)
    expect(toolsSet).toHaveProperty('crawlMetadata', null)
    // LB-1 over-scrub guard (FORBIDDEN): name/slug are product-artifact identity —
    // the deletion must NOT touch them. Adding them to step 8 turns this RED.
    expect(toolsSet).not.toHaveProperty('name')
    expect(toolsSet).not.toHaveProperty('slug')
  })

  it('issues a DELETE against waitlist_signups keyed on the dev email (sql predicate)', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    // Non-vacuous: reverting the waitlist DELETE removes the only sql-tagged pred.
    const pred = waitlistDeletePred()
    expect(pred, 'a sql-keyed waitlist DELETE must be issued').toBeDefined()
    expect(pred!.sql.values).toContain('d@x.com')
  })

  it('waitlist DELETE NORMALIZES a mixed-case dev email (matches the lower()+trim writer)', async () => {
    // §7-B: the writer stores email.toLowerCase().trim(); a raw-case match would
    // miss the row and make the 'waitlist_signups' disclosure FALSE.
    seed({ devSupabaseUserId: null, email: '  D@X.Com  ' })
    await processDataDeletion('exp-1')

    const pred = waitlistDeletePred()
    expect(pred).toBeDefined()
    // Non-vacuous: an exact-match (raw dev.email) would carry '  D@X.Com  ' here.
    expect(pred!.sql.values).toContain('d@x.com')
    expect(pred!.sql.values).not.toContain('  D@X.Com  ')
  })

  it('PINS the literal lower()=equality SQL, not just the bound value (global-table blast-radius guard)', async () => {
    // ③ post-seal deep-audit F-A: waitlist_signups is a GLOBAL marketing table keyed
    // ONLY by email (no developer FK). The value-only assertions above are blind to the
    // SQL OPERATOR/FUNCTION — a one-char regression (lower→upper or =→<>) would turn this
    // subject-scoped DELETE into a whole-table wipe of EVERY user's signup and still pass
    // (the bound value 'd@x.com' is identical for both clauses). Pin the literal SQL text:
    // the mock already captures pred.sql.strings; assert the operator + casing function.
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    const pred = waitlistDeletePred()
    expect(pred, 'a sql-keyed waitlist DELETE must be issued').toBeDefined()
    const sqlText = pred!.sql.strings.join('')
    expect(sqlText, 'must lower() the column to match the lowercased writer').toMatch(/lower\s*\(/i)
    expect(sqlText, 'must be a positive equality (=) match').toContain('=')
    expect(sqlText, 'must NOT be an inequality/negation (would delete every OTHER row)').not.toMatch(/<>|!=/)
    expect(sqlText, 'must NOT uppercase the column (would never match the lowercased store)').not.toMatch(/upper\s*\(/i)
  })

  // ── The persisted disclosure honors the RUNTIME gating (E5) ──

  it('discloses notification_webhooks + audit_logs.details UNCONDITIONALLY', async () => {
    seed({ devSupabaseUserId: null }) // no tools, no waitlist rows
    await processDataDeletion('exp-1')

    const anonymized = completedResultUrl()?.anonymized as string[]
    expect(anonymized).toContain('developers.notification_webhooks')
    expect(anonymized).toContain('audit_logs.details')
  })

  it('GATES waitlist_signups on rows actually deleted (no false claim when none)', async () => {
    // rows deleted → disclosed
    seed({ devSupabaseUserId: null, waitlistRows: [{ id: 'w-1' }] })
    await processDataDeletion('exp-1')
    expect(completedResultUrl()?.anonymized as string[]).toContain('waitlist_signups')

    // no rows → NOT disclosed (the common no-signup developer)
    seed({ devSupabaseUserId: null, waitlistRows: [] })
    await processDataDeletion('exp-1')
    expect(completedResultUrl()?.anonymized as string[]).not.toContain('waitlist_signups')
  })

  it('GATES the tools PII-infra column paths on the developer owning tools', async () => {
    // no tools → tool paths absent
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')
    const noTools = completedResultUrl()?.anonymized as string[]
    expect(noTools).not.toContain('tools.source_repo_url')

    // owns tools → tool paths present
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')
    const withTools = completedResultUrl()?.anonymized as string[]
    expect(withTools).toContain('tools.source_repo_url')
    expect(withTools).toContain('tools.proxy_endpoint')
    expect(withTools).toContain('tools.crawl_metadata')
  })

  it('discloses organizations.billing_email as retained (distinct entity), not anonymized', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()
    expect(parsed?.retainedUnscrubbed as string[]).toContain('organizations.billing_email')
    // DC-11: a PATH, never a value — and absent from the anonymized (scrubbed) list.
    expect(parsed?.anonymized as string[]).not.toContain('organizations.billing_email')
    expect(parsed?.retainedUnscrubbedNote as string).toMatch(/distinct entity/i)
  })

  it('DC-11: every disclosure-array entry is a column PATH, never a row VALUE', async () => {
    // ③ post-seal deep-audit F-B: the toContain/not.toContain assertions above check
    // MEMBERSHIP of specific paths but are indifferent to an EXTRA leaked element — a
    // future edit that interpolated dev.email (or any PII row value) into the arrays
    // would pass every existing assertion. Pin the DC-11 'PATH never a value' invariant
    // directly: every entry is a snake_case table.column[.subpath], and the subject's
    // raw email never appears anywhere in the serialized erasure-proof artifact.
    // Seed ALL gates ON so the full disclosure set is exercised.
    seed({
      devSupabaseUserId: null,
      email: 'd@x.com',
      consumerInTxn: true,
      toolIds: [{ id: 'tool-1' }],
      waitlistRows: [{ id: 'w-1' }],
    })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()!
    const pathShape = /^[a-z_]+(\.[a-z_]+)*$/
    for (const key of ['anonymized', 'retained', 'retainedUnscrubbed'] as const) {
      for (const entry of (parsed[key] as string[])) {
        expect(entry, `${key} entry must be a column PATH, not a value: ${entry}`).toMatch(pathShape)
      }
    }
    // The subject's raw email (a row VALUE / PII) must never leak into the disclosure.
    expect(JSON.stringify(parsed)).not.toContain('d@x.com')
  })
})

describe('processDataDeletion — V-N3 SLICE 3 RECOVERY (F-1): audit_logs.details scrub reaches ALL keying paths', () => {
  // The blocking finding: the UNCONDITIONAL 'audit_logs.details' disclosure was
  // FALSE because step 5 keyed on developerId ONLY, while the subject's PII also
  // lands on consumerId-keyed rows (the consumer twin) and on cross-principal
  // rows an admin wrote ABOUT the subject (chargeback-watch/unpause:
  // resourceType='developer', resourceId=<subject>, details.targetDeveloperEmail).
  // These pin the *predicates* (handoff F-1 point 4) — reverting a scrub → RED.
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  it('step 5 scrubs ip/ua/details on the developerId-keyed rows (the subject’s own audit rows)', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    const p = findUpdate((u) => isEqPred(u.pred, 'developerId', 'dev-1') && u.vals?.details === null)
    expect(p, 'a developerId-keyed audit scrub nulling details must be issued').toBeDefined()
    expect(p!.vals).toMatchObject({ ipAddress: null, userAgent: null, details: null })
  })

  it('step 5c scrubs details on CROSS-PRINCIPAL rows naming the subject as a developer resource (the chargeback leak)', async () => {
    seed({ devSupabaseUserId: null })
    await processDataDeletion('exp-1')

    // The leak fix: and(inArray(resourceType, ['developer','developer_signup']), eq(resourceId, dev-1)).
    const p = findUpdate((u) => !!crossPrincipalClauses(u.pred) && u.vals?.details === null)
    expect(p, 'a cross-principal audit scrub (resourceType IN (…) AND resourceId=subject) must be issued').toBeDefined()

    const clauses = crossPrincipalClauses(p!.pred)!
    const inArrayClause = clauses.find((c) => isInArrayOn(c, 'resourceType')) as InArrayPred
    expect(inArrayClause.inArray[1]).toEqual(['developer', 'developer_signup'])
    // resourceId must be keyed to the SUBJECT's developerId (not a literal/other id).
    expect(clauses.some((c) => isEqPred(c, 'resourceId', 'dev-1')), 'resourceId = subject developerId').toBe(true)
    // OVER-SCRUB guard (DC-13): only `details` is nulled here — the row’s ip/ua
    // belong to the ACTING principal (the admin), so they are NOT touched.
    expect(p!.vals).not.toHaveProperty('ipAddress')
    expect(p!.vals).not.toHaveProperty('userAgent')
    expect(p!.vals).toEqual({ details: null })
  })

  it('step 5b scrubs the consumer twin’s OWN audit rows (consumerId-keyed) — gated on the twin existing', async () => {
    // twin present → consumerId-keyed whole-column scrub fires (inArray over the set)
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')
    const p = findUpdate((u) => isInArrayContaining(u.pred, 'consumerId', 'cons-1') && u.vals?.details === null)
    expect(p, 'a consumer-twin audit scrub must be issued when a twin exists').toBeDefined()
    expect(p!.vals).toMatchObject({ ipAddress: null, userAgent: null, details: null })
  })

  it('does NOT issue the consumer-twin audit scrub when there is no twin (gate holds)', async () => {
    seed({ devSupabaseUserId: null }) // no matching consumer → consumerMatched=false
    await processDataDeletion('exp-1')
    expect(findUpdate((u) => isInArrayContaining(u.pred, 'consumerId', 'cons-1'))).toBeUndefined()
  })
})

describe('processDataDeletion — V-N3 SLICE 3 RECOVERY (F-2): tool_reviews.developer_response scrub', () => {
  // The blocking finding: the SUBJECT-authored developer_response/responded_at on
  // reviews of THEIR OWN tools survived (step 7 keys on the consumer twin, not the
  // dev’s tools) and was in NEITHER disclosure array.
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  it('step 7b nulls developer_response + developer_responded_at, keyed on the dev’s tools (toolIds>0)', async () => {
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')

    const respSet = updateCalls.find((c) => 'developerResponse' in c)
    expect(respSet, 'the developer-response scrub .set() must be captured (toolIds>0)').toBeDefined()
    // Non-vacuous: reverting the scrub drops these keys entirely.
    expect(respSet).toHaveProperty('developerResponse', null)
    expect(respSet).toHaveProperty('developerRespondedAt', null)
    // OVER-SCRUB guard: rating/comment on these rows are OTHER consumers’ data —
    // adding either to step 7b turns this RED.
    expect(respSet).not.toHaveProperty('rating')
    expect(respSet).not.toHaveProperty('comment')
    // keyed on toolId ∈ toolIds (NOT the consumer twin’s consumerId).
    const pred = updatePreds.find((u) => u.vals === respSet)?.pred
    expect(isInArrayOn(pred, 'toolId'), 'step 7b keys on inArray(toolId, toolIds)').toBe(true)
    expect((pred as InArrayPred).inArray[1]).toEqual(['tool-1'])
  })

  it('does NOT scrub developer_response when the developer owns no tools (gate holds)', async () => {
    seed({ devSupabaseUserId: null }) // no toolIds
    await processDataDeletion('exp-1')
    expect(updateCalls.find((c) => 'developerResponse' in c)).toBeUndefined()
  })

  it('GATES the tool_reviews.developer_response disclosure on the developer owning tools', async () => {
    seed({ devSupabaseUserId: null }) // no tools → path absent
    await processDataDeletion('exp-1')
    expect(completedResultUrl()?.anonymized as string[]).not.toContain('tool_reviews.developer_response')

    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] }) // owns tools → path present
    await processDataDeletion('exp-1')
    expect(completedResultUrl()?.anonymized as string[]).toContain('tool_reviews.developer_response')
  })
})

describe('processDataDeletion — V-N3 SLICE 4: consumer-side normalization + financial-linkage erasure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  // ── (A) SLICE 5: ONE set-based, whitespace-symmetric consumer capture (no ORDER BY/LIMIT) ──

  it('T-e: captures the twin SET by NORMALIZED lower(trim(email)) — ONE lookup, NO ORDER BY / NO LIMIT', async () => {
    // The mock returns the queued rows regardless of predicate, so this pins the SQL
    // CONSTRUCT that, on a real DB, matches ALL case-variant rows for the subject:
    //   WHERE lower(trim(email)) = <normalized>            (no ORDER BY, no LIMIT)
    // DC-05/DC-10 lesson: assert the operator/function TEXT (sql.strings), not just
    // the bound value — a value-only test passes a lower→upper / =→<> regression.
    // SLICE 5: the byte-exact-first ORDER BY / LIMIT-1 is REMOVED (the set takes ALL
    // matching rows), and there is now exactly ONE consumer lookup (the pre-txn
    // capture, reused in-txn) — a re-added ORDER BY/LIMIT or a second lookup is a
    // refactor regression and must go RED.
    seed({ devSupabaseUserId: null, email: '  Bob@X.com  ', consumerInTxn: true })
    await processDataDeletion('exp-1')

    const lookups = sqlSelectLookups()
    // Exactly ONE: the single pre-txn consumer capture (reused in-txn via inArray).
    expect(lookups.length, 'one pre-txn consumer capture, no in-txn re-select').toBe(1)

    const lk = lookups[0]
    const whereText = (lk.where as SqlPred).sql.strings.join('')
    expect(whereText, 'normalize via lower()').toMatch(/lower\s*\(/i)
    // SLICE 5: trim() on the COLUMN side too (symmetric with the trimmed norm).
    expect(whereText, 'trim() the column (whitespace-symmetric)').toMatch(/trim\s*\(/i)
    expect(whereText, 'positive equality (=)').toContain('=')
    expect(whereText, 'never uppercase the column').not.toMatch(/upper\s*\(/i)
    expect(whereText, 'never an inequality/negation').not.toMatch(/<>|!=/)
    // No ORDER BY / LIMIT on the consumer capture (the set takes ALL matching rows).
    expect(whereText, 'no ORDER BY in the capture WHERE').not.toMatch(/order\s+by/i)
    expect(whereText, 'no LIMIT in the capture WHERE').not.toMatch(/limit/i)
    expect(lk.orderBy, 'the consumer capture must not call .orderBy()').toBeUndefined()
    // WHERE binds the NORMALIZED (lowercased+trimmed) email, never the raw case.
    expect((lk.where as SqlPred).sql.values).toContain('bob@x.com')
    expect((lk.where as SqlPred).sql.values).not.toContain('  Bob@X.com  ')
  })

  it('uses the SAME captured set for BOTH the auth-delete and the in-txn anonymize (no split)', async () => {
    // The single pre-txn capture drives both the auth-delete (by supabaseUserId)
    // and the in-txn anonymize (by id) — by construction they cannot split across
    // case-variant rows. Seeded as the captured row {id:'cons-1', supabaseUserId:'auth-true'}.
    seed({
      devSupabaseUserId: null,
      consumerSupabaseUserId: 'auth-true',
      consumerInTxn: true,
      email: 'Bob@X.com',
    })
    await processDataDeletion('exp-1')

    expect(mockAuthDelete).toHaveBeenCalledWith('auth-true')
    const consumerSet = updateCalls.find((c) => 'referralCode' in c)
    expect(consumerSet, 'consumer anonymize .set() captured').toBeDefined()
    // The per-row anonymize keys on eq(consumers.id, id) (NOT inArray) — one update
    // per matching row, each carrying its OWN id (decision #1).
    const pred = updatePreds.find((u) => u.vals === consumerSet)?.pred
    expect(isEqPred(pred, 'id', 'cons-1'), 'anonymize targets the captured twin id').toBe(true)
  })

  // ── (B) financial/referral linkage scrub in the step-2 .set() ──

  it('step 2 .set() nulls stripeCustomerId + defaultPaymentMethodId + referralCode (alongside the identity columns)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    const consumerSet = updateCalls.find((c) => 'referralCode' in c)
    expect(consumerSet, 'consumer anonymize .set() captured').toBeDefined()
    // Non-vacuous: reverting any null-out drops that property.
    expect(consumerSet).toHaveProperty('stripeCustomerId', null)
    expect(consumerSet).toHaveProperty('defaultPaymentMethodId', null)
    expect(consumerSet).toHaveProperty('referralCode', null)
    // The pre-existing identity scrub is preserved.
    expect(consumerSet).toHaveProperty('supabaseUserId', null)
    expect(consumerSet).toHaveProperty('passwordHash', null)
  })

  // ── (C) consumer-keyed sibling deletes + scrubs, gated on the twin ──

  it('REVOKES the consumer twin’s OWN api_keys (step 2, consumerId-keyed: status=revoked, ipAllowlist=null) — NOT a delete', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    // V-N3-deletion-cascade: keyed on the distinctive vals (status:'revoked'), NOT
    // table identity — the update mock doesn't record the table arg (§11 F6).
    // Distinguished from the step-3 toolId-keyed revoke by the consumerId predicate.
    const revoke = findUpdate((u) => u.vals?.status === 'revoked' && isInArrayContaining(u.pred, 'consumerId', 'cons-1'))
    expect(revoke, 'a consumerId-keyed api_keys REVOKE update must be issued').toBeDefined()
    expect(revoke!.vals).toMatchObject({ status: 'revoked', ipAllowlist: null })
    // De-auth rests on the status gate; the NOT-NULL credential (keyHash/keyPrefix)
    // is LEFT intact (§11 F1) — nulling it would violate NOT NULL → txn rollback.
    expect(revoke!.vals).not.toHaveProperty('keyHash')
    expect(revoke!.vals).not.toHaveProperty('keyPrefix')
    // Cascade safety: there must be NO api_keys DELETE (a delete would cascade-kill
    // the invocations.api_key_id rows). deleteCalls records the table → assert absence.
    expect(deleteCalls.find((c) => c.table === apiKeys), 'no api_keys DELETE — revoke only').toBeUndefined()
  })

  it('REVOKES the developer’s tools’ api_keys (step 3, toolId-keyed) when the dev owns tools', async () => {
    // §11 F6: no toolId-keyed api_keys pin existed before — added here.
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')

    // update(apiKeys).set({status:'revoked', ipAllowlist:null}).where(inArray(toolId, toolIds)).
    const revoke = findUpdate((u) => u.vals?.status === 'revoked' && isInArrayOn(u.pred, 'toolId'))
    expect(revoke, 'a toolId-keyed api_keys REVOKE update must be issued (toolIds>0)').toBeDefined()
    expect((revoke!.pred as InArrayPred).inArray[1]).toEqual(['tool-1'])
    expect(revoke!.vals).toMatchObject({ status: 'revoked', ipAllowlist: null })
    expect(deleteCalls.find((c) => c.table === apiKeys), 'no api_keys DELETE — revoke only').toBeUndefined()
  })

  it('does NOT revoke any api_keys when the dev owns no tools AND has no twin (both gates hold)', async () => {
    seed({ devSupabaseUserId: null }) // no tools, no twin → neither step 2 nor step 3 fires
    await processDataDeletion('exp-1')
    expect(findUpdate((u) => u.vals?.status === 'revoked')).toBeUndefined()
  })

  it('deletes the consumer twin’s cron schedules (consumerId-keyed)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    const del = deleteCalls.find((c) => c.table === consumerSchedules && isInArrayContaining(c.pred, 'consumerId', 'cons-1'))
    expect(del, 'a consumerId-keyed consumer_schedules DELETE must be issued').toBeDefined()
  })

  it('nulls conversion_events.metadata keyed on the twin (consumerId), distinct from invocations.metadata (toolId)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    const scrub = findUpdate((u) => u.vals?.metadata === null && isInArrayContaining(u.pred, 'consumerId', 'cons-1'))
    expect(scrub, 'conversion_events.metadata null keyed on consumerId').toBeDefined()
    // ONLY metadata is nulled (the row's event/tier analytics are retained).
    expect(scrub!.vals).toEqual({ metadata: null })
  })

  it('does NOT scrub outcome_verifications.dispute_reason (its consumerId is a tool-supplied opaque id, not consumers.id)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    // RULING: never scrubbed (a consumers.id-keyed scrub would generally no-op) AND
    // never disclosed-as-anonymized (that would be a false DC-16 claim).
    expect(updateCalls.find((c) => 'disputeReason' in c)).toBeUndefined()
    expect(completedResultUrl()?.anonymized as string[]).not.toContain('outcome_verifications.dispute_reason')
  })

  it('does NOT issue any consumer-keyed delete/scrub when there is no twin (gate holds)', async () => {
    seed({ devSupabaseUserId: null }) // no twin
    await processDataDeletion('exp-1')

    // No consumerId-keyed api_keys REVOKE without a twin (step 2 gated on consumerMatched).
    expect(findUpdate((u) => u.vals?.status === 'revoked' && isInArrayContaining(u.pred, 'consumerId', 'cons-1'))).toBeUndefined()
    expect(deleteCalls.find((c) => c.table === consumerSchedules)).toBeUndefined()
    expect(updateCalls.find((c) => 'referralCode' in c)).toBeUndefined()
    expect(findUpdate((u) => u.vals?.metadata === null && isInArrayContaining(u.pred, 'consumerId', 'cons-1'))).toBeUndefined()
  })

  // ── (D) disclosure sync: financial/referral + siblings → anonymized (gated) ──

  it('discloses the consumer financial/referral + sibling column PATHS in anonymized (gated on the twin)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()
    const anonymized = parsed?.anonymized as string[]
    // DC-11: column PATHS only — they are SCRUBBED now, so they live in anonymized.
    expect(anonymized).toContain('consumers.stripe_customer_id')
    expect(anonymized).toContain('consumers.default_payment_method_id')
    expect(anonymized).toContain('consumers.referral_code')
    expect(anonymized).toContain('consumer_schedules')
    expect(anonymized).toContain('conversion_events.metadata')
    expect(anonymized).toContain('api_keys')

    // They must NOT be mislabeled retained, and the false referral rationale is gone.
    const retainedUnscrubbed = parsed?.retainedUnscrubbed as string[]
    expect(retainedUnscrubbed).not.toContain('consumers.referral_code')
    expect(retainedUnscrubbed).not.toContain('consumers.stripe_customer_id')
    expect(parsed?.retainedUnscrubbedNote as string).not.toMatch(/referral_code anchors referral attribution/i)
    // The org + ledger deferrals are untouched (still retained-un-scrubbed).
    expect(retainedUnscrubbed).toContain('organizations.billing_email')
    expect(retainedUnscrubbed).toContain('ledger_entries.operation_id')
  })

  it('omits the consumer-side anonymized paths when there is no twin (no false disclosure)', async () => {
    seed({ devSupabaseUserId: null }) // no twin, no tools
    await processDataDeletion('exp-1')

    const anonymized = completedResultUrl()?.anonymized as string[]
    expect(anonymized).not.toContain('consumers.referral_code')
    expect(anonymized).not.toContain('consumer_schedules')
    expect(anonymized).not.toContain('conversion_events.metadata')
    // api_keys is absent on the no-tools + no-twin path (neither gate fires).
    expect(anonymized).not.toContain('api_keys')
  })

  it('still discloses api_keys when the developer owns tools but has no consumer twin (the toolId-keyed gate)', async () => {
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] }) // tools, no twin
    await processDataDeletion('exp-1')
    expect(completedResultUrl()?.anonymized as string[]).toContain('api_keys')
  })
})

describe('processDataDeletion — V-N3 SLICE 5: all-rows consumer-twin erasure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  // ── DECISION #1: per-row UNIQUE email — anonymize EVERY matching row with ITS OWN id ──

  it('decision #1: anonymizes EVERY matching consumer row with ITS OWN id (per-row UNIQUE email)', async () => {
    // Two coexisting case-variant rows for one subject. The per-row loop MUST set
    // each row's email to deleted-<THAT row's id>@… — a single shared captured id
    // (deleted-${ids[0]}@-for-all) would COLLIDE on the RAW UNIQUE(email) on a real
    // DB → whole-txn rollback → silent failed deletion. (DC-05/DC-10: the mock does
    // NOT enforce UNIQUE, so this is the SOURCE-regression pin; the real-Postgres
    // collision is construction-pinned only — see the build report's T-f gap.)
    seed({
      devSupabaseUserId: null,
      consumerRows: [
        { id: 'c1', supabaseUserId: 'a1' },
        { id: 'c2', supabaseUserId: 'a2' },
      ],
    })
    await processDataDeletion('exp-1')

    // One consumers anonymize .set() per matching row (the loop fires twice).
    const consumerSets = updatePreds.filter((u) => u.vals && 'referralCode' in u.vals)
    expect(consumerSets.length, 'one consumers anonymize per matching row').toBe(2)

    const byId = (id: string) =>
      consumerSets.find((u) => isEqPred(u.pred, 'id', id))?.vals
    expect(byId('c1'), 'an anonymize keyed on c1').toBeDefined()
    expect(byId('c2'), 'an anonymize keyed on c2').toBeDefined()
    // Each row's email uses ITS OWN id — DISTINCT, never one shared string.
    expect(byId('c1')!.email).toBe('deleted-c1@deleted.settlegrid.ai')
    expect(byId('c2')!.email).toBe('deleted-c2@deleted.settlegrid.ai')
    expect(byId('c1')!.email).not.toBe(byId('c2')!.email)
  })

  // ── DECISION #2: the auth-delete set spans EVERY matching row's supabaseUserId ──

  it('decision #2: EVERY matching row’s supabaseUserId reaches the (deduped) auth-delete set', async () => {
    seed({
      devSupabaseUserId: 'dev-auth',
      consumerRows: [
        { id: 'c1', supabaseUserId: 'a1' },
        { id: 'c2', supabaseUserId: 'a2' },
      ],
    })
    await processDataDeletion('exp-1')

    // No sibling auth user is left orphaned (F-2): dev + both consumer rows.
    expect(mockAuthDelete).toHaveBeenCalledWith('dev-auth')
    expect(mockAuthDelete).toHaveBeenCalledWith('a1')
    expect(mockAuthDelete).toHaveBeenCalledWith('a2')
    expect(mockAuthDelete).toHaveBeenCalledTimes(3)
  })

  it('decision #2: dedups a supabaseUserId shared across sibling rows + the dev', async () => {
    seed({
      devSupabaseUserId: 'shared',
      consumerRows: [
        { id: 'c1', supabaseUserId: 'shared' },
        { id: 'c2', supabaseUserId: 'a2' },
      ],
    })
    await processDataDeletion('exp-1')

    // 'shared' (dev + c1) collapses to one call; 'a2' is the only other.
    expect(mockAuthDelete).toHaveBeenCalledTimes(2)
    expect(mockAuthDelete).toHaveBeenCalledWith('shared')
    expect(mockAuthDelete).toHaveBeenCalledWith('a2')
  })

  // ── DECISION #3 / (D): the consumer-keyed scrubs key on inArray over the FULL set ──

  it('re-keys every consumer-scoped delete/scrub to inArray over the captured id set', async () => {
    seed({
      devSupabaseUserId: null,
      consumerRows: [
        { id: 'c1', supabaseUserId: null },
        { id: 'c2', supabaseUserId: null },
      ],
    })
    await processDataDeletion('exp-1')

    // api_keys REVOKE keys on inArray(consumerId, [c1, c2]); consumer_schedules
    // DELETE keys on the same captured set.
    const apiRevoke = findUpdate((u) => u.vals?.status === 'revoked' && isInArrayOn(u.pred, 'consumerId'))
    expect(apiRevoke, 'api_keys REVOKE keyed inArray(consumerId, ids)').toBeDefined()
    expect((apiRevoke!.pred as InArrayPred).inArray[1]).toEqual(['c1', 'c2'])

    const schedDel = deleteCalls.find((c) => c.table === consumerSchedules && isInArrayOn(c.pred, 'consumerId'))
    expect(schedDel, 'consumer_schedules DELETE keyed inArray(consumerId, ids)').toBeDefined()
    expect((schedDel!.pred as InArrayPred).inArray[1]).toEqual(['c1', 'c2'])

    // conversion_events.metadata + audit_logs (5b) + tool_reviews (7) scrub over the set.
    const conv = findUpdate((u) => u.vals?.metadata === null && isInArrayOn(u.pred, 'consumerId'))
    expect(conv, 'conversion_events.metadata scrub keyed inArray(consumerId, ids)').toBeDefined()
    expect((conv!.pred as InArrayPred).inArray[1]).toEqual(['c1', 'c2'])

    const audit5b = findUpdate((u) => u.vals?.details === null && isInArrayOn(u.pred, 'consumerId'))
    expect(audit5b, 'step-5b audit scrub keyed inArray(consumerId, ids)').toBeDefined()
    expect((audit5b!.pred as InArrayPred).inArray[1]).toEqual(['c1', 'c2'])
  })

  // ── (B) F-4 empty-email guard — gates the CAPTURE itself ──

  it('F-4: an empty (whitespace-only) developer email SKIPS the consumer capture entirely', async () => {
    // norm === '' → the source must NOT issue the consumer SELECT (else
    // lower(trim(email))='' could match an UNRELATED empty-email row and pull its
    // supabaseUserId into the irreversible auth-delete — over-delete of a stranger).
    // Strongest available pin in a non-evaluating mock: NO sql-keyed consumer lookup
    // is recorded, no consumer scrub fires, and the auth-delete is never called.
    seed({ devSupabaseUserId: null, email: '   ' })
    const result = await processDataDeletion('exp-1')

    expect(result.status).toBe('completed')
    expect(sqlSelectLookups().length, 'the consumer capture SELECT is skipped').toBe(0)
    expect(mockAuthDelete, 'no auth user pulled from an empty-email match').not.toHaveBeenCalled()
    expect(updateCalls.find((c) => 'referralCode' in c), 'no consumer anonymize').toBeUndefined()
    const anonymized = completedResultUrl()?.anonymized as string[]
    expect(anonymized).not.toContain('consumers.referral_code')
    expect(anonymized).not.toContain('consumer_schedules')
  })

  // ── (T-d) DC-11 path-shape guard re-run with ≥2 sibling rows ──

  it('T-d (DC-11): with ≥2 sibling rows, every manifest entry is a column PATH — no per-id value leaks', async () => {
    // The per-row loop writes deleted-c1@… / deleted-c2@… — none of those per-id
    // values may leak into the disclosure arrays (which carry column PATHS only).
    seed({
      devSupabaseUserId: null,
      email: 'bob@x.com',
      consumerRows: [
        { id: 'c1', supabaseUserId: 'a1' },
        { id: 'c2', supabaseUserId: 'a2' },
      ],
      toolIds: [{ id: 'tool-1' }],
      waitlistRows: [{ id: 'w-1' }],
    })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()!
    const pathShape = /^[a-z_]+(\.[a-z_]+)*$/
    for (const key of ['anonymized', 'retained', 'retainedUnscrubbed'] as const) {
      for (const entry of (parsed[key] as string[])) {
        expect(entry, `${key} entry must be a column PATH, not a value: ${entry}`).toMatch(pathShape)
      }
    }
    // No per-row anonymized email (a row VALUE) leaks into the erasure-proof artifact.
    const serialized = JSON.stringify(parsed)
    expect(serialized).not.toContain('deleted-c1@')
    expect(serialized).not.toContain('deleted-c2@')
    expect(serialized).not.toContain('bob@x.com')
    // The consumer paths ARE disclosed (the set was matched + scrubbed).
    expect(parsed.anonymized as string[]).toContain('consumers.referral_code')
    expect(parsed.anonymized as string[]).toContain('consumer_schedules')
  })
})

describe('processDataDeletion — V-N3-enable-disclosure: invocations.metadata erasure (step 4) is regression-pinned', () => {
  // The `anonymized: ['invocations.metadata']` claim is only HONEST because step 4
  // actually nulls invocations.metadata for the subject's tools. The source-text
  // presence of the `:865` entry is pinned in compliance-honesty-regression.test.ts;
  // THIS is the load-bearing BEHAVIORAL guard — the entry gates on toolIds.length>0
  // (NOT on step 4 running), so asserting the array string alone is VACUOUS (it stays
  // GREEN even if step 4 were deleted, leaving the claim FALSE). Non-vacuous: removing
  // or narrowing step 4 turns the behavioral clause RED.
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  it('step 4 nulls invocations.metadata scoped to the subject tool ids AND discloses it under anonymized', async () => {
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')

    // BEHAVIORAL clause (the real guard). Key on toolId so this never aliases the
    // consumerId-keyed conversion_events.metadata scrub (also metadata:null, step 2).
    const scrub = findUpdate((u) => u.vals?.metadata === null && isInArrayOn(u.pred, 'toolId'))
    expect(
      scrub,
      'step 4 must issue update(invocations).set({metadata:null}).where(inArray(toolId, toolIds))',
    ).toBeDefined()
    expect(scrub!.vals).toEqual({ metadata: null })
    expect((scrub!.pred as InArrayPred).inArray[1]).toEqual(['tool-1'])

    // DISCLOSURE clause: the anonymized array names the column PATH (gated on toolIds>0).
    expect(completedResultUrl()?.anonymized as string[]).toContain('invocations.metadata')
  })

  it('does NOT issue the step-4 invocations scrub when the developer owns no tools (gate holds)', async () => {
    seed({ devSupabaseUserId: null }) // no toolIds → step 4 never fires
    await processDataDeletion('exp-1')

    expect(findUpdate((u) => u.vals?.metadata === null && isInArrayOn(u.pred, 'toolId'))).toBeUndefined()
    expect(completedResultUrl()?.anonymized as string[]).not.toContain('invocations.metadata')
  })
})

describe('processDataDeletion — V-N3-deletion-cascade: retained-unscrubbed invocation linkage disclosure', () => {
  // With the api_keys REVOKED (not deleted), invocation rows now SURVIVE — incl.
  // FOREIGN developers' rows the consumer-twin called. Those rows stay keyed to the
  // now-pseudonymized consumer + the surviving (revoked) api_key; the disclosure
  // names the retained column PATHS (DC-11) gated on a matched twin. These pins
  // prove the runtime GATING fires (the source-text presence pins live in
  // compliance-honesty-regression.test.ts).
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  it('discloses the surviving invocation linkage column PATHS in retainedUnscrubbed (gated on the twin)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true, toolIds: [{ id: 'tool-1' }] })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()
    const retainedUnscrubbed = parsed?.retainedUnscrubbed as string[]
    expect(retainedUnscrubbed).toContain('invocations.consumer_id')
    expect(retainedUnscrubbed).toContain('invocations.api_key_id')
    // F3 RULING: session_id + referral_code RETAINED (referral_code anchors a
    // foreign dev's commission) and disclosed alongside — no new scrub.
    expect(retainedUnscrubbed).toContain('invocations.session_id')
    expect(retainedUnscrubbed).toContain('invocations.referral_code')
    // Single-bucket (SEAM): invocations.metadata lives SOLELY under anonymized
    // (own-tool rows nulled by step 4) — never double-listed in retainedUnscrubbed.
    expect(retainedUnscrubbed).not.toContain('invocations.metadata')
    expect(parsed?.anonymized as string[]).toContain('invocations.metadata')
  })

  it('omits the invocation linkage paths when there is no consumer twin (no false disclosure)', async () => {
    seed({ devSupabaseUserId: null, toolIds: [{ id: 'tool-1' }] }) // tools but no twin
    await processDataDeletion('exp-1')

    const retainedUnscrubbed = completedResultUrl()?.retainedUnscrubbed as string[]
    expect(retainedUnscrubbed).not.toContain('invocations.consumer_id')
    expect(retainedUnscrubbed).not.toContain('invocations.api_key_id')
    expect(retainedUnscrubbed).not.toContain('invocations.session_id')
    expect(retainedUnscrubbed).not.toContain('invocations.referral_code')
    // The ledger + org deferrals are still present (unaffected by the twin gate).
    expect(retainedUnscrubbed).toContain('organizations.billing_email')
  })

  it('the retainedUnscrubbedNote frames the surviving invocations as retained-pseudonymous, not erased', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')
    const note = completedResultUrl()?.retainedUnscrubbedNote as string
    expect(note).toMatch(/invocation rows on other developers' tools/i)
    expect(note).toMatch(/pseudonymi[sz]e/i)
    expect(note).toMatch(/not erased/i)
    // PRESERVE the frozen payer sentence verbatim (honesty-regression :245 pin).
    expect(note).toMatch(/The fields above retain the anonymous on-chain payer.s EVM address/)
  })
})
