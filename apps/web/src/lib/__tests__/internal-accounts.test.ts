import { describe, it, expect } from 'vitest'
import { isInternalEmail } from '../internal-accounts'

describe('isInternalEmail', () => {
  it('matches listed addresses and internal org domains', () => {
    expect(isInternalEmail('lexwhiting@gmail.com')).toBe(true)
    expect(isInternalEmail('Support@SettleGrid.ai')).toBe(true)
    expect(isInternalEmail('someone@alerterra.com')).toBe(true)
  })

  it("treats Gmail '+' aliases of a listed address as internal", () => {
    expect(isInternalEmail('lexwhiting+sgdev@gmail.com')).toBe(true)
    expect(isInternalEmail('LexWhiting+buyer.test@gmail.com')).toBe(true)
  })

  it('does not widen to other addresses', () => {
    expect(isInternalEmail('lexwhitingx+sgdev@gmail.com')).toBe(false)
    expect(isInternalEmail('lexwhiting+sgdev@example.com')).toBe(false)
    expect(isInternalEmail('+lexwhiting@gmail.com')).toBe(false)
    expect(isInternalEmail('someone@gmail.com')).toBe(false)
    expect(isInternalEmail('someone@settlegrid.com')).toBe(false)
    expect(isInternalEmail(null)).toBe(false)
  })
})
