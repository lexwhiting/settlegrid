import { describe, it, expect } from 'vitest'
import { guardTransactions, GlobalDbInTransactionError, insideTransaction } from '../tx-guard'

// A stand-in for the drizzle db: `transaction(cb)` hands cb a separate tx handle,
// like drizzle does, and records what ran where.
function fakeDb() {
  const log: string[] = []
  const tx = { select: () => (log.push('tx.select'), 'tx-row') }
  const raw = {
    select: () => (log.push('db.select'), 'db-row'),
    query: { developers: { findFirst: () => (log.push('db.query'), 'db-row') } },
    async transaction<T>(cb: (t: typeof tx) => Promise<T>): Promise<T> {
      log.push('begin')
      try {
        const out = await cb(tx)
        log.push('commit')
        return out
      } catch (e) {
        log.push('rollback')
        throw e
      }
    },
  }
  return { db: guardTransactions(raw), log }
}

describe('guardTransactions', () => {
  it('lets the shared db and the tx handle work normally', async () => {
    const { db, log } = fakeDb()
    expect(db.select()).toBe('db-row')
    const out = await db.transaction(async (tx) => tx.select())
    expect(out).toBe('tx-row')
    expect(db.select()).toBe('db-row')
    expect(log).toEqual(['db.select', 'begin', 'tx.select', 'commit', 'db.select'])
  })

  it('throws, and rolls back, when the shared db is used inside db.transaction', async () => {
    const { db, log } = fakeDb()
    await expect(
      db.transaction(async (tx) => {
        tx.select()
        return db.select()
      }),
    ).rejects.toBeInstanceOf(GlobalDbInTransactionError)
    expect(log).toEqual(['begin', 'tx.select', 'rollback'])
  })

  it('covers relational queries and nested db.transaction on the shared db', async () => {
    const { db } = fakeDb()
    await expect(db.transaction(async () => db.query.developers.findFirst())).rejects.toThrow(/db\.query/)
    await expect(db.transaction(async () => db.transaction(async () => 1))).rejects.toThrow(/db\.transaction/)
  })

  it('catches the shared db used deeper in the call chain, after an await', async () => {
    const { db } = fakeDb()
    const helper = async () => {
      await new Promise((r) => setTimeout(r, 1))
      return db.select()
    }
    await expect(db.transaction(async () => helper())).rejects.toBeInstanceOf(GlobalDbInTransactionError)
  })

  it('allows work that runs after the transaction settles, and other concurrent requests', async () => {
    const { db } = fakeDb()
    let later: Promise<string> | null = null
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))

    const inTx = db.transaction(async (tx) => {
      // started inside the callback, runs after it has settled
      later = gate.then(() => db.select())
      return tx.select()
    })
    // a concurrent request outside any transaction
    const outside = Promise.resolve().then(() => db.select())

    await expect(inTx).resolves.toBe('tx-row')
    await expect(outside).resolves.toBe('db-row')
    release()
    await expect(later).resolves.toBe('db-row')
    expect(insideTransaction()).toBe(false)
  })
})
