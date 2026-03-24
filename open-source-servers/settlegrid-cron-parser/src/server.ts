/**
 * settlegrid-cron-parser — Cron Expression Parser MCP Server
 *
 * Parses cron expressions locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_cron(expression) — parse cron (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CronInput { expression: string }

const FIELD_NAMES = ['minute', 'hour', 'day_of_month', 'month', 'day_of_week']
const FIELD_RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]

function explainField(field: string, idx: number): string {
  const name = FIELD_NAMES[idx]
  if (field === '*') return `every ${name}`
  if (field.startsWith('*/')) return `every ${field.slice(2)} ${name}s`
  if (field.includes(',')) return `${name} ${field}`
  if (field.includes('-')) return `${name} ${field}`
  return `${name} ${field}`
}

const sg = settlegrid.init({
  toolSlug: 'cron-parser',
  pricing: { defaultCostCents: 1, methods: { parse_cron: { costCents: 1, displayName: 'Parse Cron' } } },
})

const parseCron = sg.wrap(async (args: CronInput) => {
  if (!args.expression) throw new Error('expression is required')
  const parts = args.expression.trim().split(/\s+/)
  if (parts.length < 5 || parts.length > 6) throw new Error('Cron must have 5 or 6 fields')
  const fields = parts.slice(0, 5).map((f, i) => ({
    field: FIELD_NAMES[i], value: f,
    range: `${FIELD_RANGES[i][0]}-${FIELD_RANGES[i][1]}`,
    explanation: explainField(f, i),
  }))
  const description = fields.map(f => f.explanation).join(', ')
  return { expression: args.expression, fields, description, valid: true, has_seconds: parts.length === 6 }
}, { method: 'parse_cron' })

export { parseCron }

console.log('settlegrid-cron-parser MCP server ready')
console.log('Methods: parse_cron')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
