/**
 * settlegrid-date-tools — Date/Time Tools MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   convert_timezone(date, from, to)   — Convert between timezones     (1¢)
 *   diff(date1, date2)                 — Difference between dates      (1¢)
 *   business_days(start, end)          — Count business days           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConvertInput {
  date: string
  from: string
  to: string
}

interface DiffInput {
  date1: string
  date2: string
}

interface BusinessDaysInput {
  start: string
  end: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDate(input: string, label: string): Date {
  if (!input || typeof input !== 'string') throw new Error(`${label} is required`)
  const d = new Date(input)
  if (isNaN(d.getTime())) throw new Error(`Invalid date for ${label}: "${input}"`)
  return d
}

function formatInTimezone(date: Date, tz: string): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    throw new Error(`Invalid timezone: "${tz}". Use IANA format (e.g. "America/New_York").`)
  }
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'date-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert_timezone: { costCents: 1, displayName: 'Convert Timezone' },
      diff: { costCents: 1, displayName: 'Date Difference' },
      business_days: { costCents: 1, displayName: 'Business Days' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convertTimezone = sg.wrap(async (args: ConvertInput) => {
  const date = parseDate(args.date, 'date')
  if (!args.from || typeof args.from !== 'string') throw new Error('from timezone is required')
  if (!args.to || typeof args.to !== 'string') throw new Error('to timezone is required')

  const fromFormatted = formatInTimezone(date, args.from)
  const toFormatted = formatInTimezone(date, args.to)

  const fromOffset = date.toLocaleString('en-US', { timeZone: args.from, timeZoneName: 'shortOffset' })
  const toOffset = date.toLocaleString('en-US', { timeZone: args.to, timeZoneName: 'shortOffset' })

  return {
    input: args.date,
    from: { timezone: args.from, formatted: fromFormatted, offset: fromOffset.split(', ').pop() || '' },
    to: { timezone: args.to, formatted: toFormatted, offset: toOffset.split(', ').pop() || '' },
    utc: date.toISOString(),
  }
}, { method: 'convert_timezone' })

const diff = sg.wrap(async (args: DiffInput) => {
  const d1 = parseDate(args.date1, 'date1')
  const d2 = parseDate(args.date2, 'date2')

  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)
  const totalWeeks = Math.floor(totalDays / 7)

  // Approximate months and years
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())

  return {
    date1: d1.toISOString(),
    date2: d2.toISOString(),
    isBefore: d1 < d2,
    difference: {
      milliseconds: diffMs,
      seconds: totalSeconds,
      minutes: totalMinutes,
      hours: totalHours,
      days: totalDays,
      weeks: totalWeeks,
      months: Math.abs(months),
      years: Math.floor(Math.abs(months) / 12),
    },
    humanReadable: totalDays > 365
      ? `${Math.floor(totalDays / 365)} years, ${totalDays % 365} days`
      : totalDays > 0
        ? `${totalDays} days, ${totalHours % 24} hours`
        : `${totalHours} hours, ${totalMinutes % 60} minutes`,
  }
}, { method: 'diff' })

const businessDays = sg.wrap(async (args: BusinessDaysInput) => {
  const start = parseDate(args.start, 'start')
  const end = parseDate(args.end, 'end')

  if (start > end) throw new Error('start must be before end')

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 3650) throw new Error('Range too large (max 10 years)')

  let businessCount = 0
  let weekendCount = 0
  const current = new Date(start)

  while (current <= end) {
    if (isWeekend(current)) {
      weekendCount++
    } else {
      businessCount++
    }
    current.setDate(current.getDate() + 1)
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    totalDays: diffDays + 1,
    businessDays: businessCount,
    weekendDays: weekendCount,
    fullWeeks: Math.floor((diffDays + 1) / 7),
  }
}, { method: 'business_days' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convertTimezone, diff, businessDays }

console.log('settlegrid-date-tools MCP server ready')
console.log('Methods: convert_timezone, diff, business_days')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
