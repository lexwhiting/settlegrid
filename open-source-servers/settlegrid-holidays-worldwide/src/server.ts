/**
 * settlegrid-holidays-worldwide — Holidays Worldwide MCP Server
 *
 * Wraps the Nager.Date API for public holidays with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_holidays(country, year)        — Public holidays          (1¢)
 *   get_long_weekends(country, year)   — Long weekends            (1¢)
 *   next_holiday(country)              — Next upcoming holiday    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HolidayInput { country: string; year: number }
interface NextInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://date.nager.at/api/v3'

async function nagerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Country not found or no data available')
    const body = await res.text().catch(() => '')
    throw new Error(`Nager.Date API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateCountry(code: string): string {
  if (!code || typeof code !== 'string') throw new Error('country is required')
  const upper = code.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(upper)) throw new Error('country must be a 2-letter ISO code')
  return upper
}

function validateYear(year: number): number {
  if (typeof year !== 'number' || year < 1900 || year > 2100) throw new Error('year must be between 1900 and 2100')
  return Math.round(year)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'holidays-worldwide',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_holidays: { costCents: 1, displayName: 'Get Holidays' },
      get_long_weekends: { costCents: 1, displayName: 'Long Weekends' },
      next_holiday: { costCents: 1, displayName: 'Next Holiday' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHolidays = sg.wrap(async (args: HolidayInput) => {
  const country = validateCountry(args.country)
  const year = validateYear(args.year)
  const data = await nagerFetch<Array<{ date: string; localName: string; name: string; global: boolean; types: string[] }>>(`/PublicHolidays/${year}/${country}`)
  return { country, year, count: data.length, holidays: data.map(h => ({ date: h.date, name: h.name, localName: h.localName, global: h.global, types: h.types })) }
}, { method: 'get_holidays' })

const getLongWeekends = sg.wrap(async (args: HolidayInput) => {
  const country = validateCountry(args.country)
  const year = validateYear(args.year)
  const data = await nagerFetch<Array<{ startDate: string; endDate: string; dayCount: number; needBridgeDay: boolean }>>(`/LongWeekend/${year}/${country}`)
  return { country, year, count: data.length, longWeekends: data }
}, { method: 'get_long_weekends' })

const nextHoliday = sg.wrap(async (args: NextInput) => {
  const country = validateCountry(args.country)
  const data = await nagerFetch<Array<{ date: string; localName: string; name: string; global: boolean; types: string[] }>>(`/NextPublicHolidays/${country}`)
  const next = data[0]
  return next
    ? { country, date: next.date, name: next.name, localName: next.localName, global: next.global, types: next.types, totalUpcoming: data.length }
    : { country, message: 'No upcoming holidays found' }
}, { method: 'next_holiday' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHolidays, getLongWeekends, nextHoliday }

console.log('settlegrid-holidays-worldwide MCP server ready')
console.log('Methods: get_holidays, get_long_weekends, next_holiday')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
