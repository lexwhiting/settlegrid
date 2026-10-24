/**
 * The Settings page renders getProgressiveTakeDescription(); keep its text in
 * line with the brackets calculateTakeCents applies.
 */
import { describe, it, expect } from 'vitest'
import { TAKE_RATE_BRACKETS, getProgressiveTakeDescription } from '../pricing'

describe('getProgressiveTakeDescription', () => {
  it('lists every bracket rate', () => {
    const text = getProgressiveTakeDescription()
    for (const bracket of TAKE_RATE_BRACKETS) {
      expect(text).toContain(`${bracket.rate * 100}%`)
    }
  })

  it('states 2.5% on $10K-$50K', () => {
    expect(getProgressiveTakeDescription()).toContain('2.5% on $10K-$50K')
    expect(getProgressiveTakeDescription()).not.toMatch(/\b3% on/)
  })

  it('states that the brackets apply per calendar month', () => {
    expect(getProgressiveTakeDescription()).toMatch(/per calendar month$/)
  })
})
