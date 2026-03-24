/**
 * settlegrid-leap-year — Leap Year Checker MCP Server
 *
 * Provides leap year calculations with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   check(year)                           (1¢)
 *   next_leap(from_year)                  (1¢)
 *   list_range(start, end)                (1¢)
 *   year_info(year)                       (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckInput { year: number }
interface NextLeapInput { from_year?: number }
interface ListRangeInput { start: number; end: number }
interface YearInfoInput { year: number }

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const sg = settlegrid.init({
  toolSlug: "leap-year",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check: { costCents: 1, displayName: "Check if year is a leap year" },
      next_leap: { costCents: 1, displayName: "Find next leap year" },
      list_range: { costCents: 1, displayName: "List leap years in range" },
      year_info: { costCents: 1, displayName: "Get detailed year info" },
    },
  },
})

const check = sg.wrap(async (args: CheckInput) => {
  if (args.year === undefined || typeof args.year !== "number") throw new Error("year is required (number)")
  const leap = isLeap(args.year)
  return {
    year: args.year, is_leap_year: leap, days_in_year: leap ? 366 : 365,
    february_days: leap ? 29 : 28,
    reason: leap
      ? args.year % 400 === 0 ? "Divisible by 400" : "Divisible by 4 but not 100"
      : args.year % 100 === 0 ? "Divisible by 100 but not 400" : "Not divisible by 4",
  }
}, { method: "check" })

const nextLeap = sg.wrap(async (args: NextLeapInput) => {
  let year = args.from_year ?? new Date().getFullYear()
  year++
  while (!isLeap(year)) year++
  return { from: args.from_year ?? new Date().getFullYear(), next_leap_year: year, years_until: year - (args.from_year ?? new Date().getFullYear()) }
}, { method: "next_leap" })

const listRange = sg.wrap(async (args: ListRangeInput) => {
  if (args.start === undefined || args.end === undefined) throw new Error("start and end years are required")
  if (args.end - args.start > 1000) throw new Error("Range too large (max 1000 years)")
  const leaps = []
  for (let y = args.start; y <= args.end; y++) {
    if (isLeap(y)) leaps.push(y)
  }
  return { start: args.start, end: args.end, count: leaps.length, leap_years: leaps }
}, { method: "list_range" })

const yearInfo = sg.wrap(async (args: YearInfoInput) => {
  if (args.year === undefined || typeof args.year !== "number") throw new Error("year is required")
  const leap = isLeap(args.year)
  const firstDay = new Date(args.year, 0, 1)
  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return {
    year: args.year, is_leap_year: leap, days_in_year: leap ? 366 : 365,
    starts_on: WEEKDAYS[firstDay.getDay()],
    months: MONTHS.map((name, i) => ({ name, days: monthDays[i] })),
    century: Math.ceil(args.year / 100),
  }
}, { method: "year_info" })

export { check, nextLeap, listRange, yearInfo }

console.log("settlegrid-leap-year MCP server ready")
console.log("Methods: check, next_leap, list_range, year_info")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
