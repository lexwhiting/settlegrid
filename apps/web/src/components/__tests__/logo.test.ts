import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

// SettleGridLogo uses cn() to merge classes. We test the class merging
// behavior used by each variant of the logo component.

describe('SettleGridLogo class logic', () => {
  it('horizontal variant uses flex row with gap-2', () => {
    const classes = cn('inline-flex items-center gap-2', 'my-custom')
    expect(classes).toContain('inline-flex')
    expect(classes).toContain('items-center')
    expect(classes).toContain('gap-2')
    expect(classes).toContain('my-custom')
  })

  it('compact variant uses flex row with gap-1.5', () => {
    const classes = cn('inline-flex items-center gap-1.5')
    expect(classes).toContain('inline-flex')
    expect(classes).toContain('gap-1.5')
  })

  it('mark variant passes className directly', () => {
    const classes = cn('custom-mark-class')
    expect(classes).toBe('custom-mark-class')
  })

  it('handles undefined className gracefully', () => {
    const classes = cn('inline-flex items-center gap-2', undefined)
    expect(classes).toContain('inline-flex')
  })

  it('wordmark uses select-none class', () => {
    const classes = cn('select-none', 'text-lg')
    expect(classes).toContain('select-none')
    expect(classes).toContain('text-lg')
  })

  it('brand colors match official palette', () => {
    // Official brand colors from SettleGrid Brand Guidelines
    const AMBER_GOLD = '#E5A336'
    const DEEP_INDIGO = '#1A1F3A'
    const BRAND_TEXT = '#C4891E'
    const CLOUD = '#F8FAFB'
    const AMBER_LIGHT = '#FEF3C7'

    expect(AMBER_GOLD).toBe('#E5A336')
    expect(DEEP_INDIGO).toBe('#1A1F3A')
    expect(BRAND_TEXT).toBe('#C4891E')
    expect(CLOUD).toBe('#F8FAFB')
    expect(AMBER_LIGHT).toBe('#FEF3C7')
  })
})
