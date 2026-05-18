import { describe, it, expect } from 'vitest'
import {
  extractServerPricing,
  revenueFor,
  renderMonetizationSections,
  renderReadmeMonetization,
} from './template-pricing'

// ── extractServerPricing ────────────────────────────────────────────────────

describe('extractServerPricing', () => {
  it('extracts defaultCostCents and a multi-method block (canonical shape)', () => {
    const serverTs = `
import { settlegrid } from '@settlegrid/mcp'
const sg = settlegrid.init({
  toolSlug: 'tmdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      get_movie: { costCents: 2, displayName: 'Get Movie' },
      search_tv: { costCents: 2, displayName: 'Search TV Shows' },
    },
  },
})
`
    const pricing = extractServerPricing(serverTs)
    expect(pricing.defaultCostCents).toBe(2)
    expect(pricing.methods).toEqual({
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      get_movie: { costCents: 2, displayName: 'Get Movie' },
      search_tv: { costCents: 2, displayName: 'Search TV Shows' },
    })
  })

  it('preserves method source order', () => {
    const serverTs = `pricing: {
  defaultCostCents: 1,
  methods: {
    zebra: { costCents: 1 },
    alpha: { costCents: 1 },
    mike: { costCents: 1 },
  },
}`
    expect(Object.keys(extractServerPricing(serverTs).methods ?? {})).toEqual([
      'zebra',
      'alpha',
      'mike',
    ])
  })

  it('handles per-method cost variation and double-quoted displayName', () => {
    const serverTs = `pricing: {
  defaultCostCents: 3,
  methods: {
    take_screenshot: { costCents: 5, displayName: "Take Screenshot" },
    get_page_content: { costCents: 3, displayName: "Get Page Content" },
  },
}`
    const pricing = extractServerPricing(serverTs)
    expect(pricing.defaultCostCents).toBe(3)
    expect(pricing.methods?.take_screenshot.costCents).toBe(5)
    expect(pricing.methods?.get_page_content.displayName).toBe(
      'Get Page Content',
    )
  })

  it('handles the compact single-line pricing form', () => {
    // settlegrid-fax-api shape: `pricing: { defaultCostCents: 1, methods: {`
    const serverTs = `const sg = settlegrid.init({ toolSlug: 'fax-api', pricing: { defaultCostCents: 1, methods: {
    generate_cover_page: { costCents: 1, displayName: 'Generate Cover Page' },
    get_country_codes: { costCents: 1, displayName: 'Get Country Codes' },
  }},
})`
    const pricing = extractServerPricing(serverTs)
    expect(pricing.defaultCostCents).toBe(1)
    expect(Object.keys(pricing.methods ?? {})).toEqual([
      'generate_cover_page',
      'get_country_codes',
    ])
  })

  it('captures the optional unitType field', () => {
    const serverTs = `pricing: {
  defaultCostCents: 1,
  methods: { stream: { costCents: 1, displayName: 'Stream', unitType: 'second' } },
}`
    expect(extractServerPricing(serverTs).methods?.stream.unitType).toBe(
      'second',
    )
  })

  it('returns just defaultCostCents when there is no methods block', () => {
    const pricing = extractServerPricing('pricing: { defaultCostCents: 4 }')
    expect(pricing).toEqual({ defaultCostCents: 4 })
  })

  it('falls back to defaultCostCents 1 when no pricing block is present', () => {
    expect(extractServerPricing('const x = 1')).toEqual({ defaultCostCents: 1 })
  })

  it('is not confused by a brace inside a displayName string', () => {
    const serverTs = `pricing: {
  defaultCostCents: 1,
  methods: { weird: { costCents: 2, displayName: 'Has a } brace' } },
}`
    const pricing = extractServerPricing(serverTs)
    expect(pricing.methods?.weird).toEqual({
      costCents: 2,
      displayName: 'Has a } brace',
    })
  })
})

// ── revenueFor ──────────────────────────────────────────────────────────────

