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

const { mockDb, mockAuthDelete, selectQueue, txSelectQueue, updateCalls } =
  vi.hoisted(() => {
    const selectQueue: unknown[][] = []
    const txSelectQueue: unknown[][] = []
    const updateCalls: Array<Record<string, unknown>> = []
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
      update: () => tx,
      set: (vals: Record<string, unknown>) => {
        updateCalls.push(vals)
        return tx
      },
      where: () => Promise.resolve(undefined),
      delete: () => tx,
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

    return { mockDb, mockAuthDelete, selectQueue, txSelectQueue, updateCalls }
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
    auditLogs: tbl(['id', 'developerId', 'ipAddress', 'userAgent']),
    toolReviews: tbl(['id', 'consumerId', 'comment']),
  }
})

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...xs: unknown[]) => ({ and: xs }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
  desc: (x: unknown) => ({ desc: x }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
  sql: Object.assign(() => ({}), { raw: () => ({}) }),
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
}) {
  selectQueue.length = 0
  txSelectQueue.length = 0
  updateCalls.length = 0

  const record = [{
    id: 'exp-1', status: 'pending', requestType: 'data-deletion',
    entityType: 'provider', entityId: 'dev-1', resultUrl: null,
  }]
  const dev = [{ id: 'dev-1', email: 'd@x.com', supabaseUserId: opts.devSupabaseUserId }]
  const consumerPreTxn = opts.consumerSupabaseUserId !== undefined
    ? [{ supabaseUserId: opts.consumerSupabaseUserId }]
    : []
  const toolIds: unknown[] = [] // no tools — keeps the txn branches minimal

  selectQueue.push(record, dev, consumerPreTxn, toolIds)
  // step 2 consumer lookup inside txn:
  txSelectQueue.push(opts.consumerInTxn ? [{ id: 'cons-1' }] : [])
}

const wroteCompleted = () => updateCalls.some((c) => c.status === 'completed')
const wroteFailed = () => updateCalls.some((c) => c.status === 'failed')

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
