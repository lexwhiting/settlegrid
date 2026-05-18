import { describe, it, expect } from 'vitest'
import {
  parseMonetizationDocPriceCents,
  applyPricingToManifest,
} from './sync-template-pricing'

// ── parseMonetizationDocPriceCents ──────────────────────────────────────────

describe('parseMonetizationDocPriceCents', () => {
  it('reads the price from the Revenue Examples header (1¢)', () => {
    const md = '# Guide\n\n## Revenue Examples (at $0.01 / call)\n\n| ... |\n'
    expect(parseMonetizationDocPriceCents(md)).toBe(1)
  })

  it('reads the price from the Revenue Examples header (2¢)', () => {
    const md = '## Revenue Examples (at $0.02 / call)\n'
    expect(parseMonetizationDocPriceCents(md)).toBe(2)
  })

  it('reads a multi-cent price (8¢)', () => {
    expect(
      parseMonetizationDocPriceCents('## Revenue Examples (at $0.08 / call)'),
    ).toBe(8)
  })

  it('returns null when the header is absent', () => {
    expect(parseMonetizationDocPriceCents('# Guide\n\nno header here')).toBeNull()
  })
})

// ── applyPricingToManifest ──────────────────────────────────────────────────

describe('applyPricingToManifest', () => {
  const baseManifest = {
    slug: 'tmdb',
    name: 'TMDB',
    pricing: { model: 'per-call', perCallUsdCents: 1 },
    capabilities: ['search-movies'],
    featured: false,
  }

  it('reprices perCallUsdCents and adds the methods map', () => {
    const out = applyPricingToManifest(baseManifest, {
      defaultCostCents: 2,
      methods: {
        search_movies: { costCents: 2, displayName: 'Search Movies' },
      },
    })
    expect(out.pricing).toEqual({
      model: 'per-call',
      perCallUsdCents: 2,
      methods: { search_movies: { costCents: 2, displayName: 'Search Movies' } },
    })
  })

  it('omits methods when the server pricing has none', () => {
    const out = applyPricingToManifest(baseManifest, { defaultCostCents: 3 })
    expect(out.pricing).toEqual({ model: 'per-call', perCallUsdCents: 3 })
  })

  it('preserves an existing currency field and pricing key order', () => {
    const withCurrency = {
      ...baseManifest,
      pricing: { model: 'per-call', perCallUsdCents: 1, currency: 'USD' },
    }
    const out = applyPricingToManifest(withCurrency, {
      defaultCostCents: 2,
      methods: { m: { costCents: 2 } },
    })
    // Field order follows the templateManifestSchema declaration.
    expect(Object.keys(out.pricing as object)).toEqual([
      'model',
      'perCallUsdCents',
      'currency',
      'methods',
    ])
  })

  it('preserves every other manifest field and top-level key order', () => {
    const out = applyPricingToManifest(baseManifest, { defaultCostCents: 2 })
    expect(out.slug).toBe('tmdb')
    expect(out.name).toBe('TMDB')
    expect(out.capabilities).toEqual(['search-movies'])
    expect(out.featured).toBe(false)
    expect(Object.keys(out)).toEqual([
      'slug',
      'name',
      'pricing',
      'capabilities',
      'featured',
    ])
  })

  it('does not mutate the input manifest', () => {
    const input = { ...baseManifest, pricing: { ...baseManifest.pricing } }
    applyPricingToManifest(input, { defaultCostCents: 9 })
    expect(input.pricing.perCallUsdCents).toBe(1)
  })
})