describe('revenueFor', () => {
  it('charges 0% below the $1,000/mo fee-free threshold', () => {
    const r = revenueFor(1, 1_000) // gross $10
    expect(r).toMatchObject({ grossUsd: 10, feeUsd: 0, netUsd: 10, feeApplies: false })
  })

  it('treats exactly $1,000 gross as still fee-free', () => {
    const r = revenueFor(1, 100_000) // gross $1,000
    expect(r.feeApplies).toBe(false)
    expect(r.feeUsd).toBe(0)
  })

  it('charges ~5% only on the amount above $1,000 (2¢ @ 100k calls)', () => {
    const r = revenueFor(2, 100_000) // gross $2,000
    expect(r.grossUsd).toBe(2000)
    expect(r.feeUsd).toBe(50) // (2000 - 1000) * 0.05
    expect(r.netUsd).toBe(1950)
    expect(r.feeApplies).toBe(true)
  })

  it('computes the 2¢ @ 1M-calls case (gross $20k → ~$950 fee)', () => {
    const r = revenueFor(2, 1_000_000)
    expect(r.grossUsd).toBe(20_000)
    expect(r.feeUsd).toBe(950) // (20000 - 1000) * 0.05
    expect(r.netUsd).toBe(19_050)
  })
})

// ── renderMonetizationSections ──────────────────────────────────────────────

describe('renderMonetizationSections', () => {
  it('renders the 1¢ sections with correct figures', () => {
    const md = renderMonetizationSections(1)
    expect(md).toContain('## Revenue Model')
    expect(md).toContain('| **Price per call** | $0.01 (1¢) |')
    expect(md).toContain('## Revenue Examples (at $0.01 / call)')
    expect(md).toContain('**$0** (at $1k cap)')
    expect(md).toContain('~$450 (≈5% on $9k above $1k)')
    expect(md).toContain('**~$9,550**')
  })

  it('renders the 2¢ sections — 100k row crosses the fee threshold', () => {
    const md = renderMonetizationSections(2)
    expect(md).toContain('| **Price per call** | $0.02 (2¢) |')
    expect(md).toContain('## Revenue Examples (at $0.02 / call)')
    expect(md).toContain('| 1,000 | $20 | **$0** (under $1k) | **$20** |')
    expect(md).toContain('| 10,000 | $200 | **$0** (under $1k) | **$200** |')
    expect(md).toContain(
      '| 100,000 | $2,000 | ~$50 (≈5% on $1k above $1k) | **~$1,950** |',
    )
    expect(md).toContain(
      '| 1,000,000 | $20,000 | ~$950 (≈5% on $19k above $1k) | **~$19,050** |',
    )
  })

  it('uses the en-dash house style for the take-rate band', () => {
    const md = renderMonetizationSections(2)
    expect(md).toContain('2–5%') // 2–5%
    expect(md).toContain('95–98%') // 95–98%
    expect(md).not.toContain('2-5%') // no ASCII hyphen
  })

  it('ends with a trailing newline and no How It Works section', () => {
    const md = renderMonetizationSections(2)
    expect(md.endsWith('|\n')).toBe(true)
    expect(md).not.toContain('## How It Works')
  })
})

// ── renderReadmeMonetization ────────────────────────────────────────────────

describe('renderReadmeMonetization', () => {
  it('renders the 1¢ README block (all rows fee-free)', () => {
    const md = renderReadmeMonetization(1)
    expect(md).toContain('At the default 1¢/call pricing')
    expect(md).toContain('| 1,000 | $10 |')
    expect(md).toContain('| 10,000 | $100 |')
    expect(md).toContain('| 100,000 | $1,000 |')
    expect(md).toContain('See [monetization.md](monetization.md)')
  })

  it('renders the 2¢ README block — 100k row crosses the threshold', () => {
    const md = renderReadmeMonetization(2)
    expect(md).toContain('At the default 2¢/call pricing')
    expect(md).toContain('| 1,000 | $20 |')
    expect(md).toContain('| 10,000 | $200 |')
    expect(md).toContain('| 100,000 | ~$1,950 |')
  })
})
