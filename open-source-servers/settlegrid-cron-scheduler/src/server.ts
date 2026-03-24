/**
 * settlegrid-cron-scheduler — Cron Expression Parsing MCP Server
 *
 * Parse cron expressions and calculate next execution times. All local.
 *
 * Methods:
 *   parse_cron(expression) — Parse and explain a cron expression (free)
 *   next_runs(expression, count?) — Get next N execution times (free)
 *   cron_presets() — List common cron presets (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CronInput { expression: string }
interface NextRunsInput { expression: string; count?: number }

const PRESETS: Record<string, { expression: string; description: string }> = {
  '@yearly': { expression: '0 0 1 1 *', description: 'Once a year (Jan 1 midnight)' },
  '@annually': { expression: '0 0 1 1 *', description: 'Once a year (Jan 1 midnight)' },
  '@monthly': { expression: '0 0 1 * *', description: 'First day of every month midnight' },
  '@weekly': { expression: '0 0 * * 0', description: 'Every Sunday midnight' },
  '@daily': { expression: '0 0 * * *', description: 'Every day at midnight' },
  '@midnight': { expression: '0 0 * * *', description: 'Every day at midnight' },
  '@hourly': { expression: '0 * * * *', description: 'Every hour at minute 0' },
  '@every_5min': { expression: '*/5 * * * *', description: 'Every 5 minutes' },
  '@every_15min': { expression: '*/15 * * * *', description: 'Every 15 minutes' },
  '@every_30min': { expression: '*/30 * * * *', description: 'Every 30 minutes' },
}

const FIELD_NAMES = ['minute', 'hour', 'day of month', 'month', 'day of week'] as const
const FIELD_RANGES: Array<[number, number]> = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]]
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function expandField(field: string, min: number, max: number): number[] {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min)
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    if (stepMatch) {
      const step = parseInt(stepMatch[2])
      const base = stepMatch[1] === '*' ? min : parseInt(stepMatch[1])
      for (let i = base; i <= max; i += step) values.add(i)
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) values.add(i)
    } else {
      values.add(parseInt(part))
    }
  }
  return [...values].filter(v => v >= min && v <= max).sort((a, b) => a - b)
}

function describeField(field: string, index: number): string {
  if (field === '*') return `every ${FIELD_NAMES[index]}`
  if (field.startsWith('*/')) return `every ${field.slice(2)} ${FIELD_NAMES[index]}s`
  if (index === 3) {
    return field.split(',').map(v => MONTH_NAMES[parseInt(v)] || v).join(', ')
  }
  if (index === 4) {
    return field.split(',').map(v => DAY_NAMES[parseInt(v)] || v).join(', ')
  }
  return `${FIELD_NAMES[index]} ${field}`
}

function getNextRuns(fields: string[], count: number): string[] {
  const runs: string[] = []
  const expanded = fields.map((f, i) => expandField(f, FIELD_RANGES[i][0], FIELD_RANGES[i][1]))
  const now = new Date()
  const cursor = new Date(now)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  const limit = 365 * 24 * 60
  let iterations = 0
  while (runs.length < count && iterations < limit) {
    iterations++
    const minute = cursor.getMinutes()
    const hour = cursor.getHours()
    const dom = cursor.getDate()
    const month = cursor.getMonth() + 1
    const dow = cursor.getDay()
    if (
      expanded[0].includes(minute) &&
      expanded[1].includes(hour) &&
      expanded[2].includes(dom) &&
      expanded[3].includes(month) &&
      expanded[4].includes(dow)
    ) {
      runs.push(cursor.toISOString())
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return runs
}

const sg = settlegrid.init({
  toolSlug: 'cron-scheduler',
  pricing: {
    defaultCostCents: 0,
    methods: {
      parse_cron: { costCents: 0, displayName: 'Parse Cron' },
      next_runs: { costCents: 0, displayName: 'Next Runs' },
      cron_presets: { costCents: 0, displayName: 'Cron Presets' },
    },
  },
})

const parseCron = sg.wrap(async (args: CronInput) => {
  let expr = args.expression?.trim()
  if (!expr) throw new Error('cron expression required')
  const preset = PRESETS[expr]
  if (preset) expr = preset.expression
  const fields = expr.split(/\s+/)
  if (fields.length !== 5) throw new Error('Cron expression must have 5 fields: minute hour dom month dow')
  const descriptions = fields.map((f, i) => describeField(f, i))
  return {
    expression: expr,
    fields: fields.map((f, i) => ({
      name: FIELD_NAMES[i],
      value: f,
      expanded: expandField(f, FIELD_RANGES[i][0], FIELD_RANGES[i][1]),
      description: descriptions[i],
    })),
    humanReadable: descriptions.join(', '),
    preset: preset ? args.expression : null,
  }
}, { method: 'parse_cron' })

const nextRuns = sg.wrap(async (args: NextRunsInput) => {
  let expr = args.expression?.trim()
  if (!expr) throw new Error('cron expression required')
  const preset = PRESETS[expr]
  if (preset) expr = preset.expression
  const fields = expr.split(/\s+/)
  if (fields.length !== 5) throw new Error('Cron expression must have 5 fields')
  const count = Math.min(args.count || 5, 25)
  const runs = getNextRuns(fields, count)
  return { expression: expr, count: runs.length, nextRuns: runs }
}, { method: 'next_runs' })

const cronPresets = sg.wrap(async () => {
  return { presets: Object.entries(PRESETS).map(([alias, info]) => ({ alias, ...info })) }
}, { method: 'cron_presets' })

export { parseCron, nextRuns, cronPresets }

console.log('settlegrid-cron-scheduler MCP server ready')
console.log('Methods: parse_cron, next_runs, cron_presets')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
