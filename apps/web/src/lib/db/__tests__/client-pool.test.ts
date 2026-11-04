import { describe, it, expect, vi } from 'vitest'

// The shared postgres-js client must stay safe for Supabase's transaction pooler
// (Production DATABASE_URL, port 6543): one connection per serverless instance,
// no named prepared statements, and idle connections released quickly.
const postgresMock = vi.hoisted(() => vi.fn(() => ({ end: vi.fn() })))
vi.mock('postgres', () => ({ default: postgresMock }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({ select: vi.fn() })) }))
vi.mock('../../env', () => ({ getDatabaseUrl: () => 'postgres://user:pw@db.example.com:6543/postgres' }))

describe('shared db client (transaction pooler)', () => {
  it('creates exactly one client, lazily, with pooler-safe options', async () => {
    const { db } = await import('../index')
    expect(postgresMock).not.toHaveBeenCalled()

    void db.select
    void db.select
    expect(postgresMock).toHaveBeenCalledTimes(1)

    const calls = postgresMock.mock.calls as unknown as Array<[string, Record<string, unknown>]>
    const [url, opts] = calls[0]
    expect(url).toBe('postgres://user:pw@db.example.com:6543/postgres')
    expect(opts.max).toBe(1)
    expect(opts.prepare).toBe(false)
    expect(opts.idle_timeout).toBeGreaterThan(0)
    expect(opts.idle_timeout as number).toBeLessThanOrEqual(10)
  })
})
