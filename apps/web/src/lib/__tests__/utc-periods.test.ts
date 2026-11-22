import { describe, it, expect, afterEach } from 'vitest'
import { utcDayStart, utcMonthStart, utcNextMonthStart, utcMonthKey, daysBefore, hoursBefore } from '@/lib/utc-periods'

// The helpers must give UTC boundaries whatever the server's time zone. Node applies a
// change to process.env.TZ at once; vitest runs each test file in its own process.
const saved = process.env.TZ
afterEach(() => {
  if (saved === undefined) delete process.env.TZ
  else process.env.TZ = saved
})

describe('utc-periods', () => {
  // 04:30 on Nov 1 in UTC is 21:30 on Oct 31 in Los Angeles, and 13:30 on Nov 1 in Tokyo.
  const now = new Date('2026-11-01T04:30:00.000Z')

  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    it(`gives UTC days and months on a server in ${tz}`, () => {
      process.env.TZ = tz
      expect(utcDayStart(now).toISOString()).toBe('2026-11-01T00:00:00.000Z')
      expect(utcMonthStart(now).toISOString()).toBe('2026-11-01T00:00:00.000Z')
      expect(utcNextMonthStart(now).toISOString()).toBe('2026-12-01T00:00:00.000Z')
      expect(utcMonthKey(now)).toBe('2026-11')
    })
  }

  it('reads the server clock in another zone (so the cases above are not vacuous)', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(now.getMonth()).toBe(9) // October, locally
    expect(new Date(now.getFullYear(), now.getMonth(), 1).toISOString()).toBe('2026-10-01T07:00:00.000Z') // the old code's month start
  })

  it('rolls over the year in December', () => {
    const dec = new Date('2026-12-31T23:59:59.999Z')
    expect(utcNextMonthStart(dec).toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(utcMonthKey(dec)).toBe('2026-12')
  })

  it('counts rolling windows in exact hours, across a daylight-saving change', () => {
    process.env.TZ = 'America/Los_Angeles' // clocks went back at 09:00 UTC on Nov 1, 2026
    const after = new Date('2026-11-03T12:00:00.000Z')
    expect(daysBefore(after, 7).toISOString()).toBe('2026-10-27T12:00:00.000Z')
    expect(hoursBefore(after, 1).toISOString()).toBe('2026-11-03T11:00:00.000Z')
  })
})

describe('routes use UTC periods (source guard)', () => {
  // Files whose day and month boundaries are UTC. Local-time Date maths in them would put
  // the boundary at the server's midnight instead.
  const files = [
    'app/api/consumer/explorer/route.ts',
    'app/api/cron/aggregate-usage/route.ts',
    'lib/analytics.ts',
    'app/api/dashboard/developer/usage/route.ts',
    'app/api/dashboard/developer/fraud/signals/route.ts',
    'app/api/dashboard/developer/stats/advanced/route.ts',
    'app/api/proxy/stats/route.ts',
  ]
  const LOCAL = /new Date\(\s*now\.getFullYear\(\)|\.setHours\(|\.setDate\(|\.getMonth\(\)|\.getDate\(\)/

  it('has no local-time date maths in those files', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const offenders = files.filter((rel) => LOCAL.test(readFileSync(path.resolve(__dirname, '../..', rel), 'utf8')))
    expect(offenders).toEqual([])
  })

  it('takes the explorer and usage-job boundaries from utc-periods', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const read = (rel: string) => readFileSync(path.resolve(__dirname, '../..', rel), 'utf8')
    const explorer = read('app/api/consumer/explorer/route.ts')
    expect(explorer).toContain("from '@/lib/utc-periods'")
    expect(explorer).toMatch(/case 'today':\s*return utcDayStart\(now\)/)
    expect(explorer).toMatch(/case 'month':\s*default:\s*return utcMonthStart\(now\)/)
    expect(explorer).toContain('const todayCutoff = utcDayStart(now)')
    expect(explorer).toContain('const monthCutoff = utcMonthStart(now)')
    const job = read('app/api/cron/aggregate-usage/route.ts')
    expect(job).toContain('const periodStart = utcMonthStart(now)')
    expect(job).toContain('const periodEnd = utcNextMonthStart(now)')
    expect(job).toContain('const monthKey = utcMonthKey(now)')
  })
})
