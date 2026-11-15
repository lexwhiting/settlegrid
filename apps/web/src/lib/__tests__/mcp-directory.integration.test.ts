/**
 * loadMcpDirectory against real SQL (pglite), and the bound on how long it waits.
 *
 * The table is a test-only CREATE TABLE copied from drizzle/0002_mcp_shadow_index.sql
 * (no drizzle-kit, no migrations). The reads go through the real drizzle table.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/logger', () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }))

import { loadMcpDirectory, MCP_DIRECTORY_TIMEOUT_MS } from '@/lib/mcp-directory'

const BOOTSTRAP_SQL = `
  CREATE TABLE mcp_shadow_index (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    owner text NOT NULL,
    repo text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    tags jsonb,
    stars integer,
    downloads integer,
    last_updated timestamp with time zone,
    source_url text,
    settlegrid_available boolean NOT NULL DEFAULT true,
    indexed_at timestamp with time zone NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX mcp_shadow_source_owner_repo_idx ON mcp_shadow_index (source, owner, repo);
  INSERT INTO mcp_shadow_index (source, owner, repo, name, stars) VALUES
    ('github', 'bob', 'weather', 'Weather', 120),
    ('npm', 'bob', 'weather', 'Weather (npm)', 80),
    ('github', 'alice', 'search', 'Search', 900),
    ('pypi', 'carol', 'maps', 'Maps', 5);
`

let pg: PGlite

/**
 * Holds the database busy, so reads issued meanwhile stay pending until `release()`.
 * `release()` also waits for the queued reads to run, so the database is idle afterwards.
 */
function holdDatabase() {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const held = pg.transaction(async () => { await gate })
  return {
    release: async () => {
      release()
      await held
      await pg.query('SELECT 1') // queries run in order: this one runs after the queued reads
    },
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadMcpDirectory (pglite)', () => {
  it('returns the entries by stars, the entry count and the distinct owners', async () => {
    const directory = await loadMcpDirectory()
    expect(directory.entries.map((e) => [e.owner, e.repo, e.stars])).toEqual([
      ['alice', 'search', 900],
      ['bob', 'weather', 120],
      ['bob', 'weather', 80],
      ['carol', 'maps', 5],
    ])
    expect(directory.totalCount).toBe(4)
    expect(directory.owners).toEqual(['alice', 'bob', 'carol'])
    expect(mockWarn).not.toHaveBeenCalled()
  }, 20_000)

  it('returns the empty directory when the reads outlast the bound', async () => {
    const database = holdDatabase()
    try {
      const load = loadMcpDirectory(300)

      const early = await Promise.race([load.then(() => 'settled'), sleep(100).then(() => 'pending')])
      expect(early).toBe('pending') // the reads really are waiting on the database

      const outcome = await Promise.race([load, sleep(5_000).then(() => 'still pending' as const)])
      expect(outcome).toEqual({ entries: [], totalCount: 0, owners: [] })
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('mcp_directory.read_timeout', { timeoutMs: 300 })
    } finally {
      await database.release()
    }
  }, 20_000)

  it('waits 10 seconds by default', () => {
    expect(MCP_DIRECTORY_TIMEOUT_MS).toBe(10_000)
  })
})
