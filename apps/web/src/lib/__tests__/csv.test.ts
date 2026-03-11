import { describe, it, expect } from 'vitest'
import { csvEscape } from '@/lib/csv'

describe('csvEscape', () => {
  it('returns plain values unchanged', () => {
    expect(csvEscape('hello')).toBe('hello')
    expect(csvEscape('simple value')).toBe('simple value')
    expect(csvEscape('42')).toBe('42')
  })

  it('wraps values with commas in double quotes', () => {
    expect(csvEscape('Tool, With, Commas')).toBe('"Tool, With, Commas"')
  })

  it('doubles internal double quotes and wraps in quotes', () => {
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""')
  })

  it('wraps values with newlines in double quotes', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('prefixes formula triggers (=, +, -, @) with single quote', () => {
    expect(csvEscape('=SUM(A1:A10)')).toBe("\"'=SUM(A1:A10)\"")
    expect(csvEscape('+cmd|calc')).toBe("\"\'+cmd|calc\"")
    expect(csvEscape('-important')).toBe("\"\'-important\"")
    expect(csvEscape('@user')).toBe("\"'@user\"")
  })

  it('handles empty string', () => {
    expect(csvEscape('')).toBe('')
  })

  it('handles combined special characters', () => {
    // Value has comma + formula trigger
    const result = csvEscape('=formula, dangerous')
    expect(result).toBe("\"'=formula, dangerous\"")
  })

  it('does not modify values without special characters', () => {
    expect(csvEscape('2026-03-11T10:00:00Z')).toBe('2026-03-11T10:00:00Z')
    expect(csvEscape('success')).toBe('success')
    expect(csvEscape('classify')).toBe('classify')
  })
})
