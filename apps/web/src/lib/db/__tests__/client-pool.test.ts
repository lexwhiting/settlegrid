import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The shared postgres-js client must stay safe for Supabase's transaction pooler
// (Production DATABASE_URL, port 6543): one connection per serverless instance at
// runtime, no named prepared statements, and idle connections released quickly.
const postgresMock = vi.hoisted(() => vi.fn(() => ({ end: vi.fn() })))
vi.mock('postgres', () => ({ default: postgresMock }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({ select: vi.fn() })) }))
vi.mock('../../env', () => ({ getDatabaseUrl: () => 'postgres://user:pw@db.example.com:6543/postgres' }))

type Opts = Record<string, unknown>
const lastOpts = (): Opts => {
  const calls = postgresMock.mock.calls as unknown as Array<[string, Opts]>
  return calls[calls.length - 1][1]
}

describe('shared db client (transaction pooler)', () => {
  const phase = process.env.NEXT_PHASE
  beforeEach(() => {
    vi.resetModules()
    postgresMock.mockClear()
    delete process.env.NEXT_PHASE
  })
  afterEach(() => {
    if (phase === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = phase
  })

  it('creates exactly one client, lazily, with pooler-safe options at runtime', async () => {
    const { db } = await import('../index')
    expect(postgresMock).not.toHaveBeenCalled()

    void db.select
    void db.select
    expect(postgresMock).toHaveBeenCalledTimes(1)

    const calls = postgresMock.mock.calls as unknown as Array<[string, Opts]>
    expect(calls[0][0]).toBe('postgres://user:pw@db.example.com:6543/postgres')
    const opts = lastOpts()
    expect(opts.max).toBe(1)
    expect(opts.prepare).toBe(false)
    expect(opts.idle_timeout).toBeGreaterThan(0)
    expect(opts.idle_timeout as number).toBeLessThanOrEqual(10)
  })

  it('keeps 3 connections only while next build renders pages', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const { db } = await import('../index')
    void db.select
    expect(lastOpts().max).toBe(3)
    expect(lastOpts().prepare).toBe(false)
  })
})
