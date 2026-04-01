/**
 * settlegrid-mayan-calendar — Mayan Calendar Conversion MCP Server
 *
 * Converts between Gregorian and Mayan Calendar dates with holiday/event data.
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

const TZOLKIN_NAMES = ['Imix', 'Ik', 'Akbal', 'Kan', 'Chicchan', 'Cimi', 'Manik', 'Lamat', 'Muluc', 'Oc', 'Chuen', 'Eb', 'Ben', 'Ix', 'Men', 'Cib', 'Caban', 'Etznab', 'Cauac', 'Ahau']
const HAAB_MONTHS = ['Pop', 'Uo', 'Zip', 'Zotz', 'Tzec', 'Xul', 'Yaxkin', 'Mol', 'Chen', 'Yax', 'Zac', 'Ceh', 'Mac', 'Kankin', 'Muan', 'Pax', 'Kayab', 'Cumku', 'Wayeb']

const sg = settlegrid.init({
  toolSlug: 'mayan-calendar',
  pricing: { defaultCostCents: 1, methods: {
    convert: { costCents: 1, displayName: 'Convert Date' },
    get_month_info: { costCents: 1, displayName: 'Get Month Info' },
    get_calendar_round: { costCents: 1, displayName: 'Get Calendar Round' },
  }},
})

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.date) throw new Error('date required (YYYY-MM-DD)')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date')

  const jd = Math.floor(d.getTime() / 86400000 + 2440587.5)
  // Mayan Long Count correlation (GMT: 584283)
  const daysSinceCreation = jd - 584283
  const baktun = Math.floor(daysSinceCreation / 144000)
  const remainder1 = daysSinceCreation % 144000
  const katun = Math.floor(remainder1 / 7200)
  const remainder2 = remainder1 % 7200
  const tun = Math.floor(remainder2 / 360)
  const remainder3 = remainder2 % 360
  const uinal = Math.floor(remainder3 / 20)
  const kin = remainder3 % 20
  // Tzolkin
  const tzolkinNum = ((daysSinceCreation + 3) % 13) + 1
  const tzolkinName = TZOLKIN_NAMES[(daysSinceCreation + 19) % 20]
  // Haab
  const haabDays = (daysSinceCreation + 348) % 365
  const haabMonth = HAAB_MONTHS[Math.floor(haabDays / 20)]
  const haabDay = haabDays % 20
  return {
    gregorian: args.date,
    long_count: `${baktun}.${katun}.${tun}.${uinal}.${kin}`,
    tzolkin: `${tzolkinNum} ${tzolkinName}`,
    haab: `${haabDay} ${haabMonth ?? 'Wayeb'}`,
    days_since_creation: daysSinceCreation,
    note: 'Uses GMT correlation constant (584283)',
  }
}, { method: 'convert' })

const getMonthInfo = sg.wrap(async (args: GetMonthInput) => {
  if (!Number.isFinite(args.month) || args.month < 1 || args.month > 13) throw new Error('month required (1-13)')
  const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}
  return { month: args.month, name: names[args.month - 1] ?? 'Unknown', calendar: 'Mayan Calendar' }
}, { method: 'get_month_info' })


const getCalendarRound = sg.wrap(async (args: { date?: string }) => {
  const d = new Date(args.date ?? new Date().toISOString().slice(0, 10))
  if (isNaN(d.getTime())) throw new Error('Invalid date')
  const jd = Math.floor(d.getTime() / 86400000 + 2440587.5)
  const ds = jd - 584283
  const tzNum = ((ds + 3) % 13) + 1
  const tzName = TZOLKIN_NAMES[(ds + 19) % 20]
  const haabDays = (ds + 348) % 365
  const haabMonth = HAAB_MONTHS[Math.floor(haabDays / 20)]
  return { date: args.date ?? 'today', calendar_round: `${tzNum} ${tzName} ${haabDays % 20} ${haabMonth ?? 'Wayeb'}`, tzolkin_cycle: 260, haab_cycle: 365, calendar_round_cycle: 18980 }
}, { method: 'get_calendar_round' })

export { convert, getMonthInfo, getCalendarRound }
console.log('settlegrid-mayan-calendar MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
