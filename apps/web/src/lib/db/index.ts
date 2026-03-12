import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { getDatabaseUrl } from '../env'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const connectionString = getDatabaseUrl()
    const client = postgres(connectionString, { max: 10, ssl: 'require' })
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
