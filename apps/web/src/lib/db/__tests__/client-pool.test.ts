import { describe, it, expect, vi } from 'vitest'

// Production DATABASE_URL moves to Supabase's transaction pooler (port 6543), which
// cannot hold named prepared statements across transactions. Keep the shared
// postgres-js client pooler-safe: prepare off, a small pool, short idle timeout.
const postgresMock = vi.hoisted(() => vi.fn(() => ({ end: vi.fn() })))
vi.mock('postgres', () => ({ default: postgresMock }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({ select: vi.fn() })) }))
vi.mock('../../env', () => ({ getDatabaseUrl: () => 'postgres://user:pw@db.example.com:6543/postgres' }))

describe('shared db client (transaction pooler)', () => {
  it('creates one client, lazily, with pooler-safe options', async () => {
    const { db } = await import('../index')
    expect(postgresMock).not.toHaveBeenCalled()

    void db.select
    void db.select
    expect(postgresMock).toHaveBeenCalledTimes(1)

    const calls = postgresMock.mock.calls as unknown as Array<[string, Record<string, unknown>]>
    const opts = calls[0][1]
    expect(opts.prepare).toBe(false)
    expect(opts.max as number).toBeLessThanOrEqual(3)
    expect(opts.idle_timeout).toBeGreaterThan(0)
    expect(opts.idle_timeout as number).toBeLessThanOrEqual(10)
  })
})
