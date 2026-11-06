/**
 * Real-Postgres (pglite) integration coverage for the one-connection pool.
 *
 * The shared `db` (lib/db/index.ts) is wrapped in guardTransactions: using it
 * inside one of its own transactions throws instead of waiting for the single
 * connection the transaction holds. Here the same guard wraps a pglite-backed
 * drizzle db, and real money and account transactions run through it:
 *  - postLedgerEntry (double-entry ledger with optimistic locking),
 *  - grantFoundingMemberIfEligible (advisory-locked count-then-grant).
 * If either used the shared db inside its transaction, it would throw
 * GlobalDbInTransactionError here. A control shows that misuse does throw and
 * that the transaction rolls back.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'

const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
vi.mock('@/lib/db', async () => {
  const { guardTransactions } = await import('@/lib/db/tx-guard')
  return {
    db: guardTransactions(
      new Proxy(
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
    ),
  }
})
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { db as guardedDb } from '@/lib/db'
import { GlobalDbInTransactionError } from '@/lib/db/tx-guard'
import { postLedgerEntry } from '@/lib/settlement/ledger'
import { grantFoundingMemberIfEligible } from '@/lib/founding'
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

afterAll(async () => {
  await pg?.close()
})

beforeEach(async () => {
  await pg.exec('TRUNCATE "ledger_entries", "accounts", "developers" RESTART IDENTITY CASCADE')
})

async function account(type: 'customer' | 'provider', balanceCents: number) {
  const [row] = await db
    .insert(schema.accounts)
    .values({ type, entityId: `${type}-entity`, balanceCents })
    .returning({ id: schema.accounts.id })
  return row.id
}

describe('transactions through the guarded shared db (one-connection invariant)', () => {
  it('postLedgerEntry completes and moves the balances', async () => {
    const debit = await account('customer', 1000)
    const credit = await account('provider', 0)

    const out = await postLedgerEntry({
      debitAccountId: debit,
      creditAccountId: credit,
      amountCents: 250,
      category: 'metering',
      description: 'guarded transaction test',
    })

    expect(out.debitEntryId).toBeTruthy()
    expect(out.creditEntryId).toBeTruthy()
    const rows = await db.select({ id: schema.accounts.id, balance: schema.accounts.balanceCents, version: schema.accounts.version }).from(schema.accounts)
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(debit)).toMatchObject({ balance: 750, version: 1 })
    expect(byId.get(credit)).toMatchObject({ balance: 250, version: 1 })
    expect(await db.select().from(schema.ledgerEntries)).toHaveLength(2)
  })

  it('grantFoundingMemberIfEligible completes under its advisory lock', async () => {
    const [dev] = await db
      .insert(schema.developers)
      .values({ email: 'founding-test@example.com', slug: 'founding-test' })
      .returning({ id: schema.developers.id })

    await expect(grantFoundingMemberIfEligible(dev.id)).resolves.toBe('granted')
    const [row] = await db.select({ f: schema.developers.isFoundingMember }).from(schema.developers).where(eq(schema.developers.id, dev.id))
    expect(row.f).toBe(true)
    await expect(grantFoundingMemberIfEligible(dev.id)).resolves.toBe('already_member')
  })

  it('control: the shared db used inside its own transaction throws and rolls back', async () => {
    const debit = await account('customer', 1000)

    await expect(
      guardedDb.transaction(async (tx) => {
        await tx.update(schema.accounts).set({ balanceCents: 0 }).where(eq(schema.accounts.id, debit))
        await guardedDb.select().from(schema.accounts)
      }),
    ).rejects.toBeInstanceOf(GlobalDbInTransactionError)

    const [row] = await db.select({ balance: schema.accounts.balanceCents }).from(schema.accounts).where(eq(schema.accounts.id, debit))
    expect(row.balance).toBe(1000)
  })
})
