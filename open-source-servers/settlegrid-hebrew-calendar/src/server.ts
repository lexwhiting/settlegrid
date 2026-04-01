/**
 * settlegrid-hebrew-calendar — Hebrew Calendar Conversion MCP Server
 *
 * Converts between Gregorian and Hebrew Calendar dates with holiday/event data.
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

const HEBREW_MONTHS = ['Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul']
const HOLIDAYS: Array<{ name: string; month: number; day: number; description: string }> = [
  { name: 'Rosh Hashanah', month: 1, day: 1, description: 'Jewish New Year' },
  { name: 'Yom Kippur', month: 1, day: 10, description: 'Day of Atonement' },
  { name: 'Sukkot', month: 1, day: 15, description: 'Feast of Tabernacles' },
  { name: 'Hanukkah', month: 3, day: 25, description: 'Festival of Lights (8 days)' },
  { name: 'Purim', month: 6, day: 14, description: 'Celebration of deliverance' },
  { name: 'Passover', month: 7, day: 15, description: 'Exodus from Egypt (8 days)' },
  { name: 'Shavuot', month: 9, day: 6, description: 'Feast of Weeks / Torah giving' },
]

const sg = settlegrid.init({
  toolSlug: 'hebrew-calendar',
  pricing: { defaultCostCents: 1, methods: {
    convert: { costCents: 1, displayName: 'Convert Date' },
    get_month_info: { costCents: 1, displayName: 'Get Month Info' },
    get_holidays: { costCents: 1, displayName: 'Get Holidays' },
  }},
})

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.date) throw new Error('date required (YYYY-MM-DD)')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date')

  const jd = Math.floor(d.getTime() / 86400000 + 2440587.5)
  const elapsed = jd - 347997
  const yearApprox = Math.floor((elapsed * 98496) / 35975351) + 1
  const monthApprox = Math.max(1, Math.min(12, Math.floor(((jd - 347997) % 384) / 30) + 1))
  const dayApprox = Math.max(1, ((jd - 347997) % 30) + 1)
  return {
    gregorian: args.date,
    hebrew: { year: yearApprox + 3760, month: monthApprox, month_name: HEBREW_MONTHS[monthApprox - 1] ?? 'Unknown', day: dayApprox },
    note: 'Approximate calculation',
  }
}, { method: 'convert' })

const getMonthInfo = sg.wrap(async (args: GetMonthInput) => {
  if (!Number.isFinite(args.month) || args.month < 1 || args.month > 13) throw new Error('month required (1-13)')
  const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}
  return { month: args.month, name: names[args.month - 1] ?? 'Unknown', calendar: 'Hebrew Calendar' }
}, { method: 'get_month_info' })


const getHolidays = sg.wrap(async (_a: Record<string, never>) => {
  return { holidays: HOLIDAYS, count: HOLIDAYS.length, calendar: 'Hebrew' }
}, { method: 'get_holidays' })

export { convert, getMonthInfo, getHolidays }
console.log('settlegrid-hebrew-calendar MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
