/**
 * settlegrid-julian-calendar — Julian Calendar Conversion MCP Server
 *
 * Converts between Gregorian and Julian Calendar dates with holiday/event data.
 * All calculations done locally using standard algorithms.
 *
 * Methods:
 *   convert(date)                 — Convert Gregorian date           (1c)
 *   get_month_info(month)         — Get month information           (1c)
 *   Additional method varies by calendar                            (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ConvertInput { date: string }
interface GetMonthInput { month: number }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const sg = settlegrid.init({
  toolSlug: 'julian-calendar',
  pricing: { defaultCostCents: 1, methods: {
    convert: { costCents: 1, displayName: 'Convert Date' },
    get_month_info: { costCents: 1, displayName: 'Get Month Info' },
    get_difference: { costCents: 1, displayName: 'Get Difference' },
  }},
})

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.date) throw new Error('date required (YYYY-MM-DD)')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date')

  const jd = Math.floor(d.getTime() / 86400000 + 2440587.5)
  const b = 0
  const c = jd + 32082 + b
  const dd = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor(1461 * dd / 4)
  const m = Math.floor((5 * e + 2) / 153)
  const day = e - Math.floor((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * Math.floor(m / 10)
  const year = dd - 4800 + Math.floor(m / 10)
  const diff = Math.floor(d.getFullYear() / 100) - Math.floor(d.getFullYear() / 400) - 2
  return {
    gregorian: args.date,
    julian: { year, month, month_name: MONTH_NAMES[month - 1] ?? 'Unknown', day },
    gregorian_offset_days: diff,
    note: 'Julian calendar currently runs 13 days behind Gregorian',
  }
}, { method: 'convert' })

const getMonthInfo = sg.wrap(async (args: GetMonthInput) => {
  if (!Number.isFinite(args.month) || args.month < 1 || args.month > 13) throw new Error('month required (1-13)')
  const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}
  return { month: args.month, name: names[args.month - 1] ?? 'Unknown', calendar: 'Julian Calendar' }
}, { method: 'get_month_info' })


const getDifference = sg.wrap(async (args: { year?: number }) => {
  const year = args.year ?? new Date().getFullYear()
  const diff = Math.floor(year / 100) - Math.floor(year / 400) - 2
  return { year, difference_days: diff, note: `Julian dates are ${diff} days behind Gregorian in year ${year}` }
}, { method: 'get_difference' })

export { convert, getMonthInfo, getDifference }
console.log('settlegrid-julian-calendar MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
