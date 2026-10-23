/**
 * Developer slug helpers: generation from the name (never the email), reserved and length
 * rules, collisions (pre-checked and unique-constraint races), and leaving
 * existing slugs untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { mockDb, selectResults, updateResults, setCalls } = vi.hoisted(() => {
  const selectResults: unknown[] = []
  const updateResults: unknown[] = []
  const setCalls: Record<string, unknown>[] = []
  const lazy = (queue: unknown[]) => {
    const next = () => {
      const value = queue.shift()
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
    }
    return next
  }
  const nextSelect = lazy(selectResults)
  const nextUpdate = lazy(updateResults)
  const mockDb = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => nextSelect(),
          then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => nextSelect().then(res, rej),
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        setCalls.push(values)
        return {
          where: () => ({
            returning: () => nextUpdate(),
            then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(undefined).then(res, rej),
          }),
        }
      },
    })),
  }
  return { mockDb, selectResults, updateResults, setCalls }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', name: 'name', slug: 'slug', email: 'email' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ inArray: [a, b] })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  baseDeveloperSlug,
  developerSlugCandidates,
  ensureDeveloperSlug,
  slugifyDeveloperName,
  DEVELOPER_SLUG_REGEX,
  DEVELOPER_SLUG_MAX_LENGTH,
} from '../developer-slug'
import { inArray } from 'drizzle-orm'

function uniqueViolation(): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectResults.length = 0
  updateResults.length = 0
  setCalls.length = 0
})

describe('slug generation', () => {
  it('lowercases, strips accents and hyphenates', () => {
    expect(slugifyDeveloperName('  José  Álvarez_Núñez!! ')).toBe('jose-alvarez-nunez')
    expect(slugifyDeveloperName('ACME Labs, Inc.')).toBe('acme-labs-inc')
    expect(slugifyDeveloperName('日本')).toBe('')
  })

  it('caps the length and never ends with a hyphen', () => {
    const slug = slugifyDeveloperName('a'.repeat(29) + ' bcdef')
    expect(slug.length).toBeLessThanOrEqual(DEVELOPER_SLUG_MAX_LENGTH)
    expect(slug).toMatch(DEVELOPER_SLUG_REGEX)
  })

  it('uses the name, else "developer" (never the email address)', () => {
    expect(baseDeveloperSlug('Jane Doe')).toBe('jane-doe')
    expect(baseDeveloperSlug(null)).toBe('developer')
    expect(baseDeveloperSlug('日本')).toBe('developer')
  })

  it('does not hand out reserved slugs', () => {
    expect(baseDeveloperSlug('Admin')).toBe('admin-dev')
    expect(baseDeveloperSlug('SettleGrid System')).toBe('settlegrid-system-dev')
  })

  it('numbered then random candidates, all valid and within the length limit', () => {
    const candidates = developerSlugCandidates('a'.repeat(DEVELOPER_SLUG_MAX_LENGTH))
    expect(candidates[0]).toBe('a'.repeat(DEVELOPER_SLUG_MAX_LENGTH))
    expect(candidates[1]).toBe(`${'a'.repeat(DEVELOPER_SLUG_MAX_LENGTH - 2)}-2`)
    expect(candidates.length).toBe(9)
    for (const c of candidates) {
      expect(c.length).toBeLessThanOrEqual(DEVELOPER_SLUG_MAX_LENGTH)
      expect(c).toMatch(DEVELOPER_SLUG_REGEX)
    }
  })
})

describe('ensureDeveloperSlug', () => {
  it('assigns the base slug when it is free', async () => {
    selectResults.push([{ name: 'Jane Doe', slug: null, email: 'jane@example.com' }], [])
    updateResults.push([{ slug: 'jane-doe' }])

    await expect(ensureDeveloperSlug('dev-1')).resolves.toEqual({ slug: 'jane-doe', name: 'Jane Doe' })
    expect(setCalls).toEqual([expect.objectContaining({ slug: 'jane-doe' })])
  })

  it('appends -2 when the base slug is taken', async () => {
    selectResults.push([{ name: 'Jane Doe', slug: null, email: 'jane@example.com' }], [{ slug: 'jane-doe' }])
    updateResults.push([{ slug: 'jane-doe-2' }])

    const result = await ensureDeveloperSlug('dev-1')

    expect(result.slug).toBe('jane-doe-2')
    expect(inArray).toHaveBeenCalledWith('slug', expect.arrayContaining(['jane-doe', 'jane-doe-2']))
  })

  it('moves to the next candidate when the update hits the unique constraint', async () => {
    selectResults.push([{ name: 'Jane Doe', slug: null, email: 'jane@example.com' }], [])
    updateResults.push(uniqueViolation(), [{ slug: 'jane-doe-2' }])

    const result = await ensureDeveloperSlug('dev-1')

    expect(result.slug).toBe('jane-doe-2')
    expect(setCalls.map((s) => s.slug)).toEqual(['jane-doe', 'jane-doe-2'])
  })

  it('keeps a slug set concurrently by another request', async () => {
    selectResults.push(
      [{ name: 'Jane Doe', slug: null, email: 'jane@example.com' }],
      [],
      [{ slug: 'chosen-in-settings' }],
    )
    updateResults.push([]) // WHERE slug IS NULL matched nothing

    await expect(ensureDeveloperSlug('dev-1')).resolves.toEqual({ slug: 'chosen-in-settings', name: 'Jane Doe' })
  })

  it('leaves an existing slug and name untouched', async () => {
    selectResults.push([{ name: 'Jane', slug: 'janes-tools', email: 'jane@example.com' }])

    await expect(ensureDeveloperSlug('dev-1')).resolves.toEqual({ slug: 'janes-tools', name: 'Jane' })
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('never fills a missing display name from the email address', async () => {
    selectResults.push([{ name: null, slug: 'existing', email: 'jane.doe@example.com' }])

    await expect(ensureDeveloperSlug('dev-1')).resolves.toEqual({ slug: 'existing', name: null })
    expect(setCalls).toEqual([])
  })

  it('gives a nameless developer a neutral slug, not one from the email', async () => {
    selectResults.push([{ name: null, slug: null, email: 'jane.doe@example.com' }], [])
    updateResults.push([{ slug: 'developer' }])

    const result = await ensureDeveloperSlug('dev-1')
    expect(result).toEqual({ slug: 'developer', name: null })
    expect(setCalls).toEqual([expect.objectContaining({ slug: 'developer' })])
    expect(JSON.stringify(setCalls)).not.toContain('jane')
  })

  it('never touches the system principal', async () => {
    selectResults.push([{ name: null, slug: 'settlegrid-system', email: 'system@settlegrid.ai' }])

    await ensureDeveloperSlug('dev-sys')

    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('does not throw when the database fails', async () => {
    selectResults.push(new Error('db down'))

    await expect(ensureDeveloperSlug('dev-1')).resolves.toEqual({ slug: null, name: null })
  })

  it('auth/callback assigns a slug right after creating the developer row', () => {
    const src = readFileSync(resolve(__dirname, '../../app/auth/callback/route.ts'), 'utf8')
    const insertAt = src.indexOf('db.insert(developers)')
    const ensureAt = src.indexOf('ensureDeveloperSlug(developerId)')
    expect(insertAt).toBeGreaterThan(-1)
    expect(ensureAt).toBeGreaterThan(insertAt)
  })
})
