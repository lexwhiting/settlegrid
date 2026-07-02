/**
 * G5-3 (gdpr-access-consumer-erase) — the consumer-facing erasure DOOR integration
 * test, on the SAME real-Postgres (pglite) harness as
 * compliance-deletion-cascade.integration.test.ts.
 *
 * WHAT THIS PROVES — that `DELETE /api/consumer/account` is a DOOR onto the
 * ③-certified `processDataDeletion` pipeline (NOT a standalone consumer-erase
 * engine): a consumer self-delete resolves the developer TWIN (same
 * supabase_user_id) and drives the unified deletion that erases BOTH halves —
 * the consumer row AND the developer row — and hard-deletes the shared Supabase
 * auth user ONCE (handoff FOLD 1). It is a pglite (real-FK) test, not a mock-DB
 * one, so it cannot pass against a naive DELETE (DC-05/DC-24): the api_keys are
 * REVOKED and the invocation rows SURVIVE.
 *
 * Also pins:
 *   - FOLD 6 (the partial-callback edge): an authenticated consumer with NO
 *     developer row is NOT 404'd — the door ENSURES the developer row, then
 *     erases both halves.
 *   - The SHARED step-up control actually gates the consumer door (a password
 *     account with no password → REAUTH_REQUIRED, the scrub does NOT run).
 *   - The CSRF + confirmation + auth gates.
 *
 * The consumer door + the shared verifyStepUp both build a Supabase client via
 * @supabase/ssr; that is mocked to a fake bound to `authState` (no network). The
 * db is the real pglite instance; processDataDeletion runs for real against it.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

// drizzle-kit/api's ESM build is broken under vitest ("Dynamic require of fs");
// load the working CJS build (the in-process equivalent of `drizzle-kit push`).
const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
// Mutable auth identity each test configures BEFORE calling DELETE.
const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; identities?: Array<{ provider: string }> },
}))
const mockAuthUserDelete = vi.hoisted(() => vi.fn())

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
vi.mock('@/lib/supabase/admin', () => ({ deleteSupabaseAuthUser: mockAuthUserDelete }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/email', () => ({
  accountDeletedEmail: vi.fn(() => ({ subject: 's', html: 'h' })),
  sendEmail: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip',
  authLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
}))
// The consumer door's getUser + the shared verifyStepUp both build a Supabase
// client via @supabase/ssr; return a fake bound to `authState`. No verified MFA;
// signInWithPassword is unused (the OAuth fixtures ACCEPT via step-up residual).
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: authState.user } }),
      mfa: { listFactors: async () => ({ data: { totp: [], phone: [], webauthn: [], all: [] }, error: null }) },
      signInWithPassword: async () => ({ data: { user: null }, error: { message: 'unused' } }),
    },
  }),
}))

import { DELETE } from '@/app/api/consumer/account/route'
import * as schema from '@/lib/db/schema'

let pg: PGlite
let db: ReturnType<typeof drizzle>

const RESET_TABLES = [
  'developers', 'consumers', 'tools', 'api_keys', 'invocations',
  'compliance_exports', 'consumer_schedules', 'developer_api_keys',
  'webhook_endpoints', 'audit_logs', 'tool_reviews', 'waitlist_signups',
  'conversion_events',
]

// Fixed UUIDs / ids for legibility.
const AUTH = 'auth-user-shared-1'
const DEV = '00000000-0000-0000-0000-0000000000a1'
const CON = '00000000-0000-0000-0000-0000000000b1'
const TOOL = '00000000-0000-0000-0000-0000000000c1'
const KEY = '00000000-0000-0000-0000-0000000000d1'
const INV = '00000000-0000-0000-0000-0000000000e1'

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()
  holder.db = db
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(async () => {
  vi.clearAllMocks()
  mockAuthUserDelete.mockResolvedValue(undefined)
  authState.user = null
  await pg.exec(`TRUNCATE ${RESET_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
})

function delReq(body: unknown = { confirm: 'DELETE' }, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/consumer/account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': '203.0.113.5',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/consumer/account — the consumer erasure door drives the unified pipeline', () => {
  it('erases BOTH twin halves: the consumer + the developer are anonymized, the shared auth user is deleted, keys revoked + invocations survive', async () => {
    // A developer + consumer TWIN sharing one Supabase auth user and one email.
    await db.insert(schema.developers).values({ id: DEV, email: 'twin@x.com', name: 'Twin', supabaseUserId: AUTH })
    await db.insert(schema.consumers).values({ id: CON, email: 'twin@x.com', supabaseUserId: AUTH })
    await db.insert(schema.tools).values({ id: TOOL, developerId: DEV, name: 'Tool', slug: 'twin-tool' })
    await db.insert(schema.apiKeys).values({
      id: KEY, consumerId: CON, toolId: TOOL, keyHash: 'h-twin', keyPrefix: 'sg_twin', status: 'active', ipAllowlist: ['10.0.0.1'],
    })
    await db.insert(schema.invocations).values({
      id: INV, toolId: TOOL, consumerId: CON, apiKeyId: KEY, method: 'POST', costCents: 5, metadata: { payer: '0xtwin' },
    })

    // OAuth identity (no 'email' identity, no verified MFA) → step-up ACCEPTs on
    // session + same-origin + typed confirm.
    authState.user = { id: AUTH, email: 'twin@x.com', identities: [{ provider: 'github' }] }

    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')

    // BOTH halves anonymized-in-place (the developer row is the one processDataDeletion targets).
    const [dev] = await db.select().from(schema.developers).where(eq(schema.developers.id, DEV))
    expect(dev.email).toBe(`deleted-${DEV}@deleted.settlegrid.ai`)
    expect(dev.supabaseUserId).toBeNull()
    const [con] = await db.select().from(schema.consumers).where(eq(schema.consumers.id, CON))
    expect(con.email).toBe(`deleted-${CON}@deleted.settlegrid.ai`)
    expect(con.supabaseUserId).toBeNull()

    // The shared Supabase auth user was hard-deleted exactly once (deduped).
    expect(mockAuthUserDelete).toHaveBeenCalledWith(AUTH)
    expect(mockAuthUserDelete).toHaveBeenCalledTimes(1)

    // Revoke-not-delete: the key survives (revoked) and the invocation is NOT cascade-killed.
    const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, KEY))
    expect(key.status).toBe('revoked')
    expect(key.ipAllowlist).toBeNull()
    expect((await db.select().from(schema.invocations).where(eq(schema.invocations.toolId, TOOL))).length).toBe(1)

    // A completed data-deletion compliance row was written for the developer twin.
    const [exp] = await db.select().from(schema.complianceExports).where(eq(schema.complianceExports.entityId, DEV))
    expect(exp.requestType).toBe('data-deletion')
    expect(exp.status).toBe('completed')
  }, 30_000)

  it('FOLD 6 (partial-callback edge): a consumer with NO developer row is NOT 404\'d — the door ensures the dev row then erases both halves', async () => {
    // Only a consumer exists (the auth/callback developer-branch insert failed).
    await db.insert(schema.consumers).values({ id: CON, email: 'lonely@x.com', supabaseUserId: AUTH })
    expect((await db.select().from(schema.developers)).length).toBe(0)

    authState.user = { id: AUTH, email: 'lonely@x.com', identities: [{ provider: 'github' }] }

    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    const body = await res.json()
    // Not 404 — the erasure right is honored for this cohort.
    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')

    // The door ENSURED a developer row (keyed to the consumer's email) and the
    // pipeline anonymized it + the consumer, and deleted the shared auth user.
    const devs = await db.select().from(schema.developers)
    expect(devs.length).toBe(1)
    expect(devs[0].email).toMatch(/^deleted-.*@deleted\.settlegrid\.ai$/)
    const [con] = await db.select().from(schema.consumers).where(eq(schema.consumers.id, CON))
    expect(con.email).toBe(`deleted-${CON}@deleted.settlegrid.ai`)
    expect(mockAuthUserDelete).toHaveBeenCalledWith(AUTH)
  }, 30_000)

  it('STEP-UP IS ENFORCED: a password account with no password → REAUTH_REQUIRED and the scrub does NOT run', async () => {
    await db.insert(schema.developers).values({ id: DEV, email: 'pw@x.com', name: 'PW', supabaseUserId: AUTH })
    await db.insert(schema.consumers).values({ id: CON, email: 'pw@x.com', supabaseUserId: AUTH })
    // A password ('email') identity → verifyStepUp REQUIRES a password.
    authState.user = { id: AUTH, email: 'pw@x.com', identities: [{ provider: 'email' }] }

    const res = await DELETE(delReq({ confirm: 'DELETE' })) // no password supplied
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('REAUTH_REQUIRED')

    // The developer + consumer are UNTOUCHED — the door did not reach the pipeline.
    const [dev] = await db.select().from(schema.developers).where(eq(schema.developers.id, DEV))
    expect(dev.email).toBe('pw@x.com')
    expect(mockAuthUserDelete).not.toHaveBeenCalled()
  }, 30_000)

  it('rejects a cross-site request (CSRF) with 403 before authenticating', async () => {
    const res = await DELETE(delReq({ confirm: 'DELETE' }, { 'sec-fetch-site': 'cross-site' }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('CSRF_REJECTED')
    expect(mockAuthUserDelete).not.toHaveBeenCalled()
  })

  it('401 when the request is not an authenticated consumer', async () => {
    authState.user = null // no session
    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('422 when the confirmation string is not exactly DELETE', async () => {
    await db.insert(schema.consumers).values({ id: CON, email: 'c@x.com', supabaseUserId: AUTH })
    authState.user = { id: AUTH, email: 'c@x.com', identities: [{ provider: 'github' }] }
    const res = await DELETE(delReq({ confirm: 'delete' }))
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.code).toBe('CONFIRMATION_REQUIRED')
    expect(mockAuthUserDelete).not.toHaveBeenCalled()
  })

  it('CROSS-IDENTITY GUARD: a consumer whose email matches a developer row bound to a DIFFERENT auth user is NOT erased (409) — the victim developer is untouched', async () => {
    // A VICTIM developer owns a live account under their OWN Supabase auth user.
    await db.insert(schema.developers).values({ id: DEV, email: 'victim@x.com', name: 'Victim', supabaseUserId: 'auth-victim' })
    // The CALLER (attacker) is an authenticated consumer whose email COLLIDES with
    // the victim's (only reachable under a Supabase email-confirmation misconfig /
    // an IdP returning an unverified email) AND — the FOLD-6 window — has NO
    // developer row of their own (dev-branch callback insert failed).
    await db.insert(schema.consumers).values({ id: CON, email: 'victim@x.com', supabaseUserId: AUTH })
    authState.user = { id: AUTH, email: 'victim@x.com', identities: [{ provider: 'github' }] }

    const res = await DELETE(delReq({ confirm: 'DELETE' }))
    const body = await res.json()

    // The door REFUSES: it must NEVER relink+erase a different subject's account.
    // "Art.17 never blocks" governs the caller's OWN erasure, not a foreign one.
    expect(res.status).toBe(409)
    expect(body.code).toBe('ACCOUNT_RESOLUTION_CONFLICT')

    // The victim developer row is UNTOUCHED — original email + original auth link.
    const [victim] = await db.select().from(schema.developers).where(eq(schema.developers.id, DEV))
    expect(victim.email).toBe('victim@x.com')
    expect(victim.supabaseUserId).toBe('auth-victim')
    // No auth user was deleted (neither the victim's nor the shared one).
    expect(mockAuthUserDelete).not.toHaveBeenCalled()
  }, 30_000)
})
