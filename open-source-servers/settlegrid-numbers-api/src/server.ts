/**
 * settlegrid-numbers-api — Numbers API Trivia MCP Server
 *
 * Wraps the Numbers API for number/date trivia with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   number_fact(number)        — Trivia about a number  (1¢)
 *   date_fact(month, day)      — Historical date fact   (1¢)
 *   math_fact(number)          — Math property fact     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface NumberInput { number: number }
interface DateInput { month: number; day: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://numbersapi.com'

async function numbersFetch(path: string): Promise<{ text: string; number: number; type: string; found: boolean }> {
  const res = await fetch(`${API_BASE}${path}?json`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Numbers API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<{ text: string; number: number; type: string; found: boolean }>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'numbers-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      number_fact: { costCents: 1, displayName: 'Number Fact' },
      date_fact: { costCents: 1, displayName: 'Date Fact' },
      math_fact: { costCents: 1, displayName: 'Math Fact' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const numberFact = sg.wrap(async (args: NumberInput) => {
  if (typeof args.number !== 'number' || !Number.isFinite(args.number)) {
    throw new Error('number must be a finite number')
  }
  const n = Math.round(args.number)
  const data = await numbersFetch(`/${n}/trivia`)
  return { number: n, type: 'trivia', fact: data.text, found: data.found }
}, { method: 'number_fact' })

const dateFact = sg.wrap(async (args: DateInput) => {
  if (typeof args.month !== 'number' || args.month < 1 || args.month > 12) {
    throw new Error('month must be 1-12')
  }
  if (typeof args.day !== 'number' || args.day < 1 || args.day > 31) {
    throw new Error('day must be 1-31')
  }
  const data = await numbersFetch(`/${Math.round(args.month)}/${Math.round(args.day)}/date`)
  return { month: args.month, day: args.day, type: 'date', fact: data.text, found: data.found }
}, { method: 'date_fact' })

const mathFact = sg.wrap(async (args: NumberInput) => {
  if (typeof args.number !== 'number' || !Number.isFinite(args.number)) {
    throw new Error('number must be a finite number')
  }
  const n = Math.round(args.number)
  const data = await numbersFetch(`/${n}/math`)
  return { number: n, type: 'math', fact: data.text, found: data.found }
}, { method: 'math_fact' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { numberFact, dateFact, mathFact }

console.log('settlegrid-numbers-api MCP server ready')
console.log('Methods: number_fact, date_fact, math_fact')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
