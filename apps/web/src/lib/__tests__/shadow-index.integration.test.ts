/**
 * Shadow-index readers against real SQL (pglite), and the bound on how long
 * they may wait.
 *
 * The /mcp directory pages read mcp_shadow_index. On 2026-11-12 these reads
 * stalled while Next.js prerendered /mcp, the page took more than 60 seconds
 * three times, and the production build failed. Every reader now returns its
 * fallback after SHADOW_READ_TIMEOUT_MS, and /mcp renders per request.
 *
 * The table is a test-only CREATE TABLE copied from drizzle/0002_mcp_shadow_index.sql
 * (no drizzle-kit, no migrations). The readers query through the real drizzle table.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/logger', () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }))

import { getAllShadowEntries, getShadowEntry, listOwners, countShadowEntries } from '@/lib/shadow-index'

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
 * Holds the database busy, so a read issued meanwhile stays pending until `release()`.
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

describe('shadow-index readers (pglite)', () => {
  it('read the table: entries by stars, one entry, distinct owners, row count', async () => {
    expect((await getAllShadowEntries(10)).map((e) => [e.owner, e.repo, e.stars])).toEqual([
      ['alice', 'search', 900],
      ['bob', 'weather', 120],
      ['bob', 'weather', 80],
      ['carol', 'maps', 5],
    ])
    expect((await getAllShadowEntries(2)).map((e) => e.stars)).toEqual([900, 120])
    expect((await getShadowEntry('bob', 'weather'))?.name).toBe('Weather')
    expect(await getShadowEntry('nobody', 'nothing')).toBeUndefined()
    expect(await listOwners()).toEqual(['alice', 'bob', 'carol'])
    expect(await countShadowEntries()).toBe(4)
    expect(mockWarn).not.toHaveBeenCalled()
  }, 20_000)

  it('return their fallbacks after 10 seconds when the database does not answer', async () => {
    const database = holdDatabase()
    try {
      const reads = Promise.all([
        getAllShadowEntries(50),
        getShadowEntry('bob', 'weather'),
        listOwners(),
        countShadowEntries(),
      ])

      const early = await Promise.race([reads.then(() => 'settled'), sleep(2_000).then(() => 'pending')])
      expect(early).toBe('pending') // the reads really are waiting on the database

      const outcome = await Promise.race([reads, sleep(13_000).then(() => 'still pending' as const)])
      expect(outcome).toEqual([[], undefined, [], 0])
      expect(mockWarn).toHaveBeenCalledTimes(4)
      for (const read of ['entries', 'entry', 'owners', 'count']) {
        expect(mockWarn).toHaveBeenCalledWith('shadow-index.query_timeout', { read, timeoutMs: 10_000 })
      }
    } finally {
      await database.release()
    }
  }, 30_000)
})

describe('/mcp directory page', () => {
  it('renders per request, so the build never runs its database reads', () => {
    const page = readFileSync(path.resolve(__dirname, '../../app/mcp/page.tsx'), 'utf8')
    expect(page).toContain("export const dynamic = 'force-dynamic'")
    expect(page).not.toContain('force-static')
  })
})
