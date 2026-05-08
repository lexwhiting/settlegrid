/**
 * P5.4 — scoring.ts unit tests.
 *
 * Spec checks (all from the prompt):
 *   - score = scaffold * 2 + view + freshness
 *   - top candidate not already featured
 *   - score 0 → no candidate (NEVER fall through to alphabetical pick)
 *   - freshness bonus is finite (decays to 0 by day 30) and never blocks
 */
import { describe, it, expect } from 'vitest'
import {
  FRESHNESS_WINDOW_DAYS,
  freshnessBonus,
  pickWinner,
  scoreTemplate,
  selectCandidates,
} from '../scoring'

describe('freshnessBonus', () => {
  it('returns 0 when daysSinceAdded is null (unknown age)', () => {
    expect(freshnessBonus(null)).toBe(0)
  })

  it('decays linearly from FRESHNESS_WINDOW_DAYS at day 0 down to 0 at the boundary', () => {
    expect(freshnessBonus(0)).toBe(FRESHNESS_WINDOW_DAYS)
    expect(freshnessBonus(1)).toBe(FRESHNESS_WINDOW_DAYS - 1)
    expect(freshnessBonus(15)).toBe(FRESHNESS_WINDOW_DAYS - 15)
    expect(freshnessBonus(FRESHNESS_WINDOW_DAYS - 1)).toBe(1)
  })

  it('returns 0 at and beyond the boundary', () => {
    expect(freshnessBonus(FRESHNESS_WINDOW_DAYS)).toBe(0)
    expect(freshnessBonus(FRESHNESS_WINDOW_DAYS + 1)).toBe(0)
    expect(freshnessBonus(365)).toBe(0)
  })

  it('returns 0 for negative or non-finite inputs (defensive)', () => {
    expect(freshnessBonus(-5)).toBe(0)
    expect(freshnessBonus(Number.NaN)).toBe(0)
    expect(freshnessBonus(Number.POSITIVE_INFINITY)).toBe(0)
    expect(freshnessBonus(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('scoreTemplate', () => {
  it('applies the spec formula: scaffold*2 + view + freshness', () => {
    const r = scoreTemplate({
      slug: 'a',
      scaffoldCount: 5,
      viewCount: 12,
      daysSinceAdded: 10,
    })
    expect(r.score).toBe(5 * 2 + 12 + (FRESHNESS_WINDOW_DAYS - 10))
    expect(r.components).toEqual({
      scaffold: 10,
      view: 12,
      freshness: FRESHNESS_WINDOW_DAYS - 10,
    })
  })

  it('clamps negative counts to 0 (defensive against upstream bugs)', () => {
    const r = scoreTemplate({
      slug: 'a',
      scaffoldCount: -3,
      viewCount: -10,
      daysSinceAdded: null,
    })
    expect(r.score).toBe(0)
    expect(r.components).toEqual({ scaffold: 0, view: 0, freshness: 0 })
  })

  it('coerces NaN/Infinity counts to 0', () => {
    const r = scoreTemplate({
      slug: 'a',
      scaffoldCount: Number.NaN,
      viewCount: Number.POSITIVE_INFINITY,
      daysSinceAdded: null,
    })
    expect(r.score).toBe(0)
  })

  it('zero counts + null age → 0 (no candidate condition)', () => {
    const r = scoreTemplate({
      slug: 'a',
      scaffoldCount: 0,
      viewCount: 0,
      daysSinceAdded: null,
    })
    expect(r.score).toBe(0)
  })

  it('zero counts + recent age → still positive (freshness alone is meaningful)', () => {
    // A brand-new template with zero traffic should still be a
    // candidate — the freshness bonus is exactly the lever for "give
    // a new template a shot in its first month".
    const r = scoreTemplate({
      slug: 'a',
      scaffoldCount: 0,
      viewCount: 0,
      daysSinceAdded: 1,
    })
    expect(r.score).toBeGreaterThan(0)
  })
})

describe('selectCandidates', () => {
  const inputs = [
    { slug: 'old-popular', scaffoldCount: 20, viewCount: 50, daysSinceAdded: 100 },
    { slug: 'new-quiet', scaffoldCount: 0, viewCount: 0, daysSinceAdded: 5 },
    { slug: 'new-popular', scaffoldCount: 5, viewCount: 30, daysSinceAdded: 5 },
    { slug: 'silent', scaffoldCount: 0, viewCount: 0, daysSinceAdded: null },
  ]

  it('excludes recently-featured slugs', () => {
    const ranked = selectCandidates(inputs, new Set(['old-popular']))
    const slugs = ranked.map((r) => r.slug)
    expect(slugs).not.toContain('old-popular')
  })

  it('ranks by score descending; ties broken by slug ascending', () => {
    const ranked = selectCandidates(inputs, new Set())
    // old-popular: 20*2 + 50 + 0 = 90
    // new-popular: 5*2 + 30 + 25 = 65
    // new-quiet:   0 + 0 + 25 = 25
    // silent:      0
    expect(ranked.map((r) => r.slug)).toEqual([
      'old-popular',
      'new-popular',
      'new-quiet',
      'silent',
    ])
  })

  it('alphabetical tie-break is deterministic', () => {
    const tied = [
      { slug: 'banana', scaffoldCount: 1, viewCount: 0, daysSinceAdded: null },
      { slug: 'apple', scaffoldCount: 1, viewCount: 0, daysSinceAdded: null },
      { slug: 'cherry', scaffoldCount: 1, viewCount: 0, daysSinceAdded: null },
    ]
    expect(selectCandidates(tied, new Set()).map((r) => r.slug)).toEqual([
      'apple',
      'banana',
      'cherry',
    ])
  })

  it('passes through silently when input list is empty', () => {
    expect(selectCandidates([], new Set())).toEqual([])
  })
})

describe('pickWinner', () => {
  it('returns null when registry is empty', () => {
    expect(pickWinner([], new Set())).toBeNull()
  })

  it('returns null when every candidate is blocked', () => {
    const inputs = [
      { slug: 'a', scaffoldCount: 5, viewCount: 5, daysSinceAdded: null },
      { slug: 'b', scaffoldCount: 5, viewCount: 5, daysSinceAdded: null },
    ]
    expect(pickWinner(inputs, new Set(['a', 'b']))).toBeNull()
  })

  it('returns null when every score is 0 (LOAD-BEARING: no fall-through pick)', () => {
    // This is the pre-launch case: PostHog has zero events, every
    // template's daysSinceAdded is unknown or > 30. The script MUST
    // skip the week instead of arbitrary-picking.
    const inputs = [
      { slug: 'a', scaffoldCount: 0, viewCount: 0, daysSinceAdded: 100 },
      { slug: 'b', scaffoldCount: 0, viewCount: 0, daysSinceAdded: null },
      { slug: 'c', scaffoldCount: 0, viewCount: 0, daysSinceAdded: 200 },
    ]
    expect(pickWinner(inputs, new Set())).toBeNull()
  })

  it('returns the top scorer when at least one is positive', () => {
    const inputs = [
      { slug: 'a', scaffoldCount: 1, viewCount: 0, daysSinceAdded: null }, // 2
      { slug: 'b', scaffoldCount: 0, viewCount: 5, daysSinceAdded: null }, // 5
      { slug: 'c', scaffoldCount: 0, viewCount: 0, daysSinceAdded: null }, // 0
    ]
    const w = pickWinner(inputs, new Set())
    expect(w?.slug).toBe('b')
    expect(w?.score).toBe(5)
  })

  it('skips blocked even if it would be the top scorer', () => {
    const inputs = [
      { slug: 'champ', scaffoldCount: 50, viewCount: 100, daysSinceAdded: null },
      { slug: 'runner-up', scaffoldCount: 1, viewCount: 0, daysSinceAdded: null },
    ]
    const w = pickWinner(inputs, new Set(['champ']))
    expect(w?.slug).toBe('runner-up')
  })
})
