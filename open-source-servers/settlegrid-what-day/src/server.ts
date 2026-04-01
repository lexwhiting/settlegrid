/**
 * settlegrid-what-day — Date & Day Calculator MCP Server
 *
 * Date & Day Calculator tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetDayInput { date?: string }
interface DaysBetweenInput { date_a: string; date_b: string }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const sg = settlegrid.init({ toolSlug: 'what-day', pricing: { defaultCostCents: 1, methods: {
  get_day_info: { costCents: 1, displayName: 'Get Day Info' },
  days_between: { costCents: 1, displayName: 'Days Between' },
  add_days: { costCents: 1, displayName: 'Add Days' },
}}})

const getDayInfo = sg.wrap(async (args: GetDayInput) => {
  const d = args.date ? new Date(args.date) : new Date()
  if (isNaN(d.getTime())) throw new Error('Invalid date')
  const start = new Date(d.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000)
  const isLeap = (d.getFullYear() % 4 === 0 && d.getFullYear() % 100 !== 0) || d.getFullYear() % 400 === 0
  return { date: d.toISOString().slice(0, 10), day_name: DAYS[d.getDay()], month_name: MONTHS[d.getMonth()], day_of_year: dayOfYear, week_of_year: Math.ceil(dayOfYear / 7), is_weekend: d.getDay() === 0 || d.getDay() === 6, is_leap_year: isLeap, quarter: Math.ceil((d.getMonth() + 1) / 3), days_remaining_in_year: (isLeap ? 366 : 365) - dayOfYear, unix_timestamp: Math.floor(d.getTime() / 1000) }
}, { method: 'get_day_info' })

const daysBetween = sg.wrap(async (args: DaysBetweenInput) => {
  if (!args.date_a || !args.date_b) throw new Error('date_a and date_b required')
  const a = new Date(args.date_a); const b = new Date(args.date_b)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) throw new Error('Invalid date(s)')
  const days = Math.floor(Math.abs(b.getTime() - a.getTime()) / 86400000)
  return { date_a: args.date_a, date_b: args.date_b, days, weeks: Math.floor(days / 7), months_approx: Math.round(days / 30.44 * 10) / 10, years_approx: Math.round(days / 365.25 * 100) / 100, business_days_approx: Math.floor(days * 5 / 7) }
}, { method: 'days_between' })

const addDays = sg.wrap(async (args: { date: string; days: number }) => {
  if (!args.date || !Number.isFinite(args.days)) throw new Error('date and days required')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date')
  d.setDate(d.getDate() + args.days)
  return { original: args.date, days_added: args.days, result: d.toISOString().slice(0, 10), result_day: DAYS[d.getDay()] }
}, { method: 'add_days' })

export { getDayInfo, daysBetween, addDays }
console.log('settlegrid-what-day MCP server ready | Powered by SettleGrid')
