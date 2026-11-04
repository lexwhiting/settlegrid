import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { getDatabaseUrl } from '../env'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const connectionString = getDatabaseUrl()
    // One connection per serverless instance: Production connects through Supabase's
    // transaction pooler (port 6543), which multiplexes many short-lived clients, so a
    // per-instance pool only adds pooler client slots. prepare: false is required by
    // the transaction pooler (no named prepared statements across transactions).
    // Transactions use their own `tx` handle, never the global `db`, so a single
    // connection cannot deadlock a request against itself.
    const client = postgres(connectionString, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      prepare: false,
      idle_timeout: 10,
      connect_timeout: 10,
      max_lifetime: 60 * 5,
    })
    _db = drizzle(client, { schema })
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
