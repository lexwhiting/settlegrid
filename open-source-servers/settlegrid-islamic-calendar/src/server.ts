/**
 * settlegrid-islamic-calendar — Islamic/Hijri Calendar Conversion MCP Server
 *
 * Converts between Gregorian and Islamic/Hijri Calendar dates with holiday/event data.
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

const ISLAMIC_MONTHS = ['Muharram', 'Safar', "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Thania", 'Rajab', "Sha\'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa\'dah", "Dhu al-Hijjah"]
const HOLIDAYS: Array<{ name: string; month: number; day: number; description: string }> = [
  { name: 'Islamic New Year', month: 1, day: 1, description: 'First day of Muharram' },
  { name: 'Ashura', month: 1, day: 10, description: 'Day of remembrance' },
  { name: 'Mawlid an-Nabi', month: 3, day: 12, description: 'Birthday of Prophet Muhammad' },
  { name: 'Laylat al-Qadr', month: 9, day: 27, description: 'Night of Power (Ramadan)' },
  { name: 'Eid al-Fitr', month: 10, day: 1, description: 'End of Ramadan fasting' },
  { name: 'Eid al-Adha', month: 12, day: 10, description: 'Festival of Sacrifice' },
]

const sg = settlegrid.init({
  toolSlug: 'islamic-calendar',
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
  const l = jd - 1948440 + 10632
  const n = Math.floor((l - 1) / 10631)
  const l2 = l - 10631 * n + 354
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238)
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29
  const month = Math.floor((24 * l3) / 709)
  const day = l3 - Math.floor((709 * month) / 24)
  const year = 30 * n + j - 30
  return {
    gregorian: args.date,
    hijri: { year, month, month_name: ISLAMIC_MONTHS[month - 1] ?? 'Unknown', day },
    note: 'Approximate - actual dates depend on moon sighting',
  }
}, { method: 'convert' })

const getMonthInfo = sg.wrap(async (args: GetMonthInput) => {
  if (!Number.isFinite(args.month) || args.month < 1 || args.month > 13) throw new Error('month required (1-13)')
  const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}
  return { month: args.month, name: names[args.month - 1] ?? 'Unknown', calendar: 'Islamic/Hijri Calendar' }
}, { method: 'get_month_info' })


const getHolidays = sg.wrap(async (_a: Record<string, never>) => {
  return { holidays: HOLIDAYS, count: HOLIDAYS.length, calendar: 'Islamic (Hijri)' }
}, { method: 'get_holidays' })

export { convert, getMonthInfo, getHolidays }
console.log('settlegrid-islamic-calendar MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
