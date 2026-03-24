/**
 * settlegrid-moon-phase — Moon Phase MCP Server
 *
 * Provides lunar phase calculations with SettleGrid billing.
 * No external API key required (astronomical calculations).
 *
 * Methods:
 *   get_phase(date)                       (1¢)
 *   get_current()                         (1¢)
 *   get_calendar(year, month)             (1¢)
 *   next_full_moon()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface GetPhaseInput { date: string }
interface GetCalendarInput { year: number; month: number }

const LUNAR_CYCLE = 29.53058867
const KNOWN_NEW_MOON = new Date("2000-01-06T18:14:00Z").getTime()
const PHASE_NAMES = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"]

function getMoonPhase(date: Date): { phase: number; name: string; illumination: number; age: number } {
  const diff = (date.getTime() - KNOWN_NEW_MOON) / 86400000
  const age = ((diff % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE
  const phase = Math.floor((age / LUNAR_CYCLE) * 8) % 8
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * age / LUNAR_CYCLE)) / 2 * 100) / 100
  return { phase, name: PHASE_NAMES[phase], illumination, age: Math.round(age * 100) / 100 }
}

const sg = settlegrid.init({
  toolSlug: "moon-phase",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_phase: { costCents: 1, displayName: "Get moon phase for a date" },
      get_current: { costCents: 1, displayName: "Get current moon phase" },
      get_calendar: { costCents: 1, displayName: "Get month lunar calendar" },
      next_full_moon: { costCents: 1, displayName: "Get next full moon date" },
    },
  },
})

const getPhase = sg.wrap(async (args: GetPhaseInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required (YYYY-MM-DD)")
  const date = new Date(args.date)
  if (isNaN(date.getTime())) throw new Error("Invalid date format")
  return { date: args.date, ...getMoonPhase(date) }
}, { method: "get_phase" })

const getCurrent = sg.wrap(async () => {
  const now = new Date()
  return { date: now.toISOString().split("T")[0], ...getMoonPhase(now) }
}, { method: "get_current" })

const getCalendar = sg.wrap(async (args: GetCalendarInput) => {
  if (!args.year || !args.month) throw new Error("year and month are required")
  if (args.month < 1 || args.month > 12) throw new Error("month must be 1-12")
  const daysInMonth = new Date(args.year, args.month, 0).getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(args.year, args.month - 1, d)
    const phase = getMoonPhase(date)
    days.push({ day: d, ...phase })
  }
  return { year: args.year, month: args.month, days }
}, { method: "get_calendar" })

const nextFullMoon = sg.wrap(async () => {
  const now = new Date()
  const diff = (now.getTime() - KNOWN_NEW_MOON) / 86400000
  const age = ((diff % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE
  const daysToFull = age < LUNAR_CYCLE / 2 ? LUNAR_CYCLE / 2 - age : LUNAR_CYCLE - age + LUNAR_CYCLE / 2
  const fullDate = new Date(now.getTime() + daysToFull * 86400000)
  return { next_full_moon: fullDate.toISOString().split("T")[0], days_until: Math.round(daysToFull * 100) / 100, current_phase: getMoonPhase(now).name }
}, { method: "next_full_moon" })

export { getPhase, getCurrent, getCalendar, nextFullMoon }

console.log("settlegrid-moon-phase MCP server ready")
console.log("Methods: get_phase, get_current, get_calendar, next_full_moon")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
