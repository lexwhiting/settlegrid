import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { hourLabel } from '@/lib/dashboard-summaries'

// Dashboard follow-ups from the 2026-11-12 retest (vitest runs in node, without a DOM).
const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../app/(dashboard)/dashboard', rel), 'utf8')

describe('hourLabel (24-hour chart x-axis)', () => {
  it('labels each hour bucket with its UTC hour of day', () => {
    // The stats API sends date_trunc('hour', created_at)::text with the session in UTC.
    expect(hourLabel('2026-11-15 13:00:00+00')).toBe('13:00')
    expect(hourLabel('2026-11-15 00:00:00+00')).toBe('00:00')
    expect(hourLabel('2026-11-15T09:00:00.000Z')).toBe('09:00')
  })

  it('never reads the year as the hour, and leaves anything else as it is', () => {
    expect(hourLabel('2026-11-15 13:00:00+00')).not.toBe('2026:00')
    expect(hourLabel('7')).toBe('7')
    expect(hourLabel('')).toBe('')
  })
})

describe('dashboard pages (source pins)', () => {
  it('formats the 24-hour chart with hourLabel and says the hours are UTC', () => {
    const page = read('page.tsx')
    expect(page).toContain('formatXAxis={hourLabel}')
    expect(page).toContain('Invocations (Last 24 Hours, UTC)')
    expect(page).not.toMatch(/parseInt\(v, 10\)/)
  })

  it('shows the forecast card for any projection with enough data, $0.00 included', () => {
    const page = read('page.tsx')
    expect(page).not.toContain('projectedNextMonthCents > 0')
    expect(page).toContain(') : forecastData ? (')
    expect(page).toContain('formatCents(forecastData.projectedNextMonthCents)')
  })

  it('states the Settings revenue share as the range from the brackets, with the fee schedule as detail', () => {
    const page = read('settings/page.tsx')
    const row = page.slice(page.indexOf('>Revenue Share</dt>'), page.indexOf('>Member Since</dt>'))
    expect(row).toContain('{takeRateSummary(TAKE_RATE_BRACKETS).revenueShare}')
    expect(row).toContain('(platform fee {getProgressiveTakeDescription()')
    expect(row).not.toMatch(/>\s*Progressive\s*</)
  })
})
