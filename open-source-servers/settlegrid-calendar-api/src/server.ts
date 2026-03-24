/**
 * settlegrid-calendar-api — Calendar & Date MCP Server
 *
 * Wraps WorldTimeAPI + Nager.Date for calendar data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_current_date(timezone)     — Current date info      (1¢)
 *   get_holidays(country, year)    — Public holidays         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DateInput { timezone: string }
interface HolidayInput { country: string; year: number }

interface HolidayEntry {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  types: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIME_BASE = 'https://worldtimeapi.org/api'
const HOLIDAY_BASE = 'https://date.nager.at/api/v3'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'calendar-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current_date: { costCents: 1, displayName: 'Current Date Info' },
      get_holidays: { costCents: 1, displayName: 'Get Holidays' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrentDate = sg.wrap(async (args: DateInput) => {
  if (!args.timezone || typeof args.timezone !== 'string') throw new Error('timezone is required')
  const tz = args.timezone.trim()
  if (!/^[A-Za-z_]+\/[A-Za-z_\/]+$/.test(tz)) throw new Error('Invalid timezone format')

  const data = await apiFetch<{
    datetime: string; utc_datetime: string; utc_offset: string
    day_of_week: number; day_of_year: number; week_number: number
    timezone: string; abbreviation: string
  }>(`${TIME_BASE}/timezone/${tz}`)

  const dt = new Date(data.datetime)
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return {
    timezone: data.timezone,
    datetime: data.datetime,
    utcOffset: data.utc_offset,
    dayOfWeek: DAYS[data.day_of_week],
    dayOfYear: data.day_of_year,
    weekNumber: data.week_number,
    month: MONTHS[dt.getMonth()],
    year: dt.getFullYear(),
    isLeapYear: dt.getFullYear() % 4 === 0 && (dt.getFullYear() % 100 !== 0 || dt.getFullYear() % 400 === 0),
    daysInYear: dt.getFullYear() % 4 === 0 && (dt.getFullYear() % 100 !== 0 || dt.getFullYear() % 400 === 0) ? 366 : 365,
  }
}, { method: 'get_current_date' })

const getHolidays = sg.wrap(async (args: HolidayInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('country must be a 2-letter ISO code')
  if (typeof args.year !== 'number' || args.year < 1900 || args.year > 2100) throw new Error('year must be between 1900 and 2100')
  const year = Math.round(args.year)
  const data = await apiFetch<HolidayEntry[]>(`${HOLIDAY_BASE}/PublicHolidays/${year}/${country}`)
  return {
    country,
    year,
    count: data.length,
    holidays: data.map(h => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      global: h.global,
      types: h.types,
    })),
  }
}, { method: 'get_holidays' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrentDate, getHolidays }

console.log('settlegrid-calendar-api MCP server ready')
console.log('Methods: get_current_date, get_holidays')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
