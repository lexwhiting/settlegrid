import { describe, it, expect } from 'vitest'
import { formatErrorRatePct } from '@/lib/dashboard-summaries'
import { UPSTREAM_URL_MESSAGE, upstreamUrlValidityMessage } from '@/lib/upstream-url-message'

describe('formatErrorRatePct (the APIs return a percentage)', () => {
  it('formats a percentage without scaling it again', () => {
    expect(formatErrorRatePct(50)).toBe('50.00%') // one failed call in two
    expect(formatErrorRatePct(100)).toBe('100.00%')
    expect(formatErrorRatePct(0.5)).toBe('0.50%')
    expect(formatErrorRatePct(12.345)).toBe('12.35%')
  })

  it('never shows more than 100% or a bad value', () => {
    expect(formatErrorRatePct(5000)).toBe('100.00%')
    expect(formatErrorRatePct(undefined)).toBe('0.00%')
    expect(formatErrorRatePct('x')).toBe('0.00%')
    expect(formatErrorRatePct(-1)).toBe('0.00%')
  })
})

describe('upstreamUrlValidityMessage', () => {
  it('names the https:// rule when the browser rejects the URL', () => {
    expect(upstreamUrlValidityMessage({ patternMismatch: true, typeMismatch: false })).toBe(UPSTREAM_URL_MESSAGE)
    expect(upstreamUrlValidityMessage({ patternMismatch: false, typeMismatch: true })).toBe(UPSTREAM_URL_MESSAGE)
    expect(UPSTREAM_URL_MESSAGE).toBe('Upstream URL must start with https://')
  })

  it('clears the message when the URL is valid', () => {
    expect(upstreamUrlValidityMessage({ patternMismatch: false, typeMismatch: false })).toBe('')
  })
})
