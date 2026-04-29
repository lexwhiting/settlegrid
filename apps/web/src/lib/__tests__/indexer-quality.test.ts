import { describe, it, expect } from 'vitest'
import { parseIndexerQualityScores, computeWeightedPriority } from '../indexer-quality'

// ---------------------------------------------------------------------------
// parseIndexerQualityScores
// ---------------------------------------------------------------------------

describe('parseIndexerQualityScores', () => {
  it('returns null for null/undefined input', () => {
    expect(parseIndexerQualityScores(null)).toBeNull()
    expect(parseIndexerQualityScores(undefined)).toBeNull()
  })

  it('parses a valid JSON string', () => {
    const raw = JSON.stringify({
      weights: { npm: 1.5, github: 0.8 },
      computedAt: '2026-04-07T08:00:00.000Z',
    })
    const result = parseIndexerQualityScores(raw)
    expect(result).not.toBeNull()
    expect(result?.weights.npm).toBe(1.5)
    expect(result?.weights.github).toBe(0.8)
    expect(result?.computedAt).toBe('2026-04-07T08:00:00.000Z')
  })

  it('parses an already-parsed object', () => {
    const obj = {
      weights: { npm: 2.0 },
      computedAt: '2026-04-07T08:00:00.000Z',
    }
    const result = parseIndexerQualityScores(obj)
    expect(result?.weights.npm).toBe(2.0)
  })

  it('returns null for malformed JSON string', () => {
    expect(parseIndexerQualityScores('not json')).toBeNull()
  })

  it('returns null when weights field is missing', () => {
    expect(
      parseIndexerQualityScores({ computedAt: '2026-04-07T08:00:00.000Z' }),
    ).toBeNull()
  })

  it('returns null when computedAt is missing', () => {
    expect(parseIndexerQualityScores({ weights: { npm: 1.5 } })).toBeNull()
  })

  it('returns null when weights is not an object', () => {
    expect(
      parseIndexerQualityScores({
        weights: 'broken',
        computedAt: '2026-04-07T08:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('returns null when weights is an array', () => {
    expect(
      parseIndexerQualityScores({
        weights: [1, 2, 3],
        computedAt: '2026-04-07T08:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('returns null when computedAt is not a string', () => {
    expect(
      parseIndexerQualityScores({ weights: { npm: 1 }, computedAt: 12345 }),
    ).toBeNull()
  })

  it('drops weight values that are not finite numbers', () => {
    const raw = {
      weights: {
        npm: 1.5,
        broken: NaN,
        also_broken: 'not a number',
        infinity: Infinity,
        negative: -1,
        zero: 0,
        valid_string: '2.0', // strings that coerce to numbers ARE accepted
      },
      computedAt: '2026-04-07T08:00:00.000Z',
    }
    const result = parseIndexerQualityScores(raw)
    expect(result).not.toBeNull()
    expect(result?.weights).toEqual({
      npm: 1.5,
      valid_string: 2.0,
    })
  })

  it('returns empty weights object when all values are invalid', () => {
    const raw = {
      weights: { npm: NaN, github: -1 },
      computedAt: '2026-04-07T08:00:00.000Z',
    }
    const result = parseIndexerQualityScores(raw)
    expect(result?.weights).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// computeWeightedPriority
// ---------------------------------------------------------------------------

describe('computeWeightedPriority', () => {
  it('returns the unweighted base when weight = 1.0', () => {
    // base position 0, no rotation, weight 1 → priority 0
    expect(computeWeightedPriority(0, 0, 1.0)).toBe(0)
    expect(computeWeightedPriority(2, 0, 1.0)).toBe(2)
    expect(computeWeightedPriority(4, 0, 1.0)).toBe(4)
  })

  it('halves the priority when weight = 2.0 (sorts earlier)', () => {
    expect(computeWeightedPriority(2, 0, 2.0)).toBe(1)
    expect(computeWeightedPriority(4, 0, 2.0)).toBe(2)
  })

  it('doubles the priority when weight = 0.5 (sorts later)', () => {
    expect(computeWeightedPriority(2, 0, 0.5)).toBe(4)
  })

  it('rotates positions by day-of-year', () => {
    // base 0 at rotation 0 → 0; base 0 at rotation 1 → (0+5-1)%5 = 4
    expect(computeWeightedPriority(0, 0, 1.0)).toBe(0)
    expect(computeWeightedPriority(0, 1, 1.0)).toBe(4)
    expect(computeWeightedPriority(0, 2, 1.0)).toBe(3)
    expect(computeWeightedPriority(0, 4, 1.0)).toBe(1)
  })

  it('clamps weight at 5.0 maximum', () => {
    // weight 100 gets clamped to 5.0; (4+5-0)%5 = 4; 4/5 = 0.8
    const result = computeWeightedPriority(4, 0, 100)
    expect(result).toBe(0.8)
  })

  it('clamps weight at 0.1 minimum', () => {
    // weight 0.001 gets clamped to 0.1; (1+5-0)%5 = 1; 1/0.1 = 10
    const result = computeWeightedPriority(1, 0, 0.001)
    expect(result).toBe(10)
  })

  it('falls back to weight=1 for NaN', () => {
    expect(computeWeightedPriority(2, 0, NaN)).toBe(2)
  })

  it('falls back to weight=1 for Infinity', () => {
    expect(computeWeightedPriority(2, 0, Infinity)).toBe(2)
  })

  it('falls back to weight=1 for negative weight', () => {
    expect(computeWeightedPriority(2, 0, -1)).toBe(2)
  })

  it('falls back to weight=1 for zero weight', () => {
    expect(computeWeightedPriority(2, 0, 0)).toBe(2)
  })

  it('coerces string weight to number', () => {
    // typescript signature is `weight: number` but runtime can be anything
    // because the value comes from JSON.parse on Redis content
    expect(computeWeightedPriority(2, 0, '2.0' as unknown as number)).toBe(1)
  })

  it('returns 1 for non-numeric string weight', () => {
    expect(computeWeightedPriority(2, 0, 'foo' as unknown as number)).toBe(2)
  })

  it('produces strictly ordered priorities for the same rotation', () => {
    // With uniform weights, the 5 base positions should sort 0,1,2,3,4
    const rotation = 0
    const priorities = [0, 1, 2, 3, 4].map((pos) =>
      computeWeightedPriority(pos, rotation, 1.0),
    )
    expect(priorities).toEqual([0, 1, 2, 3, 4])
  })

  it('boost via weight pulls a high-base source to the front', () => {
    // base position 4 (last in default rotation) with weight 5.0 should sort
    // ahead of base 0 with weight 1.0 (priority 0.8 < 1.0... wait, base 0 = 0, not 1)
    // Better example: base 4 weight 5 → priority 0.8; base 1 weight 1 → priority 1
    // So weighted huggingface (4) sorts ahead of weighted smithery (1)
    const huggingface = computeWeightedPriority(4, 0, 5.0)
    const smithery = computeWeightedPriority(1, 0, 1.0)
    expect(huggingface).toBeLessThan(smithery)
  })
})
