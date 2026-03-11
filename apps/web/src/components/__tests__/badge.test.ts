import { describe, it, expect } from 'vitest'
import { badgeVariants } from '@/components/ui/badge'

describe('badgeVariants', () => {
  it('applies default variant classes', () => {
    const classes = badgeVariants({ variant: 'default' })
    expect(classes).toContain('bg-brand')
    expect(classes).toContain('text-white')
  })

  it('applies secondary variant classes', () => {
    const classes = badgeVariants({ variant: 'secondary' })
    expect(classes).toContain('bg-gray-100')
    expect(classes).toContain('text-gray-800')
  })

  it('applies destructive variant classes', () => {
    const classes = badgeVariants({ variant: 'destructive' })
    expect(classes).toContain('bg-red-100')
    expect(classes).toContain('text-red-800')
  })

  it('applies outline variant classes', () => {
    const classes = badgeVariants({ variant: 'outline' })
    expect(classes).toContain('border-gray-300')
    expect(classes).toContain('text-gray-700')
  })

  it('applies success variant classes', () => {
    const classes = badgeVariants({ variant: 'success' })
    expect(classes).toContain('bg-green-100')
    expect(classes).toContain('text-green-800')
  })

  it('applies warning variant classes', () => {
    const classes = badgeVariants({ variant: 'warning' })
    expect(classes).toContain('bg-yellow-100')
    expect(classes).toContain('text-yellow-800')
  })

  it('includes common badge styles', () => {
    const classes = badgeVariants({})
    expect(classes).toContain('rounded-full')
    expect(classes).toContain('text-xs')
    expect(classes).toContain('font-semibold')
  })

  it('defaults to default variant when no variant specified', () => {
    const classes = badgeVariants({})
    expect(classes).toContain('bg-brand')
    expect(classes).toContain('text-white')
  })
})
