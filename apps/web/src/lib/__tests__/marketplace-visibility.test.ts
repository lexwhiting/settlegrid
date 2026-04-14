import { describe, it, expect } from 'vitest'
import { shouldIncludeInMarketplace } from '../marketplace-visibility'

describe('shouldIncludeInMarketplace — P2.INTL2 marketplace inclusion rule', () => {
  describe('unclaimed tools', () => {
    it('always included regardless of listedInMarketplace flag', () => {
      expect(shouldIncludeInMarketplace('unclaimed', true)).toBe(true)
      expect(shouldIncludeInMarketplace('unclaimed', false)).toBe(true)
    })
  })

  describe('active tools', () => {
    it('always included regardless of listedInMarketplace flag', () => {
      expect(shouldIncludeInMarketplace('active', true)).toBe(true)
      expect(shouldIncludeInMarketplace('active', false)).toBe(true)
    })
  })

  describe('draft tools', () => {
    it('included only when listedInMarketplace=true (developer opted in)', () => {
      expect(shouldIncludeInMarketplace('draft', true)).toBe(true)
    })

    it('excluded when listedInMarketplace=false (developer opted out OR pre-migration backfill)', () => {
      // Two cases land here in practice:
      //   1. Developer who claimed pre-P2.INTL2 — backfill set this to false
      //      to avoid retroactively exposing their work-in-progress
      //   2. Developer who explicitly hid their draft via the dashboard toggle
      // The rule is identical for both cases.
      expect(shouldIncludeInMarketplace('draft', false)).toBe(false)
    })
  })

  describe('other / unsupported statuses', () => {
    it('excluded for deleted, hidden, and unknown statuses regardless of flag', () => {
      const otherStatuses = ['deleted', 'hidden', 'archived', 'unknown', '']
      for (const status of otherStatuses) {
        expect(
          shouldIncludeInMarketplace(status, true),
          `status='${status}' with listedInMarketplace=true should be excluded`,
        ).toBe(false)
        expect(
          shouldIncludeInMarketplace(status, false),
          `status='${status}' with listedInMarketplace=false should be excluded`,
        ).toBe(false)
      }
    })
  })

  describe('regression: claim transition preserves visibility', () => {
    // The claim flow transitions status='unclaimed' -> 'draft' AND sets
    // listedInMarketplace=true (apps/web/src/app/api/tools/claim/route.ts).
    // Both states should be marketplace-visible — that's the whole point
    // of the P2.INTL2 work.
    it('pre-claim (status=unclaimed, listed=true): visible', () => {
      expect(shouldIncludeInMarketplace('unclaimed', true)).toBe(true)
    })

    it('post-claim (status=draft, listed=true): still visible — no visibility gap', () => {
      expect(shouldIncludeInMarketplace('draft', true)).toBe(true)
    })

    it('post-claim if developer later hides via dashboard (status=draft, listed=false): hidden', () => {
      expect(shouldIncludeInMarketplace('draft', false)).toBe(false)
    })
  })
})
