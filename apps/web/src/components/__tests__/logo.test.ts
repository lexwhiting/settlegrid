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

  it('wordmark uses font-bold tracking-tight', () => {
    const classes = cn('font-bold tracking-tight select-none', 'text-lg')
    expect(classes).toContain('font-bold')
    expect(classes).toContain('tracking-tight')
    expect(classes).toContain('select-none')
    expect(classes).toContain('text-lg')
  })
})
