/**
 * settlegrid-day-of-year — Day of Year MCP Server
 *
 * Provides date information with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_day_info(date)                    (1¢)
 *   get_today()                           (1¢)
 *   get_week_number(date)                 (1¢)
 *   days_remaining()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DateInput { date: string }

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

function getISOWeek(d: Date): number {
  const date = new Date(d.valueOf())
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day + 3)
  const firstThurs = date.valueOf()
  date.setMonth(0, 1)
  if (date.getDay() !== 4) date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7)
  return 1 + Math.ceil((firstThurs - date.valueOf()) / 604800000)
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function getDateInfo(d: Date) {
  const year = d.getFullYear()
  const daysInYear = isLeapYear(year) ? 366 : 365
  const dayOfYear = getDayOfYear(d)
  return {
    date: d.toISOString().split("T")[0],
    day_of_year: dayOfYear,
    day_of_week: WEEKDAYS[d.getDay()],
    day_of_month: d.getDate(),
    month: MONTHS[d.getMonth()],
    month_number: d.getMonth() + 1,
    year,
    iso_week: getISOWeek(d),
    quarter: Math.ceil((d.getMonth() + 1) / 3),
    is_weekend: d.getDay() === 0 || d.getDay() === 6,
    is_leap_year: isLeapYear(year),
    days_in_year: daysInYear,
    days_remaining: daysInYear - dayOfYear,
    year_progress: Math.round(dayOfYear / daysInYear * 10000) / 100,
  }
}

const sg = settlegrid.init({
  toolSlug: "day-of-year",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_day_info: { costCents: 1, displayName: "Get detailed day info" },
      get_today: { costCents: 1, displayName: "Get today's date info" },
      get_week_number: { costCents: 1, displayName: "Get ISO week number" },
      days_remaining: { costCents: 1, displayName: "Days remaining in year" },
    },
  },
})

const getDayInfo = sg.wrap(async (args: DateInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required (YYYY-MM-DD)")
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error("Invalid date format")
  return getDateInfo(d)
}, { method: "get_day_info" })

const getToday = sg.wrap(async () => {
  return getDateInfo(new Date())
}, { method: "get_today" })

const getWeekNumber = sg.wrap(async (args: DateInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required")
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error("Invalid date format")
  return { date: args.date, iso_week: getISOWeek(d), day_of_week: WEEKDAYS[d.getDay()] }
}, { method: "get_week_number" })

const daysRemaining = sg.wrap(async () => {
  const now = new Date()
  const year = now.getFullYear()
  const endOfYear = new Date(year, 11, 31)
  const remaining = Math.ceil((endOfYear.getTime() - now.getTime()) / 86400000)
  const daysInYear = isLeapYear(year) ? 366 : 365
  return { year, days_remaining: remaining, days_elapsed: daysInYear - remaining, total_days: daysInYear, progress_percent: Math.round((daysInYear - remaining) / daysInYear * 10000) / 100 }
}, { method: "days_remaining" })

export { getDayInfo, getToday, getWeekNumber, daysRemaining }

console.log("settlegrid-day-of-year MCP server ready")
console.log("Methods: get_day_info, get_today, get_week_number, days_remaining")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
