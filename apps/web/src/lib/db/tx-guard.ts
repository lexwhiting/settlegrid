import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Transaction re-entry guard for the shared `db`.
 *
 * The shared postgres-js client has one connection per serverless instance
 * (Supabase transaction pooler). `db.transaction(cb)` holds that connection until
 * `cb` settles, so a query on the shared `db` awaited inside `cb` would wait for
 * the connection the transaction itself holds, and the request would hang.
 *
 * `guardTransactions` makes that mistake fail fast instead: while a callback of
 * `db.transaction` is running, any use of the guarded `db` (a query, `db.query`,
 * a nested `db.transaction`) throws `GlobalDbInTransactionError`, which rolls the
 * transaction back. Code inside a transaction uses its `tx` handle, which is not
 * guarded. Work started inside the callback but run after it settles is allowed,
 * and other requests running at the same time are unaffected (the scope is
 * per async context).
 */

type Scope = { active: boolean }
const scope = new AsyncLocalStorage<Scope>()

export class GlobalDbInTransactionError extends Error {
  constructor(prop: string) {
    super(
      `The shared db (db.${prop}) was used inside db.transaction(). Use the transaction handle instead: ` +
        'with one connection per instance, the shared db waits for the connection the transaction holds.',
    )
    this.name = 'GlobalDbInTransactionError'
  }
}

export function insideTransaction(): boolean {
  return scope.getStore()?.active === true
}

export function guardTransactions<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, prop) {
      const value = Reflect.get(t, prop, t)
      if (typeof prop !== 'string') return value
      if (insideTransaction()) throw new GlobalDbInTransactionError(prop)
      if (prop === 'transaction' && typeof value === 'function') {
        return (callback: (tx: unknown) => unknown, ...rest: unknown[]) =>
          (value as (cb: (tx: unknown) => unknown, ...r: unknown[]) => unknown).call(
            t,
            async (tx: unknown) => {
              const s: Scope = { active: true }
              try {
                return await scope.run(s, () => callback(tx))
              } finally {
                s.active = false
              }
            },
            ...rest,
          )
      }
      return value
    },
  })
}
