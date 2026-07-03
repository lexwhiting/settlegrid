/**
 * ensure-twin — real-Postgres (pglite) integration tests for the self-healing
 * developer/consumer twin-row creation that repairs the auth-path invariant
 * (dashboard 401/500 when a callback-bypassing login left a rowless session).
 *
 * Uses pglite (real Postgres-in-wasm, enforces UNIQUE + ON CONFLICT) via the same
 * drizzle-kit pushSchema harness as compliance-deletion-cascade.integration.test.ts,
 * because the load-bearing property here is CONCURRENCY-SAFETY against the
 * developers.email / supabase_user_id UNIQUE constraints — invisible to a mock db.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'

const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

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
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { ensureDeveloperTwin, ensureConsumerTwin, SystemPrincipalError, TwinConflictError } from '@/lib/auth/ensure-twin'
import * as schema from '@/lib/db/schema'

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()
  holder.db = db
}, 60_000)

afterAll(async () => { await pg?.close() })

beforeEach(async () => {
  vi.clearAllMocks()
  await pg.exec('TRUNCATE "developers", "consumers" RESTART IDENTITY CASCADE')
})

// supabase_user_id is a TEXT column — any distinct string works.
const U1 = 'auth-user-1'
const U2 = 'auth-user-2'
const countDevs = async (email: string) =>
  (await db.select().from(schema.developers).where(eq(schema.developers.email, email))).length
const countCons = async (email: string) =>
  (await db.select().from(schema.consumers).where(eq(schema.consumers.email, email))).length

describe('ensureDeveloperTwin', () => {
  it('SELF-HEAL: creates the developer row when a session has none (the bug repair)', async () => {
    const r = await ensureDeveloperTwin(U1, 'new@x.com')
    expect(r.email).toBe('new@x.com')
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.id, r.id))
    expect(row.supabaseUserId).toBe(U1)
    expect(await countDevs('new@x.com')).toBe(1)
  }, 20_000)

  it('IDEMPOTENT: repeated calls return the SAME row, never a duplicate', async () => {
    const a = await ensureDeveloperTwin(U1, 'dup@x.com')
    const b = await ensureDeveloperTwin(U1, 'dup@x.com')
    expect(b.id).toBe(a.id)
    expect(await countDevs('dup@x.com')).toBe(1)
  }, 20_000)

  it('CONCURRENCY (crown jewel): N parallel first-touch calls create exactly ONE row, all return the same id, none throw', async () => {
    // The dashboard fans out ~10 parallel fetches on first paint for a rowless user.
    const results = await Promise.all(
      Array.from({ length: 12 }, () => ensureDeveloperTwin(U1, 'race@x.com')),
    )
    const ids = new Set(results.map((r) => r.id))
    expect(ids.size).toBe(1) // all converged on one row
    expect(await countDevs('race@x.com')).toBe(1) // no duplicate / no unique-violation throw
  }, 30_000)

  it('RELINK: a NULL-linked row with the same VERIFIED email is adopted (not duplicated)', async () => {
    await db.insert(schema.developers).values({ email: 'lead@x.com', name: 'Lead', supabaseUserId: null })
    const r = await ensureDeveloperTwin(U1, 'lead@x.com', { emailVerified: true })
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.id, r.id))
    expect(row.supabaseUserId).toBe(U1) // relinked
    expect(await countDevs('lead@x.com')).toBe(1) // no duplicate
  }, 20_000)

  it('SECURITY — proven-email invariant: an UNVERIFIED session may NOT adopt a pre-existing NULL-linked row', async () => {
    await db.insert(schema.developers).values({ email: 'lead@x.com', name: 'Lead', supabaseUserId: null })
    // emailVerified defaults false → refuse adoption (do not relink on an unproven email).
    await expect(ensureDeveloperTwin(U1, 'lead@x.com')).rejects.toBeInstanceOf(TwinConflictError)
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.email, 'lead@x.com'))
    expect(row.supabaseUserId).toBeNull() // NOT adopted
  }, 20_000)

  it('SECURITY — relink-race TOCTOU: if a concurrent request bound the row first, the loser throws (never returns the other identity\'s twin)', async () => {
    // Seed a NULL-linked row, then two DISTINCT verified auth users race to adopt it.
    await db.insert(schema.developers).values({ email: 'contended@x.com', supabaseUserId: null })
    const settled = await Promise.allSettled([
      ensureDeveloperTwin(U1, 'contended@x.com', { emailVerified: true }),
      ensureDeveloperTwin(U2, 'contended@x.com', { emailVerified: true }),
    ])
    const ok = settled.filter((s) => s.status === 'fulfilled')
    const rejected = settled.filter((s) => s.status === 'rejected')
    // Exactly one adopts; the other is refused (TwinConflict) — never silently handed the row.
    expect(ok.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(TwinConflictError)
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.email, 'contended@x.com'))
    expect([U1, U2]).toContain(row.supabaseUserId) // bound to exactly one of them
    expect(await countDevs('contended@x.com')).toBe(1)
  }, 30_000)

  it('SECURITY — reserved-email INSERT guard: cannot mint a fresh row bearing the system email (squat)', async () => {
    // No pre-existing system row → the by-email lookup misses → the INSERT path must
    // still refuse the reserved email (symmetry with the relink/return guards).
    await expect(ensureDeveloperTwin(U1, 'system@settlegrid.ai', { emailVerified: true })).rejects.toBeInstanceOf(SystemPrincipalError)
    await expect(ensureDeveloperTwin(U1, 'system@settlegrid.com', { emailVerified: true })).rejects.toBeInstanceOf(SystemPrincipalError)
    expect((await db.select().from(schema.developers)).length).toBe(0)
  }, 20_000)

  it('SECURITY — TwinConflict: never relink a row bound to a DIFFERENT auth user', async () => {
    await db.insert(schema.developers).values({ email: 'victim@x.com', supabaseUserId: U2 })
    await expect(ensureDeveloperTwin(U1, 'victim@x.com')).rejects.toBeInstanceOf(TwinConflictError)
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.email, 'victim@x.com'))
    expect(row.supabaseUserId).toBe(U2) // untouched
  }, 20_000)

  it('SECURITY — SystemPrincipal: never adopt the system catalog principal (by slug)', async () => {
    await db.insert(schema.developers).values({ email: 'system@settlegrid.com', slug: 'settlegrid-system', supabaseUserId: null })
    await expect(ensureDeveloperTwin(U1, 'system@settlegrid.com')).rejects.toBeInstanceOf(SystemPrincipalError)
    const [row] = await db.select().from(schema.developers).where(eq(schema.developers.slug, 'settlegrid-system'))
    expect(row.supabaseUserId).toBeNull() // NOT relinked/adopted
  }, 20_000)

  it('no auth-user email → TwinConflictError (never fabricates an empty-email row)', async () => {
    await expect(ensureDeveloperTwin(U1, null)).rejects.toBeInstanceOf(TwinConflictError)
    await expect(ensureDeveloperTwin(U1, '   ')).rejects.toBeInstanceOf(TwinConflictError)
    expect((await db.select().from(schema.developers)).length).toBe(0)
  }, 20_000)
})

describe('ensureConsumerTwin', () => {
  it('SELF-HEAL: creates the consumer row when a session has none', async () => {
    const r = await ensureConsumerTwin(U1, 'c-new@x.com')
    const [row] = await db.select().from(schema.consumers).where(eq(schema.consumers.id, r.id))
    expect(row.supabaseUserId).toBe(U1)
    expect(await countCons('c-new@x.com')).toBe(1)
  }, 20_000)

  it('CONCURRENCY: N parallel first-touch calls create exactly ONE consumer row', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => ensureConsumerTwin(U1, 'c-race@x.com')),
    )
    expect(new Set(results.map((r) => r.id)).size).toBe(1)
    expect(await countCons('c-race@x.com')).toBe(1)
  }, 30_000)

  it('RELINK the no-login LEAD cohort: a NULL-linked consumer (verified email) is adopted, preserving its balance', async () => {
    await db.insert(schema.consumers).values({ email: 'lead@x.com', supabaseUserId: null, globalBalanceCents: 2500 })
    const r = await ensureConsumerTwin(U1, 'lead@x.com', { emailVerified: true })
    const [row] = await db.select().from(schema.consumers).where(eq(schema.consumers.id, r.id))
    expect(row.supabaseUserId).toBe(U1) // relinked
    expect(row.globalBalanceCents).toBe(2500) // credit preserved
    expect(await countCons('lead@x.com')).toBe(1)
  }, 20_000)

  it('SECURITY — an UNVERIFIED session may NOT adopt a NULL-linked lead consumer row', async () => {
    await db.insert(schema.consumers).values({ email: 'lead@x.com', supabaseUserId: null, globalBalanceCents: 2500 })
    await expect(ensureConsumerTwin(U1, 'lead@x.com')).rejects.toBeInstanceOf(TwinConflictError)
    const [row] = await db.select().from(schema.consumers).where(eq(schema.consumers.email, 'lead@x.com'))
    expect(row.supabaseUserId).toBeNull()
  }, 20_000)

  it('SECURITY — reserved-email guard applies to consumers too', async () => {
    await expect(ensureConsumerTwin(U1, 'system@settlegrid.ai', { emailVerified: true })).rejects.toBeInstanceOf(SystemPrincipalError)
    expect((await db.select().from(schema.consumers)).length).toBe(0)
  }, 20_000)

  it('SECURITY — TwinConflict: never relink a consumer bound to a DIFFERENT auth user', async () => {
    await db.insert(schema.consumers).values({ email: 'c-victim@x.com', supabaseUserId: U2 })
    await expect(ensureConsumerTwin(U1, 'c-victim@x.com')).rejects.toBeInstanceOf(TwinConflictError)
    const [row] = await db.select().from(schema.consumers).where(eq(schema.consumers.email, 'c-victim@x.com'))
    expect(row.supabaseUserId).toBe(U2)
  }, 20_000)
})
