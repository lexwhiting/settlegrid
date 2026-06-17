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
  mockDb, mockAuthDelete, selectQueue, txSelectQueue, updateCalls, updatePreds, deleteCalls, waitlistRowsRef,
} = vi.hoisted(() => {
    const selectQueue: unknown[][] = []
    const txSelectQueue: unknown[][] = []
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
      const builder: Record<string, unknown> = {
        from: () => builder,
        where: () => builder,
        limit: () => Promise.resolve(result),
        // toolIds query awaits select().from().where() directly (no .limit):
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(onF, onR),
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
      select: () => makeSelectBuilder(txSelectQueue),
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

    return { mockDb, mockAuthDelete, selectQueue, txSelectQueue, updateCalls, updatePreds, deleteCalls, waitlistRowsRef }
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
    apiKeys: tbl(['id', 'toolId']),
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

/**
 * Seed the db mock for one processDataDeletion run.
 *   selectQueue order: [record lookup, dev lookup, consumer(pre-txn) lookup, toolIds]
 *   txSelectQueue order: [consumer lookup INSIDE txn (step 2)]
 */
function seed(opts: {
  devSupabaseUserId: string | null
  consumerSupabaseUserId?: string | null
  consumerInTxn?: boolean
  email?: string
  toolIds?: unknown[]
  waitlistRows?: unknown[]
}) {
  selectQueue.length = 0
  txSelectQueue.length = 0
  updateCalls.length = 0
  updatePreds.length = 0
  deleteCalls.length = 0
  waitlistRowsRef.rows = opts.waitlistRows ?? []

  const record = [{
    id: 'exp-1', status: 'pending', requestType: 'data-deletion',
    entityType: 'provider', entityId: 'dev-1', resultUrl: null,
  }]
  const dev = [{ id: 'dev-1', email: opts.email ?? 'd@x.com', supabaseUserId: opts.devSupabaseUserId }]
  const consumerPreTxn = opts.consumerSupabaseUserId !== undefined
    ? [{ supabaseUserId: opts.consumerSupabaseUserId }]
    : []
  const toolIds: unknown[] = opts.toolIds ?? [] // default: no tools (minimal branches)

  selectQueue.push(record, dev, consumerPreTxn, toolIds)
  // step 2 consumer lookup inside txn:
  txSelectQueue.push(opts.consumerInTxn ? [{ id: 'cons-1' }] : [])
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
    // twin present → consumerId-keyed whole-column scrub fires
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')
    const p = findUpdate((u) => isEqPred(u.pred, 'consumerId', 'cons-1') && u.vals?.details === null)
    expect(p, 'a consumer-twin audit scrub must be issued when a twin exists').toBeDefined()
    expect(p!.vals).toMatchObject({ ipAddress: null, userAgent: null, details: null })
  })

  it('does NOT issue the consumer-twin audit scrub when there is no twin (gate holds)', async () => {
    seed({ devSupabaseUserId: null }) // consumerInTxn unset → no consumerRecord
    await processDataDeletion('exp-1')
    expect(findUpdate((u) => isEqPred(u.pred, 'consumerId', 'cons-1'))).toBeUndefined()
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

describe('processDataDeletion — V-N3 SLICE 3 RECOVERY (F-3/4/5): consumer financial/referral disclosed-as-retained', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthDelete.mockResolvedValue(undefined)
  })

  it('discloses the consumer twin’s financial/referral column PATHS in retainedUnscrubbed (gated on the twin)', async () => {
    seed({ devSupabaseUserId: null, consumerInTxn: true })
    await processDataDeletion('exp-1')

    const parsed = completedResultUrl()
    const retained = parsed?.retainedUnscrubbed as string[]
    // DC-11: column PATHS only, never row values.
    expect(retained).toContain('consumers.stripe_customer_id')
    expect(retained).toContain('consumers.default_payment_method_id')
    expect(retained).toContain('consumers.referral_code')
    // They are RETAINED, not scrubbed — must not appear in the anonymized list.
    const anonymized = parsed?.anonymized as string[]
    expect(anonymized).not.toContain('consumers.referral_code')
    // The note records the deferral without a banned lawful-basis conclusion.
    expect(parsed?.retainedUnscrubbedNote as string).toMatch(/referral_code anchors referral attribution/i)
  })

  it('omits the consumer financial/referral paths when there is no consumer twin (no false disclosure)', async () => {
    seed({ devSupabaseUserId: null }) // no twin
    await processDataDeletion('exp-1')

    const retained = completedResultUrl()?.retainedUnscrubbed as string[]
    expect(retained).not.toContain('consumers.stripe_customer_id')
    expect(retained).not.toContain('consumers.referral_code')
    // The pre-existing unconditional ledger/org disclosures are unaffected.
    expect(retained).toContain('organizations.billing_email')
    expect(retained).toContain('ledger_entries.operation_id')
  })
})
