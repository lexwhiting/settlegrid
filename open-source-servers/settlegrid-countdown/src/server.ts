/**
 * settlegrid-countdown — Event Countdown MCP Server
 *
 * Provides countdown calculations with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   time_until(date)                      (1¢)
 *   time_since(date)                      (1¢)
 *   time_between(start, end)              (1¢)
 *   next_holiday(country)                 (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DateInput { date: string }
interface BetweenInput { start: string; end: string }
interface HolidayInput { country?: string }

function calcDuration(ms: number) {
  const abs = Math.abs(ms)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const minutes = Math.floor((abs % 3600000) / 60000)
  const seconds = Math.floor((abs % 60000) / 1000)
  return { days, hours, minutes, seconds, total_milliseconds: abs, total_hours: Math.round(abs / 3600000 * 100) / 100 }
}

const sg = settlegrid.init({
  toolSlug: "countdown",
  pricing: {
    defaultCostCents: 1,
    methods: {
      time_until: { costCents: 1, displayName: "Time remaining until a date" },
      time_since: { costCents: 1, displayName: "Time elapsed since a date" },
      time_between: { costCents: 1, displayName: "Duration between two dates" },
      next_holiday: { costCents: 1, displayName: "Time until next public holiday" },
    },
  },
})

const timeUntil = sg.wrap(async (args: DateInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required (ISO 8601)")
  const target = new Date(args.date)
  if (isNaN(target.getTime())) throw new Error("Invalid date format. Use ISO 8601 (e.g., 2026-12-25)")
  const now = new Date()
  const ms = target.getTime() - now.getTime()
  return { target_date: target.toISOString(), now: now.toISOString(), is_future: ms > 0, ...calcDuration(ms) }
}, { method: "time_until" })

const timeSince = sg.wrap(async (args: DateInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required (ISO 8601)")
  const past = new Date(args.date)
  if (isNaN(past.getTime())) throw new Error("Invalid date format")
  const now = new Date()
  const ms = now.getTime() - past.getTime()
  return { since_date: past.toISOString(), now: now.toISOString(), is_past: ms > 0, ...calcDuration(ms) }
}, { method: "time_since" })

const timeBetween = sg.wrap(async (args: BetweenInput) => {
  if (!args.start || !args.end) throw new Error("start and end dates are required")
  const start = new Date(args.start)
  const end = new Date(args.end)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid date format")
  const ms = end.getTime() - start.getTime()
  return { start: start.toISOString(), end: end.toISOString(), ...calcDuration(ms) }
}, { method: "time_between" })

const nextHoliday = sg.wrap(async (args: HolidayInput) => {
  const country = args.country ?? "US"
  const year = new Date().getFullYear()
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
  if (!res.ok) throw new Error(`Nager.Date API ${res.status}`)
  const holidays = await res.json() as Array<{ date: string; localName: string; name: string }>
  const now = new Date()
  const upcoming = holidays.filter((h) => new Date(h.date) > now)
  if (upcoming.length === 0) {
    const nextRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year + 1}/${country}`)
    if (nextRes.ok) {
      const nextHols = await nextRes.json() as Array<{ date: string; localName: string; name: string }>
      if (nextHols.length > 0) {
        const h = nextHols[0]
        const ms = new Date(h.date).getTime() - now.getTime()
        return { holiday: h.name, date: h.date, country, ...calcDuration(ms) }
      }
    }
    return { message: "No upcoming holidays found", country }
  }
  const h = upcoming[0]
  const ms = new Date(h.date).getTime() - now.getTime()
  return { holiday: h.name, date: h.date, country, ...calcDuration(ms) }
}, { method: "next_holiday" })

export { timeUntil, timeSince, timeBetween, nextHoliday }

console.log("settlegrid-countdown MCP server ready")
console.log("Methods: time_until, time_since, time_between, next_holiday")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
