import { describe, it, expect } from 'vitest'
import {
  getTemplateBySlug,
  listCategories,
  listTags,
  sortTemplates,
  filterTemplates,
  type RegistryJson,
  type TemplateManifest,
} from '@/lib/registry'

// ── Fixture ────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<TemplateManifest> = {}): TemplateManifest {
  return {
    slug: 'test-api',
    name: 'Test API',
    description: 'A test template.',
    version: '1.0.0',
    category: 'devtools',
    tags: ['test', 'api'],
    author: { name: 'Test' },
    repo: { type: 'git', url: 'https://github.com/test/test' },
    runtime: 'node',
    languages: ['ts'],
    entry: 'src/index.ts',
    pricing: { model: 'per-call', perCallUsdCents: 1, currency: 'USD' },
    quality: { tests: false },
    capabilities: ['search'],
    featured: false,
    ...overrides,
  }
}

function makeRegistry(templates: TemplateManifest[]): RegistryJson {
  const categories: Record<string, number> = {}
  for (const t of templates) {
    categories[t.category] = (categories[t.category] ?? 0) + 1
  }
  return {
    version: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    commit: 'abc123',
    totalTemplates: templates.length,
    categories,
    templates,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registry', () => {
  const alpha = makeTemplate({ slug: 'alpha', name: 'Alpha', category: 'data', tags: ['data', 'api'] })
  const beta = makeTemplate({ slug: 'beta', name: 'Beta', category: 'devtools', tags: ['dev', 'cli'], trendingRank: 2 })
  const gamma = makeTemplate({ slug: 'gamma', name: 'Gamma', category: 'data', tags: ['data', 'stream'], trendingRank: 1 })
  const registry = makeRegistry([alpha, beta, gamma])

  describe('getTemplateBySlug', () => {
    it('returns matching template (with explicit registry)', () => {
      expect(getTemplateBySlug('beta', registry)).toBe(beta)
    })

    it('returns undefined for unknown slug', () => {
      expect(getTemplateBySlug('nonexistent', registry)).toBeUndefined()
    })
  })

  describe('listCategories', () => {
    it('returns categories sorted by count descending', () => {
      const cats = listCategories(registry)
      expect(cats).toEqual([
        { name: 'data', count: 2 },
        { name: 'devtools', count: 1 },
      ])
    })
  })

  describe('listTags', () => {
    it('returns all unique tags sorted', () => {
      const tags = listTags(undefined, registry)
      expect(tags).toEqual(['api', 'cli', 'data', 'dev', 'stream'])
    })

    it('filters tags by category', () => {
      const tags = listTags('data', registry)
      expect(tags).toEqual(['api', 'data', 'stream'])
    })
  })

  describe('sortTemplates', () => {
    it('sorts by trendingRank ascending, then name', () => {
      const sorted = sortTemplates([alpha, beta, gamma])
      expect(sorted.map((t) => t.slug)).toEqual(['gamma', 'beta', 'alpha'])
    })
  })

  describe('filterTemplates', () => {
    it('filters by category', () => {
      const result = filterTemplates(registry.templates, { category: 'data' })
      expect(result.map((t) => t.slug)).toEqual(['alpha', 'gamma'])
    })

    it('filters by tags', () => {
      const result = filterTemplates(registry.templates, { tags: ['cli'] })
      expect(result.map((t) => t.slug)).toEqual(['beta'])
    })

    it('combines category + tags', () => {
      const result = filterTemplates(registry.templates, {
        category: 'data',
        tags: ['stream'],
      })
      expect(result.map((t) => t.slug)).toEqual(['gamma'])
    })

    it('returns all when no filters applied', () => {
      const result = filterTemplates(registry.templates, {})
      expect(result).toHaveLength(3)
    })
  })
})
