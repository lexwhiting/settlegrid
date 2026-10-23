import { describe, it, expect } from 'vitest'
import { getEffectiveTier, getTierConfig } from '../tier-config'

describe('getEffectiveTier', () => {
  it('returns the stored tier for non-founding developers', () => {
    expect(getEffectiveTier('free', false)).toBe('free')
    expect(getEffectiveTier('builder', undefined)).toBe('builder')
    expect(getEffectiveTier('standard', null)).toBe('standard')
  })

  it('gives founding members scale', () => {
    expect(getEffectiveTier('free', true)).toBe('scale')
    expect(getEffectiveTier('standard', true)).toBe('scale')
    expect(getEffectiveTier('builder', true)).toBe('scale')
    expect(getTierConfig(getEffectiveTier('free', true)).opsPerMonth).toBe(2_000_000)
  })

  it('keeps enterprise for founding members', () => {
    expect(getEffectiveTier('enterprise', true)).toBe('enterprise')
  })
})
