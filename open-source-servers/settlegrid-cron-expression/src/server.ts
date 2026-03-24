/**
 * settlegrid-cron-expression — Cron Expression Parser MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   parse(expression)                — Validate and parse a cron expression  (1¢)
 *   next_runs(expression, count)     — Compute next N run times              (1¢)
 *   describe(expression)             — Human-readable description            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParseInput {
  expression: string
}

interface NextRunsInput {
  expression: string
  count?: number
}

interface CronFields {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error('Cron expression must have 5 fields: minute hour day-of-month month day-of-week')
  }
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  }
}

function expandField(field: string, min: number, max: number): number[] {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    const step = stepMatch ? parseInt(stepMatch[2]) : 1
    const range = stepMatch ? stepMatch[1] : part
    if (range === '*') {
      for (let i = min; i <= max; i += step) values.add(i)
    } else if (range.includes('-')) {
      const [start, end] = range.split('-').map(Number)
      if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range: ${range}`)
      for (let i = start; i <= end; i += step) values.add(i)
    } else {
      const val = parseInt(range)
      if (isNaN(val) || val < min || val > max) throw new Error(`Invalid value: ${range}`)
      values.add(val)
    }
  }
  return Array.from(values).sort((a, b) => a - b)
}

function matchesCron(date: Date, fields: CronFields): boolean {
  const minutes = expandField(fields.minute, 0, 59)
  const hours = expandField(fields.hour, 0, 23)
  const doms = expandField(fields.dayOfMonth, 1, 31)
  const months = expandField(fields.month, 1, 12)
  const dows = expandField(fields.dayOfWeek, 0, 6)

  return (
    minutes.includes(date.getMinutes()) &&
    hours.includes(date.getHours()) &&
    doms.includes(date.getDate()) &&
    months.includes(date.getMonth() + 1) &&
    dows.includes(date.getDay())
  )
}

function describeField(field: string, names: string[] | null, unit: string): string {
  if (field === '*') return `every ${unit}`
  if (field.includes('/')) {
    const [, step] = field.split('/')
    return `every ${step} ${unit}s`
  }
  if (field.includes('-')) {
    const [start, end] = field.split('-')
    const startName = names ? names[parseInt(start)] || start : start
    const endName = names ? names[parseInt(end)] || end : end
    return `${startName} through ${endName}`
  }
  if (names) {
    return field.split(',').map((v) => names[parseInt(v)] || v).join(', ')
  }
  return field
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cron-expression',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse: { costCents: 1, displayName: 'Parse Expression' },
      next_runs: { costCents: 1, displayName: 'Next Run Times' },
      describe: { costCents: 1, displayName: 'Describe Expression' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const parse = sg.wrap(async (args: ParseInput) => {
  if (!args.expression || typeof args.expression !== 'string') {
    throw new Error('expression is required (e.g. "0 9 * * 1-5")')
  }
  const fields = parseCron(args.expression)

  // Validate each field by expanding it
  expandField(fields.minute, 0, 59)
  expandField(fields.hour, 0, 23)
  expandField(fields.dayOfMonth, 1, 31)
  expandField(fields.month, 1, 12)
  expandField(fields.dayOfWeek, 0, 6)

  return {
    expression: args.expression,
    valid: true,
    fields,
    minutes: expandField(fields.minute, 0, 59),
    hours: expandField(fields.hour, 0, 23),
    daysOfMonth: expandField(fields.dayOfMonth, 1, 31),
    months: expandField(fields.month, 1, 12),
    daysOfWeek: expandField(fields.dayOfWeek, 0, 6),
  }
}, { method: 'parse' })

const nextRuns = sg.wrap(async (args: NextRunsInput) => {
  if (!args.expression || typeof args.expression !== 'string') {
    throw new Error('expression is required (e.g. "0 9 * * 1-5")')
  }
  const count = Math.min(Math.max(args.count || 5, 1), 20)
  const fields = parseCron(args.expression)

  const runs: string[] = []
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0)

  // Search forward minute by minute, up to 1 year
  const maxIterations = 525960 // ~1 year of minutes
  for (let i = 0; i < maxIterations && runs.length < count; i++) {
    const check = new Date(current.getTime() + i * 60000)
    if (matchesCron(check, fields)) {
      runs.push(check.toISOString())
    }
  }

  return {
    expression: args.expression,
    count: runs.length,
    nextRuns: runs,
  }
}, { method: 'next_runs' })

const describe = sg.wrap(async (args: ParseInput) => {
  if (!args.expression || typeof args.expression !== 'string') {
    throw new Error('expression is required (e.g. "0 9 * * 1-5")')
  }
  const fields = parseCron(args.expression)

  const parts = [
    `At ${describeField(fields.minute, null, 'minute')} past ${describeField(fields.hour, null, 'hour')}`,
    fields.dayOfMonth !== '*' ? `on day ${fields.dayOfMonth} of the month` : '',
    fields.month !== '*' ? `in ${describeField(fields.month, MONTH_NAMES, 'month')}` : '',
    fields.dayOfWeek !== '*' ? `on ${describeField(fields.dayOfWeek, DAY_NAMES, 'day')}` : '',
  ].filter(Boolean)

  return {
    expression: args.expression,
    description: parts.join(', '),
    fields,
  }
}, { method: 'describe' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { parse, nextRuns, describe }

console.log('settlegrid-cron-expression MCP server ready')
console.log('Methods: parse, next_runs, describe')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
