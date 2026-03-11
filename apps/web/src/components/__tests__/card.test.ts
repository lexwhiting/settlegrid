import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

// Card components use cn() to merge classes. We test the class logic
// by calling cn with the same base classes the components use.

const cardBaseClasses = 'rounded-lg border border-gray-200 bg-white shadow-sm'
const cardHeaderBaseClasses = 'flex flex-col space-y-1.5 p-6'
const cardTitleBaseClasses = 'text-2xl font-semibold leading-none tracking-tight'
const cardDescriptionBaseClasses = 'text-sm text-gray-500'
const cardContentBaseClasses = 'p-6 pt-0'
const cardFooterBaseClasses = 'flex items-center p-6 pt-0'

describe('Card class logic', () => {
  it('Card applies base border and background classes', () => {
    const classes = cn(cardBaseClasses)
    expect(classes).toContain('rounded-lg')
    expect(classes).toContain('border-gray-200')
    expect(classes).toContain('bg-white')
    expect(classes).toContain('shadow-sm')
  })

  it('Card merges custom className', () => {
    const classes = cn(cardBaseClasses, 'my-4 bg-gray-50')
    expect(classes).toContain('my-4')
    // tailwind-merge resolves bg-white vs bg-gray-50 — last wins
    expect(classes).toContain('bg-gray-50')
  })
})

describe('CardHeader class logic', () => {
  it('applies flex column with padding', () => {
    const classes = cn(cardHeaderBaseClasses)
    expect(classes).toContain('flex')
    expect(classes).toContain('flex-col')
    expect(classes).toContain('p-6')
  })

  it('merges custom className', () => {
    const classes = cn(cardHeaderBaseClasses, 'p-4')
    expect(classes).toContain('p-4')
  })
})

describe('CardTitle class logic', () => {
  it('applies heading styles', () => {
    const classes = cn(cardTitleBaseClasses)
    expect(classes).toContain('text-2xl')
    expect(classes).toContain('font-semibold')
    expect(classes).toContain('tracking-tight')
  })

  it('merges custom size override', () => {
    const classes = cn(cardTitleBaseClasses, 'text-lg')
    expect(classes).toContain('text-lg')
  })
})

describe('CardDescription class logic', () => {
  it('applies description styles', () => {
    const classes = cn(cardDescriptionBaseClasses)
    expect(classes).toContain('text-sm')
    expect(classes).toContain('text-gray-500')
  })
})

describe('CardContent class logic', () => {
  it('applies content padding', () => {
    const classes = cn(cardContentBaseClasses)
    expect(classes).toContain('p-6')
    expect(classes).toContain('pt-0')
  })
})

describe('CardFooter class logic', () => {
  it('applies footer flex layout', () => {
    const classes = cn(cardFooterBaseClasses)
    expect(classes).toContain('flex')
    expect(classes).toContain('items-center')
    expect(classes).toContain('p-6')
    expect(classes).toContain('pt-0')
  })
})
