import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('handles conditional classes via clsx syntax', () => {
    const isActive = true
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toContain('base-class')
    expect(result).toContain('active-class')
  })

  it('omits falsy values', () => {
    const result = cn('base-class', false && 'hidden', undefined, null, 'final')
    expect(result).toContain('base-class')
    expect(result).toContain('final')
    expect(result).not.toContain('hidden')
  })

  it('resolves Tailwind merge conflicts (last wins)', () => {
    const result = cn('px-4', 'px-6')
    // tailwind-merge should resolve the conflict — last one wins
    expect(result).toBe('px-6')
  })

  it('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })
})
