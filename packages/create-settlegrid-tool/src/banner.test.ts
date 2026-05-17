import { describe, it, expect } from 'vitest'
import { banner } from './banner.js'

describe('banner', () => {
  it('returns a string containing SettleGrid ASCII art', () => {
    const output = banner('1.0.1')
    // The ASCII art renders "SettleGrid" stylized — check key fragments
    expect(output).toContain('___')
    expect(output).toContain('/ __|')
  })

  it('includes the tagline', () => {
    const output = banner('1.0.1')
    expect(output).toContain('Settlement Layer')
    expect(output).toContain('AI Economy')
  })

  it('renders the version passed in', () => {
    expect(banner('1.0.1')).toContain('v1.0.1')
    expect(banner('2.3.4')).toContain('v2.3.4')
  })
})
