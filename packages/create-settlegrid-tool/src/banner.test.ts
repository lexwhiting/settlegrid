import { describe, it, expect } from 'vitest'
import { banner } from './banner.js'

describe('banner', () => {
  it('returns a string containing SettleGrid ASCII art', () => {
    const output = banner()
    // The ASCII art renders "SettleGrid" stylized — check key fragments
    expect(output).toContain('___')
    expect(output).toContain('/ __|')
  })

  it('includes the tagline', () => {
    const output = banner()
    expect(output).toContain('Settlement Layer')
    expect(output).toContain('AI Economy')
  })

  it('includes version', () => {
    const output = banner()
    expect(output).toContain('v1.0.0')
  })
})
