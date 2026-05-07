/**
 * P5.1 — Unit tests for funnel-queries.
 *
 * Covers the pure-TS aggregation logic (`computeDailyStats`) and the
 * unconfigured-path branch of `runFunnelQueries`. The HogQL queries
 * themselves are not unit-testable without mocking PostHog's HTTP API
 * end-to-end; the script's manual-smoke verification covers that path.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  computeDailyStats,
  parseMedianMinutes,
  runFunnelQueries,
  FUNNEL_STAGES,
  FUNNEL_TRANSITIONS,
  type FunnelDailyPoint,
} from '@/lib/funnel-queries'
import { EVENT_NAMES, type EventName } from '@/lib/posthog'

describe('FUNNEL_STAGES + FUNNEL_TRANSITIONS', () => {
  it('exports 5 funnel stages in the spec-required order', () => {
    expect(FUNNEL_STAGES).toEqual([
      'gallery_viewed',
      'template_detail_viewed',
      'cli_install_started',
      'scaffold_success',
      'first_billed_call',
    ])
  })

  it('exports 4 transitions matching adjacent stages', () => {
    expect(FUNNEL_TRANSITIONS).toHaveLength(4)
    for (let i = 0; i < FUNNEL_TRANSITIONS.length; i++) {
      expect(FUNNEL_TRANSITIONS[i].from).toBe(FUNNEL_STAGES[i])
      expect(FUNNEL_TRANSITIONS[i].to).toBe(FUNNEL_STAGES[i + 1])
    }
  })
})

describe('computeDailyStats', () => {
  it('returns zero-struct for every event when input is empty', () => {
    const stats = computeDailyStats([])
    for (const e of EVENT_NAMES) {
      expect(stats[e]).toEqual({
        total: 0,
        activeDays: 0,
        minNonZero: 0,
        median: 0,
        max: 0,
        peakDay: null,
        spikeRatio: null,
      })
    }
  })

  it('treats all-zero days as inactive (peakDay null, spikeRatio null)', () => {
    const daily: FunnelDailyPoint[] = [
      { day: '2026-04-01', event: 'gallery_viewed' as EventName, count: 0 },
      { day: '2026-04-02', event: 'gallery_viewed' as EventName, count: 0 },
    ]
    const stats = computeDailyStats(daily)
    expect(stats.gallery_viewed.activeDays).toBe(0)
    expect(stats.gallery_viewed.peakDay).toBeNull()
    expect(stats.gallery_viewed.spikeRatio).toBeNull()
    expect(stats.gallery_viewed.total).toBe(0)
  })

  it('computes median over odd-count non-zero days correctly', () => {
    const daily: FunnelDailyPoint[] = [
      { day: '2026-04-01', event: 'gallery_viewed' as EventName, count: 3 },
      { day: '2026-04-02', event: 'gallery_viewed' as EventName, count: 5 },
      { day: '2026-04-03', event: 'gallery_viewed' as EventName, count: 7 },
    ]
    const stats = computeDailyStats(daily)
    expect(stats.gallery_viewed.median).toBe(5)
    expect(stats.gallery_viewed.activeDays).toBe(3)
    expect(stats.gallery_viewed.minNonZero).toBe(3)
    expect(stats.gallery_viewed.max).toBe(7)
    expect(stats.gallery_viewed.peakDay).toBe('2026-04-03')
    expect(stats.gallery_viewed.total).toBe(15)
    expect(stats.gallery_viewed.spikeRatio).toBeCloseTo(7 / 5, 5)
  })

  it('computes median over even-count non-zero days as the mean of the two middle values', () => {
    const daily: FunnelDailyPoint[] = [
      { day: '2026-04-01', event: 'gallery_viewed' as EventName, count: 2 },
      { day: '2026-04-02', event: 'gallery_viewed' as EventName, count: 4 },
      { day: '2026-04-03', event: 'gallery_viewed' as EventName, count: 6 },
      { day: '2026-04-04', event: 'gallery_viewed' as EventName, count: 8 },
    ]
    const stats = computeDailyStats(daily)
    // sortedNonZero = [2, 4, 6, 8] → median = (4 + 6) / 2 = 5
    expect(stats.gallery_viewed.median).toBe(5)
    expect(stats.gallery_viewed.spikeRatio).toBeCloseTo(8 / 5, 5)
  })

  it('skips zero days when computing minNonZero / median / activeDays', () => {
    const daily: FunnelDailyPoint[] = [
      { day: '2026-04-01', event: 'gallery_viewed' as EventName, count: 0 },
      { day: '2026-04-02', event: 'gallery_viewed' as EventName, count: 10 },
      { day: '2026-04-03', event: 'gallery_viewed' as EventName, count: 0 },
      { day: '2026-04-04', event: 'gallery_viewed' as EventName, count: 20 },
    ]
    const stats = computeDailyStats(daily)
    expect(stats.gallery_viewed.activeDays).toBe(2)
    expect(stats.gallery_viewed.minNonZero).toBe(10)
    expect(stats.gallery_viewed.median).toBe(15)
    expect(stats.gallery_viewed.max).toBe(20)
    // total INCLUDES zero days so the sidecar still matches the daily array.
    expect(stats.gallery_viewed.total).toBe(30)
  })

  it("isolates events from each other (one event's counts do not bleed into another)", () => {
    const daily: FunnelDailyPoint[] = [
      { day: '2026-04-01', event: 'gallery_viewed' as EventName, count: 100 },
      { day: '2026-04-01', event: 'first_billed_call' as EventName, count: 1 },
    ]
    const stats = computeDailyStats(daily)
    expect(stats.gallery_viewed.total).toBe(100)
    expect(stats.first_billed_call.total).toBe(1)
    expect(stats.template_detail_viewed.total).toBe(0)
  })
})

describe('parseMedianMinutes', () => {
  it('returns null when upstream returns undefined (no row at all)', () => {
    expect(parseMedianMinutes(undefined)).toBeNull()
  })

  it('returns null when upstream returns empty rows array', () => {
    expect(parseMedianMinutes([])).toBeNull()
  })

  it('returns null when row is empty (no columns)', () => {
    expect(parseMedianMinutes([[]])).toBeNull()
  })

  it('returns null when median seconds is null (no users qualified)', () => {
    expect(parseMedianMinutes([[null]])).toBeNull()
  })

  it('returns null when median seconds is exactly 0 (defensive — query enforces t_to > t_from)', () => {
    expect(parseMedianMinutes([[0]])).toBeNull()
  })

  it('preserves sub-minute precision (regression: 1.5s no longer rounds to 0/null)', () => {
    // Pre-fix this returned null because `Math.round(0.025 * 10) / 10 = 0`
    // and the storage layer mapped 0 → null. Then the formatters rendered
    // `--` for what was a real, fast conversion. Full-precision storage
    // keeps the signal; formatters round at the leaf.
    const result = parseMedianMinutes([[1.5]])
    expect(result).not.toBeNull()
    expect(result).toBeCloseTo(0.025, 6)
  })

  it('preserves 1-second median precision (lower-bound regression)', () => {
    const result = parseMedianMinutes([[1]])
    expect(result).not.toBeNull()
    expect(result).toBeCloseTo(1 / 60, 6)
  })

  it('returns 1 minute for 60-second median', () => {
    expect(parseMedianMinutes([[60]])).toBe(1)
  })

  it('returns 60 minutes for 3600-second median', () => {
    expect(parseMedianMinutes([[3600]])).toBe(60)
  })

  it('coerces string-shaped seconds value (HogQL occasionally returns wide numerics as strings)', () => {
    expect(parseMedianMinutes([[ '120' ]])).toBe(2)
  })
})

describe('runFunnelQueries — unconfigured path', () => {
  const originalApiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const originalProjectId = process.env.POSTHOG_PROJECT_ID

  beforeEach(() => {
    delete process.env.POSTHOG_PERSONAL_API_KEY
    delete process.env.POSTHOG_PROJECT_ID
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.POSTHOG_PERSONAL_API_KEY
    } else {
      process.env.POSTHOG_PERSONAL_API_KEY = originalApiKey
    }
    if (originalProjectId === undefined) {
      delete process.env.POSTHOG_PROJECT_ID
    } else {
      process.env.POSTHOG_PROJECT_ID = originalProjectId
    }
  })

  it('returns null when both env vars are unset', async () => {
    const result = await runFunnelQueries()
    expect(result).toBeNull()
  })

  it('returns null when only the API key is set', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test'
    const result = await runFunnelQueries()
    expect(result).toBeNull()
  })

  it('returns null when only the project ID is set', async () => {
    process.env.POSTHOG_PROJECT_ID = '12345'
    const result = await runFunnelQueries()
    expect(result).toBeNull()
  })
})
