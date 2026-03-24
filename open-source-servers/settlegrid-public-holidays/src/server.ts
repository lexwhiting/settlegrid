/**
 * settlegrid-public-holidays — Public Holidays MCP Server
 *
 * Wraps the free Nager.Date API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_holidays(country, year)           — Public holidays for a country/year  (1¢)
 *   is_holiday(country, date)             — Check if a date is a holiday        (1¢)
 *   get_long_weekends(country, year)      — Long weekends in a country/year     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHolidaysInput {
  country: string
  year?: number
}

interface IsHolidayInput {
  country: string
  date: string
}

interface GetLongWeekendsInput {
  country: string
  year?: number
}

interface NagerHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  types: string[]
}

interface NagerLongWeekend {
  startDate: string
  endDate: string
  dayCount: number
  needBridgeDay: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://date.nager.at/api/v3'

function validateCountryCode(code: string): string {
  const upper = code.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(upper)) {
    throw new Error(`Invalid country code "${code}". Use ISO 3166-1 alpha-2 (e.g. "US", "DE", "JP")`)
  }
  return upper
}

async function nagerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (res.status === 404) {
    throw new Error('Country not found or not supported. Use a valid ISO 3166-1 alpha-2 country code.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Nager.Date API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'public-holidays',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_holidays: { costCents: 1, displayName: 'Get Holidays' },
      is_holiday: { costCents: 1, displayName: 'Check Holiday' },
      get_long_weekends: { costCents: 1, displayName: 'Long Weekends' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHolidays = sg.wrap(async (args: GetHolidaysInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO 3166-1 alpha-2 code, e.g. "US", "DE")')
  }
  const country = validateCountryCode(args.country)
  const year = args.year ?? new Date().getFullYear()

  if (year < 1900 || year > 2100) {
    throw new Error('year must be between 1900 and 2100')
  }

  const holidays = await nagerFetch<NagerHoliday[]>(`/PublicHolidays/${year}/${country}`)

  return {
    country,
    year,
    count: holidays.length,
    holidays: holidays.map((h) => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      types: h.types,
      isFixed: h.fixed,
      isNationwide: h.global,
    })),
  }
}, { method: 'get_holidays' })

const isHoliday = sg.wrap(async (args: IsHolidayInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO 3166-1 alpha-2 code)')
  }
  if (!args.date || typeof args.date !== 'string') {
    throw new Error('date is required (YYYY-MM-DD format)')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error('date must be in YYYY-MM-DD format (e.g. "2024-12-25")')
  }

  const country = validateCountryCode(args.country)
  const year = parseInt(args.date.split('-')[0], 10)

  const holidays = await nagerFetch<NagerHoliday[]>(`/PublicHolidays/${year}/${country}`)
  const match = holidays.find((h) => h.date === args.date)

  return {
    country,
    date: args.date,
    isHoliday: !!match,
    holiday: match
      ? {
          name: match.name,
          localName: match.localName,
          types: match.types,
          isFixed: match.fixed,
          isNationwide: match.global,
        }
      : null,
  }
}, { method: 'is_holiday' })

const getLongWeekends = sg.wrap(async (args: GetLongWeekendsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO 3166-1 alpha-2 code)')
  }
  const country = validateCountryCode(args.country)
  const year = args.year ?? new Date().getFullYear()

  if (year < 1900 || year > 2100) {
    throw new Error('year must be between 1900 and 2100')
  }

  const weekends = await nagerFetch<NagerLongWeekend[]>(`/LongWeekend/${year}/${country}`)

  return {
    country,
    year,
    count: weekends.length,
    longWeekends: weekends.map((w) => ({
      startDate: w.startDate,
      endDate: w.endDate,
      dayCount: w.dayCount,
      needsBridgeDay: w.needBridgeDay,
    })),
  }
}, { method: 'get_long_weekends' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHolidays, isHoliday, getLongWeekends }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'public-holidays',
//   pricing: { defaultCostCents: 1 },
//   routes: { ... },
// })

console.log('settlegrid-public-holidays MCP server ready')
console.log('Methods: get_holidays, is_holiday, get_long_weekends')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
