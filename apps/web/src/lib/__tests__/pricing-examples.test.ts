import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateDeveloperPayoutCents, calculateTakeCents } from '@/lib/pricing'
import {
  formatUsd,
  revenueExamples,
  savingsAtOneHundredThousand,
  savingsVsCompetitorCents,
  takeOnTenThousand,
  takeRateBrackets,
} from '@/lib/pricing-examples'

const APP_ROOT = resolve(__dirname, '..', '..')
const PRICING_PAGE = readFileSync(resolve(APP_ROOT, 'app/pricing/page.tsx'), 'utf8')
const TERMS_PAGE = readFileSync(resolve(APP_ROOT, 'app/terms/page.tsx'), 'utf8')

describe('pricing page examples match lib/pricing.ts', () => {
  it('formats whole-dollar cents', () => {
    expect(formatUsd(4_882_000)).toBe('$48,820')
    expect(formatUsd(0)).toBe('$0')
  })

  it('bracket table rates and examples', () => {
    expect(takeRateBrackets).toEqual([
      { bracket: '$0 – $1,000', rate: '0%', youKeep: '100%', example: '$1,000 revenue → you keep $1,000' },
      { bracket: '$1,001 – $10,000', rate: '2%', youKeep: '98%', example: '$5,000 revenue → you keep $4,920' },
      { bracket: '$10,001 – $50,000', rate: '2.5%', youKeep: '97.5%', example: '$25,000 revenue → you keep $24,445' },
      { bracket: '$50,001+', rate: '5%', youKeep: '95%', example: '$100,000 revenue → you keep $96,320' },
    ])
  })

  it('revenue comparison rows', () => {
    expect(revenueExamples.map((r) => [r.monthly, r.settlegrid, r.mcpize])).toEqual([
      ['$500', '$500', '$425'],
      ['$2,000', '$1,980', '$1,700'],
      ['$10,000', '$9,820', '$8,500'],
      ['$50,000', '$48,820', '$42,500'],
      ['$100,000', '$96,320', '$85,000'],
    ])
    expect(revenueExamples[2].note).toBe('Progressive brackets save you $1,320/mo.')
    expect(revenueExamples[3].note).toBe('At scale, you keep $6,320 more per month.')
    expect(revenueExamples[4].note).toBe('You keep $11,320 more per month vs 15% flat.')
  })

  it('FAQ figures', () => {
    expect(takeOnTenThousand).toBe('$180')
    expect(savingsAtOneHundredThousand).toBe('$11,320')
  })

  it('every SettleGrid figure equals the payout calculation', () => {
    for (const row of revenueExamples) {
      const revenueCents = Number(row.monthly.replace(/[$,]/g, '')) * 100
      expect(row.settlegrid).toBe(formatUsd(calculateDeveloperPayoutCents(revenueCents)))
    }
    expect(savingsVsCompetitorCents(5_000_000, 4_250_000)).toBe(
      5_000_000 - calculateTakeCents(5_000_000) - 4_250_000,
    )
  })

  it('pricing page renders the derived examples, not hard-coded figures', () => {
    expect(PRICING_PAGE).toContain("from '@/lib/pricing-examples'")
    expect(PRICING_PAGE).not.toMatch(/const (takeRateBrackets|revenueExamples) = \[/)
  })
})

describe('Terms of Service platform fee', () => {
  it('states the 2.5% bracket and that the fee is monthly, deducted at payout', () => {
    expect(TERMS_PAGE).toContain('2.5% on $10,001-$50,000')
    expect(TERMS_PAGE).not.toContain('3% on $10,001-$50,000')
    expect(TERMS_PAGE).toMatch(/based on your earnings each calendar\s+month/)
    expect(TERMS_PAGE).toMatch(/deducted when those earnings are paid out/)
    expect(TERMS_PAGE).toMatch(/0% on the first \$1,000\s+each month/)
    expect(TERMS_PAGE).not.toContain('platform fee on each transaction')
  })
})
