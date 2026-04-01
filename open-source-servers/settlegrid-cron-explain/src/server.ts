/**
 * settlegrid-cron-explain — Cron Expression Parser MCP Server
 *
 * Parses and explains cron expressions in human-readable language.
 * Validates syntax and generates next run times.
 *
 * Methods:
 *   explain(expression)            — Explain cron expression         (1c)
 *   validate(expression)           — Validate cron syntax            (1c)
 *   next_runs(expression, count?)  — Calculate next run times        (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ExplainInput { expression: string }
interface ValidateInput { expression: string }
interface NextRunsInput { expression: string; count?: number }

const SPECIAL: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function explainField(field: string, type: string): string {
  if (field === '*') return `every ${type}`
  if (field.includes('/')) {
    const [, step] = field.split('/')
    return `every ${step} ${type}s`
  }
  if (field.includes(',')) return `${type}s ${field}`
  if (field.includes('-')) {
    const [a, b] = field.split('-')
    if (type === 'day_of_week') return `${DAYS[parseInt(a)] ?? a} through ${DAYS[parseInt(b)] ?? b}`
    if (type === 'month') return `${MONTHS[parseInt(a)] ?? a} through ${MONTHS[parseInt(b)] ?? b}`
    return `${type}s ${a} through ${b}`
  }
  if (type === 'day_of_week') return `on ${DAYS[parseInt(field)] ?? field}`
  if (type === 'month') return `in ${MONTHS[parseInt(field)] ?? field}`
  return `at ${type} ${field}`
}

function parseCron(expr: string): string[] | null {
  const resolved = SPECIAL[expr.toLowerCase()] ?? expr
  const parts = resolved.trim().split(/\s+/)
  if (parts.length !== 5) return null
  return parts
}

const sg = settlegrid.init({
  toolSlug: 'cron-explain',
  pricing: { defaultCostCents: 1, methods: {
    explain: { costCents: 1, displayName: 'Explain Cron' },
    validate: { costCents: 1, displayName: 'Validate Cron' },
    next_runs: { costCents: 1, displayName: 'Next Run Times' },
  }},
})

const explain = sg.wrap(async (args: ExplainInput) => {
  if (!args.expression) throw new Error('expression is required')
  const parts = parseCron(args.expression)
  if (!parts) throw new Error('Invalid cron expression. Expected 5 fields: minute hour day month weekday')
  const [minute, hour, dom, month, dow] = parts
  const descriptions = [
    explainField(minute, 'minute'),
    explainField(hour, 'hour'),
    explainField(dom, 'day'),
    explainField(month, 'month'),
    explainField(dow, 'day_of_week'),
  ]
  const summary = descriptions.filter(d => !d.startsWith('every ')).length === 0
    ? 'Runs every minute' : descriptions.join(', ')
  return { expression: args.expression, fields: { minute, hour, day_of_month: dom, month, day_of_week: dow }, description: summary, parts: descriptions }
}, { method: 'explain' })

const validate = sg.wrap(async (args: ValidateInput) => {
  if (!args.expression) throw new Error('expression is required')
  const parts = parseCron(args.expression)
  if (!parts) return { expression: args.expression, valid: false, error: 'Expected 5 space-separated fields' }
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]
  const names = ['minute', 'hour', 'day', 'month', 'weekday']
  for (let i = 0; i < 5; i++) {
    const val = parts[i].replace(/\*/g, '0').split(/[,\/-]/)[0]
    const n = parseInt(val)
    if (!isNaN(n) && (n < ranges[i][0] || n > ranges[i][1])) {
      return { expression: args.expression, valid: false, error: `${names[i]} value ${n} out of range ${ranges[i][0]}-${ranges[i][1]}` }
    }
  }
  return { expression: args.expression, valid: true, normalized: parts.join(' ') }
}, { method: 'validate' })

const nextRuns = sg.wrap(async (args: NextRunsInput) => {
  if (!args.expression) throw new Error('expression is required')
  const parts = parseCron(args.expression)
  if (!parts) throw new Error('Invalid cron expression')
  const count = Math.min(args.count ?? 5, 20)
  const [minField, hourField] = parts

  // Simple next-run estimation for basic patterns
  const now = new Date()
  const runs: string[] = []
  const baseMin = minField === '*' ? 0 : parseInt(minField.split('/')[0]) || 0
  const baseHour = hourField === '*' ? -1 : parseInt(hourField.split('/')[0]) || 0
  const minStep = minField.includes('/') ? parseInt(minField.split('/')[1]) : (minField === '*' ? 1 : 60)
  const hourStep = hourField.includes('/') ? parseInt(hourField.split('/')[1]) : 1

  const d = new Date(now)
  d.setSeconds(0, 0)
  for (let attempt = 0; attempt < 1440 * count && runs.length < count; attempt++) {
    d.setMinutes(d.getMinutes() + 1)
    const m = d.getMinutes()
    const h = d.getHours()
    const minMatch = minField === '*' || m === baseMin || (minField.includes('/') && m % minStep === 0)
    const hourMatch = hourField === '*' || h === baseHour || (hourField.includes('/') && h % hourStep === 0)
    if (minMatch && hourMatch) runs.push(d.toISOString())
  }
  return { expression: args.expression, next_runs: runs, count: runs.length }
}, { method: 'next_runs' })

export { explain, validate, nextRuns }
console.log('settlegrid-cron-explain MCP server ready')
console.log('Methods: explain, validate, next_runs')
console.log('Pricing: 1c per call | Powered by SettleGrid')
