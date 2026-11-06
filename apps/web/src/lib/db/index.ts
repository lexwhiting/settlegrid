import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { getDatabaseUrl } from '../env'
import { guardTransactions } from './tx-guard'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const connectionString = getDatabaseUrl()
    // One connection per serverless instance: Production connects through Supabase's
    // transaction pooler (port 6543), which multiplexes many short-lived clients, so a
    // per-instance pool only adds pooler client slots. prepare: false is required by
    // the transaction pooler (no named prepared statements across transactions).
    // Code inside a transaction must use its `tx` handle: a query on the shared `db`
    // there would wait for the connection the transaction holds. guardTransactions
    // makes that fail fast (GlobalDbInTransactionError) instead of hanging; the
    // repo-wide check is __tests__/transaction-callbacks.test.ts.
    // `next build` renders many pages at once in one process; there, queries queued
    // behind a single connection hit the 60 s page timeout, so the build keeps 3.
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
    const client = postgres(connectionString, {
      max: isBuild ? 3 : 1,
      ssl: { rejectUnauthorized: false },
      prepare: false,
      idle_timeout: 10,
      connect_timeout: 10,
      max_lifetime: 60 * 5,
    })
    _db = guardTransactions(drizzle(client, { schema }))
  }
  return _db
}

// Use a Proxy to maintain the same `db` export interface while lazy-initializing
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop, receiver) {
      const realDb = getDb()
      const value = Reflect.get(realDb, prop, receiver)
      if (typeof value === 'function') {
        return value.bind(realDb)
      }
      return value
    },
  }
)

export { schema }
