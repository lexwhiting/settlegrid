import { describe, it, expect } from 'vitest'
import { formatErrorRatePct, takeRateSummary } from '@/lib/dashboard-summaries'
import { TAKE_RATE_BRACKETS } from '@/lib/pricing'
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

describe('takeRateSummary (Settings plan card)', () => {
  it('derives the fee and revenue-share ranges from the real brackets', () => {
    expect(takeRateSummary(TAKE_RATE_BRACKETS)).toEqual({ takeRate: '0–5%', revenueShare: '95–100%', freeUpTo: '$1,000' })
  })

  it('rounds bracket rates and omits the free tier when there is none', () => {
    expect(takeRateSummary([{ upTo: Infinity, rate: 0.07 }])).toEqual({ takeRate: '7%', revenueShare: '93%', freeUpTo: null })
  })
})

describe('upstreamUrlValidityMessage', () => {
  it('names the https:// rule when the value does not start with https://', () => {
    expect(upstreamUrlValidityMessage({ patternMismatch: true })).toBe(UPSTREAM_URL_MESSAGE)
    expect(UPSTREAM_URL_MESSAGE).toBe('Upstream URL must start with https://')
  })

  it('leaves other cases (a valid URL, or https:// with a malformed rest) to the browser', () => {
    expect(upstreamUrlValidityMessage({ patternMismatch: false })).toBe('')
  })
})
