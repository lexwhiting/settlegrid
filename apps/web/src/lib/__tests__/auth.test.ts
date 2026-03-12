import { describe, it, expect } from 'vitest'
import { isValidUserType } from '@/lib/auth'
import type { UserType } from '@/lib/auth'

describe('isValidUserType', () => {
  it('returns true for developer', () => {
    expect(isValidUserType('developer')).toBe(true)
  })

  it('returns true for consumer', () => {
    expect(isValidUserType('consumer')).toBe(true)
  })

  it('returns false for invalid type', () => {
    expect(isValidUserType('admin')).toBe(false)
    expect(isValidUserType('')).toBe(false)
    expect(isValidUserType('Developer')).toBe(false)
  })

  it('narrows the type correctly', () => {
    const value: string = 'developer'
    if (isValidUserType(value)) {
      const _typed: UserType = value
      expect(_typed).toBe('developer')
    }
  })
})
