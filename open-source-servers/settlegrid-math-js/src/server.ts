/**
 * settlegrid-math-js — Math.js Computation MCP Server
 *
 * Wraps the Math.js API for expression evaluation with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   evaluate(expression)           — Evaluate math expression  (1¢)
 *   evaluate_batch(expressions)    — Evaluate multiple exprs   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvaluateInput { expression: string }
interface BatchInput { expressions: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.mathjs.org/v4'
const MAX_EXPR_LENGTH = 500
const MAX_BATCH_SIZE = 20

async function mathFetch(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Math.js API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'math-js',
  pricing: {
    defaultCostCents: 1,
    methods: {
      evaluate: { costCents: 1, displayName: 'Evaluate Expression' },
      evaluate_batch: { costCents: 2, displayName: 'Evaluate Batch' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const evaluate = sg.wrap(async (args: EvaluateInput) => {
  if (!args.expression || typeof args.expression !== 'string') {
    throw new Error('expression is required')
  }
  const expr = args.expression.trim()
  if (expr.length === 0 || expr.length > MAX_EXPR_LENGTH) {
    throw new Error(`expression must be 1-${MAX_EXPR_LENGTH} characters`)
  }
  const data = await mathFetch({ expr }) as { result: string; error?: string }
  if (data.error) throw new Error(`Math error: ${data.error}`)
  return { expression: expr, result: data.result }
}, { method: 'evaluate' })

const evaluateBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.expressions) || args.expressions.length === 0) {
    throw new Error('expressions must be a non-empty array')
  }
  if (args.expressions.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} expressions per batch`)
  }
  for (const expr of args.expressions) {
    if (typeof expr !== 'string' || expr.trim().length === 0 || expr.length > MAX_EXPR_LENGTH) {
      throw new Error(`Each expression must be a non-empty string up to ${MAX_EXPR_LENGTH} chars`)
    }
  }
  const data = await mathFetch({ expr: args.expressions }) as { result: string[]; error?: string }
  if (data.error) throw new Error(`Math error: ${data.error}`)
  return {
    count: args.expressions.length,
    results: args.expressions.map((expr, i) => ({ expression: expr, result: data.result[i] })),
  }
}, { method: 'evaluate_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { evaluate, evaluateBatch }

console.log('settlegrid-math-js MCP server ready')
console.log('Methods: evaluate, evaluate_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
