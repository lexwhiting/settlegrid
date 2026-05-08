/**
 * P5.4 — history.ts unit tests.
 *
 * Spec checks:
 *   - history file empty / missing → readHistory returns []
 *   - readHistory throws on malformed JSON or invalid entries
 *     (NOT silently drops — silent drop would re-feature a slug)
 *   - appendHistory sorts by featuredAt ascending so git diff stays clean
 *   - recentlyFeaturedSlugs blocks within window, unblocks outside
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  RECENCY_BLOCK_WEEKS,
  appendHistory,
  readHistory,
  recentlyFeaturedSlugs,
} from '../history'

let dir: string
let path: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'totw-history-'))
  path = join(dir, 'history.json')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('readHistory', () => {
  it('returns [] when file is missing', async () => {
    expect(await readHistory(path)).toEqual([])
  })

  it('returns [] when file is empty / whitespace', async () => {
    await writeFile(path, '   \n   \n  ', 'utf-8')
    expect(await readHistory(path)).toEqual([])
  })

  it('parses a well-formed history', async () => {
    await writeFile(
      path,
      JSON.stringify([
        { slug: 'stripe', featuredAt: '2026-04-07', score: 50 },
        { slug: 'github', featuredAt: '2026-04-14', score: 80 },
      ]),
      'utf-8',
    )
    const h = await readHistory(path)
    expect(h).toEqual([
      { slug: 'stripe', featuredAt: '2026-04-07', score: 50 },
      { slug: 'github', featuredAt: '2026-04-14', score: 80 },
    ])
  })

  it('throws on non-array root', async () => {
    await writeFile(path, JSON.stringify({ slugs: [] }), 'utf-8')
    await expect(readHistory(path)).rejects.toThrow(/expected array/)
  })

  it('throws on malformed JSON (NEVER silently drops — re-feature risk)', async () => {
    await writeFile(path, '[{not valid json', 'utf-8')
    await expect(readHistory(path)).rejects.toThrow()
  })

  it('throws on entry with missing slug', async () => {
    await writeFile(
      path,
      JSON.stringify([{ featuredAt: '2026-04-07', score: 50 }]),
      'utf-8',
    )
    await expect(readHistory(path)).rejects.toThrow(/slug/)
  })

  it('throws on entry with bad date format', async () => {
    await writeFile(
      path,
      JSON.stringify([{ slug: 's', featuredAt: '4/7/2026', score: 50 }]),
      'utf-8',
    )
    await expect(readHistory(path)).rejects.toThrow(/featuredAt/)
  })

  it('throws on entry with non-finite score', async () => {
    await writeFile(
      path,
      JSON.stringify([{ slug: 's', featuredAt: '2026-04-07', score: 'fifty' }]),
      'utf-8',
    )
    await expect(readHistory(path)).rejects.toThrow(/score/)
  })
})

describe('appendHistory', () => {
  it('appends to an empty file', async () => {
    const next = await appendHistory(path, {
      slug: 's',
      featuredAt: '2026-04-07',
      score: 10,
    })
    expect(next).toEqual([{ slug: 's', featuredAt: '2026-04-07', score: 10 }])
    const onDisk = JSON.parse(await readFile(path, 'utf-8'))
    expect(onDisk).toEqual(next)
  })

  it('preserves prior entries and sorts by featuredAt ascending', async () => {
    await writeFile(
      path,
      JSON.stringify([{ slug: 'a', featuredAt: '2026-04-21', score: 5 }]),
      'utf-8',
    )
    await appendHistory(path, { slug: 'b', featuredAt: '2026-04-07', score: 3 })
    const onDisk = JSON.parse(await readFile(path, 'utf-8')) as Array<{
      featuredAt: string
    }>
    expect(onDisk.map((e) => e.featuredAt)).toEqual(['2026-04-07', '2026-04-21'])
  })

  it('rejects an invalid entry without writing anything', async () => {
    await writeFile(
      path,
      JSON.stringify([{ slug: 'a', featuredAt: '2026-04-07', score: 5 }]),
      'utf-8',
    )
    await expect(
      appendHistory(path, {
        slug: 'b',
        featuredAt: 'not a date',
        score: 1,
      }),
    ).rejects.toThrow(/featuredAt/)
    // File should still be untouched (read it back, confirm).
    const after = JSON.parse(await readFile(path, 'utf-8'))
    expect(after).toEqual([{ slug: 'a', featuredAt: '2026-04-07', score: 5 }])
  })

  it('writes a trailing newline (deterministic git diff)', async () => {
    await appendHistory(path, { slug: 's', featuredAt: '2026-04-07', score: 10 })
    const onDisk = await readFile(path, 'utf-8')
    expect(onDisk.endsWith('\n')).toBe(true)
  })
})

describe('recentlyFeaturedSlugs', () => {
  const today = new Date('2026-05-12T00:00:00Z')

  it('blocks slugs featured within the recency window', () => {
    const recent = new Date(today)
    recent.setUTCDate(recent.getUTCDate() - (RECENCY_BLOCK_WEEKS - 1) * 7)
    const recentDate = recent.toISOString().slice(0, 10)
    const history = [
      { slug: 'recent-slug', featuredAt: recentDate, score: 10 },
    ]
    const blocked = recentlyFeaturedSlugs(history, today)
    expect(blocked.has('recent-slug')).toBe(true)
  })

  it('allows slugs older than the recency window', () => {
    const older = new Date(today)
    older.setUTCDate(older.getUTCDate() - (RECENCY_BLOCK_WEEKS + 2) * 7)
    const olderDate = older.toISOString().slice(0, 10)
    const history = [{ slug: 'older-slug', featuredAt: olderDate, score: 10 }]
    const blocked = recentlyFeaturedSlugs(history, today)
    expect(blocked.has('older-slug')).toBe(false)
  })

  it('handles empty history', () => {
    expect(recentlyFeaturedSlugs([], today).size).toBe(0)
  })

  it('window is configurable', () => {
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14)
    const history = [
      {
        slug: 'two-weeks-ago',
        featuredAt: twoWeeksAgo.toISOString().slice(0, 10),
        score: 10,
      },
    ]
    expect(recentlyFeaturedSlugs(history, today, 1).has('two-weeks-ago')).toBe(false)
    expect(recentlyFeaturedSlugs(history, today, 4).has('two-weeks-ago')).toBe(true)
  })

  it('boundary: a slug featured exactly windowWeeks-old IS still blocked', () => {
    // recentlyFeaturedSlugs uses entryMs >= cutoffMs, so the cutoff is
    // inclusive of the boundary day. A slug featured exactly N weeks
    // ago should remain blocked (we err on the side of waiting one
    // more week rather than re-featuring on the dot).
    const exactly = new Date(today)
    exactly.setUTCDate(exactly.getUTCDate() - RECENCY_BLOCK_WEEKS * 7)
    const exactlyDate = exactly.toISOString().slice(0, 10)
    const history = [{ slug: 'edge', featuredAt: exactlyDate, score: 10 }]
    expect(recentlyFeaturedSlugs(history, today).has('edge')).toBe(true)
  })
})
